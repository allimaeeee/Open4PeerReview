// lib/anchoring/html.ts
// Pure utilities for char-offset anchoring in static HTML snapshots.
// No React — safe to import from both client and server.

export interface HtmlCharOffsetAnchor {
  type: 'html-char-offset'
  start: number
  end: number
  text: string
}

/**
 * Count characters from `root` up to `targetNode:targetOffset` by walking
 * all text nodes in document order. The snapshot is immutable under a given
 * fingerprint, so these offsets never go stale.
 */
export function getCharOffset(root: Node, targetNode: Node, targetOffset: number): number {
  let count = 0
  const walker = (root.ownerDocument ?? (root as Document)).createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  )
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node === targetNode) return count + targetOffset
    count += node.length
  }
  // targetNode not found — return best-effort position
  return count + targetOffset
}

/**
 * Resolve char offsets back to a DOM Range inside `root`.
 * Returns null if the offsets exceed the document's text length.
 */
export function resolveCharOffset(root: Node, start: number, end: number): Range | null {
  const doc = root.nodeType === Node.DOCUMENT_NODE
    ? (root as Document)
    : (root.ownerDocument as Document)

  const range = doc.createRange()
  let count = 0
  let startSet = false

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const nodeEnd = count + node.length

    if (!startSet && start <= nodeEnd) {
      range.setStart(node, Math.min(start - count, node.length))
      startSet = true
    }
    if (startSet && end <= nodeEnd) {
      range.setEnd(node, Math.min(end - count, node.length))
      return range
    }
    count = nodeEnd
  }
  return startSet ? range : null
}

/**
 * Convert the current selection inside an iframe window to an anchor.
 * Returns null if nothing is selected or the selection is whitespace only.
 */
export function selectionToAnchor(win: Window): HtmlCharOffsetAnchor | null {
  const sel = win.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return null

  const range = sel.getRangeAt(0)
  const body = win.document.body

  const start = getCharOffset(body, range.startContainer, range.startOffset)
  const end   = getCharOffset(body, range.endContainer,   range.endOffset)

  if (start >= end) return null

  return { type: 'html-char-offset', start, end, text: sel.toString().trim() }
}

// ── Highlight injection ───────────────────────────────────────────────────────

const TAG_COLOR: Record<string, string> = {
  action_item: 'rgba(253,186,116,0.50)',
  quick_fix:   'rgba(147,197,253,0.50)',
}
const DEFAULT_COLOR = 'rgba(148,163,184,0.40)'

/**
 * Wrap text nodes covered by `range` in <mark> elements with click/hover
 * handlers. Iterates text nodes so multi-line / multi-element selections work.
 */
function markRange(
  doc: Document,
  range: Range,
  annotationId: string,
  color: string,
  onClick:  (x: number, y: number) => void,
  onEnter:  (x: number, y: number) => void,
  onLeave:  () => void,
): void {
  // Collect (textNode, sliceStart, sliceEnd) for every text node in the range
  const segments: [Text, number, number][] = []

  const ancestor = range.commonAncestorContainer

  if (ancestor.nodeType === Node.TEXT_NODE) {
    segments.push([ancestor as Text, range.startOffset, range.endOffset])
  } else {
    const walker = doc.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT)
    let inRange = false
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const isStart = node === range.startContainer
      const isEnd   = node === range.endContainer

      if (isStart) inRange = true
      if (!inRange) continue

      const s = isStart ? range.startOffset : 0
      const e = isEnd   ? range.endOffset   : node.length
      if (s < e) segments.push([node, s, e])
      if (isEnd) break
    }
  }

  for (const [textNode, s, e] of segments) {
    const r = doc.createRange()
    r.setStart(textNode, s)
    r.setEnd(textNode, e)

    const mark = doc.createElement('mark')
    mark.dataset.annotationId = annotationId
    mark.style.cssText =
      `background:${color};border-radius:2px;cursor:pointer;padding:0;`

    try {
      r.surroundContents(mark)
    } catch {
      // surroundContents fails when the range partially overlaps an element
      // boundary (rare in normal prose). Skip rather than corrupt the DOM.
      continue
    }

    mark.addEventListener('click',      (ev) => { ev.stopPropagation(); onClick((ev as MouseEvent).clientX, (ev as MouseEvent).clientY) })
    mark.addEventListener('mouseenter', (ev) => { onEnter((ev as MouseEvent).clientX, (ev as MouseEvent).clientY) })
    mark.addEventListener('mouseleave', onLeave)
  }
}

/**
 * Inject highlights for every annotation into the iframe document.
 * Apply right-to-left so earlier char offsets are not shifted by DOM mutations.
 */
export function applyHighlights(
  doc: Document,
  annotations: Array<{ id: string; start: number; end: number; tag: string | null; body: string }>,
  onMarkClick: (id: string, x: number, y: number) => void,
  onMarkHover: (id: string | null, x: number, y: number) => void,
): void {
  const sorted = [...annotations].sort((a, b) => b.start - a.start)

  for (const ann of sorted) {
    const range = resolveCharOffset(doc.body, ann.start, ann.end)
    if (!range) continue

    const color = ann.tag ? (TAG_COLOR[ann.tag] ?? DEFAULT_COLOR) : DEFAULT_COLOR

    markRange(
      doc,
      range,
      ann.id,
      color,
      (x, y) => onMarkClick(ann.id, x, y),
      (x, y) => onMarkHover(ann.id, x, y),
      ()     => onMarkHover(null, 0, 0),
    )
  }
}
