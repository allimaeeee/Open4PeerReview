import type {
  BackgroundMessage,
  BackgroundResponse,
  StoredAuth,
  ReviewAssignment,
  RubricItem,
  AnnotationRecord,
  ReviewScoreRecord,
  CriterionScore,
  HighlightTag,
  HtmlCharOffsetAnchor,
  BboxAnchor,
  AnchorSelector,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PANEL_WIDTH = 380;
const CONTEXT = 32;
const SCORE_DEBOUNCE_MS = 1500;

const SCORE_LABELS: Record<CriterionScore, string> = {
  does_not_meet: 'Does Not Meet',
  exemplifies:   'Exemplifies',
  exceeds:       'Exceeds',
};

const SCORE_ABBR: Record<CriterionScore, string> = {
  does_not_meet: 'DNM',
  exemplifies:   'EXE',
  exceeds:       'EXC',
};

const TAG_COLORS: Record<string, string> = {
  action_item: 'rgba(249,115,22,0.35)',
  quick_fix:   'rgba(59,130,246,0.35)',
};

const DEFAULT_HIGHLIGHT = 'rgba(254,214,91,0.45)';
const SESSION_KEY = 'oer_review_id';

// ── State ─────────────────────────────────────────────────────────────────────

let currentAuth: StoredAuth | null = null;
let assignments: ReviewAssignment[] = [];
let selectedReview: ReviewAssignment | null = null;
let rubricItems: RubricItem[] = [];
let annotations: AnnotationRecord[] = [];
let scores = new Map<string, ReviewScoreRecord>();

const scoreTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingScores = new Map<string, CriterionScore | null>();

// ── Shadow DOM refs ───────────────────────────────────────────────────────────

let shadow: ShadowRoot;
let panelBody: HTMLElement;
let saveStatusEl: HTMLElement;
let completionFill: HTMLElement;
let completionText: HTMLElement;

// ── Popup overlay (page DOM, not shadow) ──────────────────────────────────────

let annotationPopup: HTMLElement;
let pendingAnchor: HtmlCharOffsetAnchor | null = null;

// ── Messaging ─────────────────────────────────────────────────────────────────

function send<T = unknown>(msg: BackgroundMessage): Promise<BackgroundResponse<T>> {
  return chrome.runtime.sendMessage(msg);
}

// ── Anchoring (ported from lib/anchoring/html.ts) ─────────────────────────────

function getCharOffset(root: Node, targetNode: Node, targetOffset: number): number {
  let count = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node === targetNode) return count + targetOffset;
    count += node.length;
  }
  return count + targetOffset;
}

function resolveCharOffset(root: Node, start: number, end: number): Range | null {
  const doc = root.nodeType === Node.DOCUMENT_NODE
    ? root as Document
    : root.ownerDocument as Document;
  const range = doc.createRange();
  let count = 0;
  let startSet = false;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const nodeEnd = count + node.length;
    if (!startSet && start <= nodeEnd) {
      range.setStart(node, Math.min(start - count, node.length));
      startSet = true;
    }
    if (startSet && end <= nodeEnd) {
      range.setEnd(node, Math.min(end - count, node.length));
      return range;
    }
    count = nodeEnd;
  }
  return startSet ? range : null;
}

function selectionToAnchor(): HtmlCharOffsetAnchor | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return null;
  const range = sel.getRangeAt(0);
  const body = document.body;
  const fullText = body.textContent ?? '';
  const start = getCharOffset(body, range.startContainer, range.startOffset);
  const end   = getCharOffset(body, range.endContainer,   range.endOffset);
  if (start >= end) return null;
  const exact  = fullText.slice(start, end);
  const prefix = fullText.slice(Math.max(0, start - CONTEXT), start);
  const suffix = fullText.slice(end, end + CONTEXT);
  return {
    type: 'html-char-offset',
    pageIndex: 0,
    selector: [
      { type: 'TextPositionSelector', start, end },
      { type: 'TextQuoteSelector', exact, prefix, suffix },
    ],
  };
}

function resolveAnchor(anchor: HtmlCharOffsetAnchor): Range | null {
  const body = document.body;
  const fullText = body.textContent ?? '';
  const selectors = anchor.selector as AnchorSelector[];
  const pos   = selectors.find((s): s is { type: 'TextPositionSelector'; start: number; end: number } =>
    s.type === 'TextPositionSelector');
  const quote = selectors.find((s): s is { type: 'TextQuoteSelector'; exact: string; prefix: string; suffix: string } =>
    s.type === 'TextQuoteSelector');

  if (pos && quote) {
    if (fullText.slice(pos.start, pos.end) === quote.exact) {
      return resolveCharOffset(body, pos.start, pos.end);
    }
  } else if (pos) {
    return resolveCharOffset(body, pos.start, pos.end);
  }
  if (!quote) return null;

  const idx = fullText.indexOf(quote.exact);
  if (idx !== -1) return resolveCharOffset(body, idx, idx + quote.exact.length);

  let bestIdx = -1, bestDist = Infinity, searchFrom = 0;
  while (true) {
    const found = fullText.indexOf(quote.exact, searchFrom);
    if (found === -1) break;
    const dist = Math.abs(found - (pos?.start ?? 0));
    if (dist < bestDist) { bestDist = dist; bestIdx = found; }
    searchFrom = found + 1;
  }
  if (bestIdx !== -1) return resolveCharOffset(body, bestIdx, bestIdx + quote.exact.length);
  return null;
}

// ── Highlight injection ───────────────────────────────────────────────────────

function markRange(
  range: Range,
  annotationId: string,
  color: string,
  onClick: () => void,
): void {
  const segments: [Text, number, number][] = [];
  const ancestor = range.commonAncestorContainer;

  if (ancestor.nodeType === Node.TEXT_NODE) {
    segments.push([ancestor as Text, range.startOffset, range.endOffset]);
  } else {
    const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT);
    let inRange = false;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const isStart = node === range.startContainer;
      const isEnd   = node === range.endContainer;
      if (isStart) inRange = true;
      if (!inRange) continue;
      const s = isStart ? range.startOffset : 0;
      const e = isEnd   ? range.endOffset   : node.length;
      if (s < e) segments.push([node, s, e]);
      if (isEnd) break;
    }
  }

  for (const [textNode, s, e] of segments) {
    const r = document.createRange();
    r.setStart(textNode, s);
    r.setEnd(textNode, e);
    const mark = document.createElement('mark');
    mark.dataset.annotationId = annotationId;
    mark.style.cssText = `background:${color};border-radius:2px;cursor:pointer;padding:0;`;
    try {
      r.surroundContents(mark);
      mark.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onClick();
      });
    } catch {
      // Skip partial overlaps
    }
  }
}

function applyHighlights() {
  // Remove old marks
  document.querySelectorAll('mark[data-annotation-id]').forEach(m => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });

  const textAnnotations = annotations
    .filter(a => a.anchor.type === 'html-char-offset')
    .sort((a, b) => {
      const getStart = (ann: AnnotationRecord) => {
        if (ann.anchor.type !== 'html-char-offset') return 0;
        const pos = (ann.anchor as HtmlCharOffsetAnchor).selector
          .find(s => s.type === 'TextPositionSelector') as { type: string; start: number } | undefined;
        return pos?.start ?? 0;
      };
      return getStart(b) - getStart(a); // descending — right to left
    });

  for (const ann of textAnnotations) {
    const range = resolveAnchor(ann.anchor as HtmlCharOffsetAnchor);
    if (!range) continue;
    const color = ann.tag ? (TAG_COLORS[ann.tag] ?? DEFAULT_HIGHLIGHT) : DEFAULT_HIGHLIGHT;
    markRange(range, ann.id, color, () => scrollToAnnotationInPanel(ann.id));
  }
}

function scrollToAnnotationInPanel(annotationId: string) {
  const el = shadow.getElementById(`ann-${annotationId}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  el?.classList.add('highlighted');
  setTimeout(() => el?.classList.remove('highlighted'), 1200);
}

// ── Save status ───────────────────────────────────────────────────────────────

function setSaveStatus(status: 'saving' | 'saved' | 'error' | 'idle') {
  if (!saveStatusEl) return;
  saveStatusEl.className = `save-status ${status}`;
  if (status === 'saving') saveStatusEl.textContent = 'Saving…';
  else if (status === 'saved') saveStatusEl.textContent = 'Saved ✓';
  else if (status === 'error') saveStatusEl.textContent = 'Save failed';
  else saveStatusEl.textContent = '';
  if (status === 'saved') setTimeout(() => setSaveStatus('idle'), 2500);
}

// ── Completion bar ────────────────────────────────────────────────────────────

function updateCompletion() {
  if (!completionFill || !completionText || rubricItems.length === 0) return;
  const scored = rubricItems.filter(item => scores.get(item.id)?.score != null).length;
  const pct = Math.round((scored / rubricItems.length) * 100);
  completionFill.style.width = `${pct}%`;
  completionText.textContent = `${scored}/${rubricItems.length}`;
}

// ── Score handling ────────────────────────────────────────────────────────────

function toggleScore(rubricItemId: string, level: CriterionScore) {
  const current = scores.get(rubricItemId);
  const newLevel: CriterionScore | null = current?.score === level ? null : level;

  // Optimistic update
  if (newLevel === null) {
    scores.delete(rubricItemId);
  } else {
    scores.set(rubricItemId, {
      id: current?.id ?? '',
      review_id: selectedReview!.id,
      rubric_item_id: rubricItemId,
      score: newLevel,
      criterion_scores: [newLevel],
      comment: current?.comment ?? null,
    });
  }
  pendingScores.set(rubricItemId, newLevel);

  // Update score buttons for this criterion
  refreshScoreButtons(rubricItemId);
  updateCompletion();
  setSaveStatus('saving');

  // Debounce the actual save
  const existing = scoreTimers.get(rubricItemId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => flushScore(rubricItemId), SCORE_DEBOUNCE_MS);
  scoreTimers.set(rubricItemId, timer);
}

async function flushScore(rubricItemId: string) {
  if (!selectedReview) return;
  const level = pendingScores.get(rubricItemId);
  pendingScores.delete(rubricItemId);
  scoreTimers.delete(rubricItemId);

  const resp = await send({
    type: 'SAVE_SCORE',
    payload: {
      review_id: selectedReview.id,
      rubric_item_id: rubricItemId,
      score: level ?? null,
      criterion_scores: level ? [level] : [],
    },
  });
  setSaveStatus(resp.success ? 'saved' : 'error');
}

function refreshScoreButtons(rubricItemId: string) {
  const score = scores.get(rubricItemId);
  const current = score?.score ?? null;
  const item = shadow.getElementById(`crit-body-${rubricItemId}`);
  if (!item) return;
  item.querySelectorAll<HTMLButtonElement>('.score-btn').forEach(btn => {
    const level = btn.dataset.level as CriterionScore;
    btn.className = `score-btn ${level === current ? `active ${current}` : ''}`;
  });
  // Update badge in header
  const badge = shadow.getElementById(`badge-${rubricItemId}`);
  if (badge) {
    badge.textContent = current ? SCORE_ABBR[current] : '—';
    badge.className = `score-badge ${current ?? 'unscored'}`;
  }
}

// ── Annotation handling ───────────────────────────────────────────────────────

async function saveAnnotation(
  rubricItemId: string | null,
  body: string,
  tag: HighlightTag | null,
  anchor: HtmlCharOffsetAnchor | BboxAnchor,
) {
  if (!selectedReview) return;
  setSaveStatus('saving');
  const resp = await send<AnnotationRecord>({
    type: 'SAVE_ANNOTATION',
    payload: {
      review_id: selectedReview.id,
      rubric_item_id: rubricItemId,
      anchor: anchor as unknown as Record<string, unknown>,
      body,
      tag,
    },
  });
  if (!resp.success || !resp.data) { setSaveStatus('error'); return; }
  annotations.push(resp.data);
  setSaveStatus('saved');
  applyHighlights();
  refreshAnnotationList(rubricItemId ?? '__free__');
}

async function deleteAnnotation(annotationId: string) {
  setSaveStatus('saving');
  const resp = await send({ type: 'DELETE_ANNOTATION', payload: { id: annotationId } });
  if (!resp.success) { setSaveStatus('error'); return; }
  const idx = annotations.findIndex(a => a.id === annotationId);
  if (idx !== -1) annotations.splice(idx, 1);
  setSaveStatus('saved');
  applyHighlights();
  // Remove mark from DOM
  document.querySelectorAll(`mark[data-annotation-id="${annotationId}"]`).forEach(m => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
  renderRubricCriteria(); // Full re-render to update counts
}

function refreshAnnotationList(rubricItemId: string) {
  if (!selectedReview) return;
  const key = rubricItemId === '__free__' ? null : rubricItemId;
  const relevant = annotations.filter(a => a.rubric_item_id === key);
  const container = shadow.getElementById(`ann-list-${rubricItemId}`);
  if (!container) return;
  container.innerHTML = relevant.map(ann => renderAnnotationItem(ann)).join('');
  container.querySelectorAll<HTMLButtonElement>('.ann-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteAnnotation(btn.dataset.id!));
  });
}

function renderAnnotationItem(ann: AnnotationRecord): string {
  const isScreenshot = ann.anchor.type === 'bbox';
  const bboxAnchor = isScreenshot ? (ann.anchor as BboxAnchor) : null;
  const quote = ann.anchor.type === 'html-char-offset'
    ? (() => {
        const sel = (ann.anchor as HtmlCharOffsetAnchor).selector
          .find(s => s.type === 'TextQuoteSelector') as { exact?: string } | undefined;
        return sel?.exact ?? '';
      })()
    : '';

  const tagHtml = ann.tag
    ? `<span class="ann-tag ${ann.tag}">${ann.tag === 'action_item' ? 'Action Item' : 'Quick Fix'}</span>`
    : '';

  const screenshotHtml = bboxAnchor?.screenshotUrl
    ? `<img class="screenshot-thumb" src="${bboxAnchor.screenshotUrl}" alt="Screenshot" />`
    : '';

  const quoteHtml = quote
    ? `<div class="ann-quote">"${quote.slice(0, 60)}${quote.length > 60 ? '…' : ''}"</div>`
    : '';

  return `
    <div class="ann-item" id="ann-${ann.id}">
      ${screenshotHtml}
      ${quoteHtml}
      <div class="ann-body">${escHtml(ann.body)}</div>
      ${tagHtml}
      <button class="ann-delete" data-id="${ann.id}" title="Delete">×</button>
    </div>
  `;
}

// ── Text selection popup ──────────────────────────────────────────────────────

function createAnnotationPopupEl() {
  annotationPopup = document.createElement('div');
  annotationPopup.id = 'oer-ann-popup';
  annotationPopup.style.cssText = `
    position: absolute;
    z-index: 2147483646;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    padding: 14px;
    width: 300px;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    color: #1a202c;
    display: none;
  `;
  document.body.appendChild(annotationPopup);

  // Prevent clicks inside popup from clearing the selection
  annotationPopup.addEventListener('mousedown', e => e.preventDefault());
}

function showAnnotationPopup(anchor: HtmlCharOffsetAnchor) {
  pendingAnchor = anchor;
  const quote = (anchor.selector.find(s => s.type === 'TextQuoteSelector') as { exact?: string })?.exact ?? '';
  const sel = window.getSelection();
  const rect = sel?.getRangeAt(0).getBoundingClientRect();

  const rubricOptions = rubricItems.map(item => {
    const parts = item.label.split(' · ');
    return `<option value="${item.id}">${parts[0] ?? item.label}</option>`;
  }).join('');

  annotationPopup.innerHTML = `
    <div style="font-size:11px;color:#718096;margin-bottom:8px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
      "${quote.slice(0, 60)}${quote.length > 60 ? '…' : ''}"
    </div>

    <div style="margin-bottom:8px;">
      <label style="display:block;font-size:11px;font-weight:600;color:#4a5568;margin-bottom:4px;">Criterion</label>
      <select id="oer-pop-criterion" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;outline:none;">
        <option value="">— Free note —</option>
        ${rubricOptions}
      </select>
    </div>

    <div style="margin-bottom:8px;">
      <label style="display:block;font-size:11px;font-weight:600;color:#4a5568;margin-bottom:4px;">Tag</label>
      <div style="display:flex;gap:6px;">
        <button class="oer-tag-btn" data-tag="action_item" style="flex:1;padding:5px;border-radius:5px;border:1.5px solid #e2e8f0;background:#f7fafc;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#718096;">Action Item</button>
        <button class="oer-tag-btn" data-tag="quick_fix" style="flex:1;padding:5px;border-radius:5px;border:1.5px solid #e2e8f0;background:#f7fafc;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#718096;">Quick Fix</button>
      </div>
    </div>

    <div style="margin-bottom:10px;">
      <label style="display:block;font-size:11px;font-weight:600;color:#4a5568;margin-bottom:4px;">Note</label>
      <textarea id="oer-pop-body" rows="3" placeholder="Add a note…" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;resize:none;font-family:inherit;color:#1a202c;box-sizing:border-box;outline:none;"></textarea>
    </div>

    <div style="display:flex;gap:8px;">
      <button id="oer-pop-cancel" style="flex:1;padding:7px;border-radius:6px;border:1px solid #e2e8f0;background:#f7fafc;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;color:#4a5568;">Cancel</button>
      <button id="oer-pop-save" style="flex:1;padding:7px;border-radius:6px;border:none;background:#3D6FA9;color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Annotate</button>
    </div>
  `;

  // Tag toggle state
  let selectedTag: HighlightTag | null = null;
  annotationPopup.querySelectorAll<HTMLButtonElement>('.oer-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag as HighlightTag;
      selectedTag = selectedTag === tag ? null : tag;
      annotationPopup.querySelectorAll<HTMLButtonElement>('.oer-tag-btn').forEach(b => {
        const isActive = b.dataset.tag === selectedTag;
        const color = b.dataset.tag === 'action_item' ? '#c2410c' : '#1d4ed8';
        const bg = b.dataset.tag === 'action_item' ? '#fed7aa' : '#bfdbfe';
        const border = b.dataset.tag === 'action_item' ? '#fb923c' : '#93c5fd';
        b.style.background = isActive ? bg : '#f7fafc';
        b.style.color = isActive ? color : '#718096';
        b.style.borderColor = isActive ? border : '#e2e8f0';
      });
    });
  });

  annotationPopup.querySelector('#oer-pop-cancel')?.addEventListener('click', hideAnnotationPopup);

  annotationPopup.querySelector('#oer-pop-save')?.addEventListener('click', async () => {
    if (!pendingAnchor) return;
    const criterionId = (annotationPopup.querySelector('#oer-pop-criterion') as HTMLSelectElement).value || null;
    const body = (annotationPopup.querySelector('#oer-pop-body') as HTMLTextAreaElement).value.trim();
    if (!body) {
      (annotationPopup.querySelector('#oer-pop-body') as HTMLTextAreaElement)
        .style.borderColor = '#fc8181';
      return;
    }
    hideAnnotationPopup();
    window.getSelection()?.removeAllRanges();
    await saveAnnotation(criterionId, body, selectedTag, pendingAnchor);
  });

  // Position popup near selection
  if (rect) {
    const top = rect.top + window.scrollY - annotationPopup.offsetHeight - 8;
    const left = Math.min(
      rect.left + window.scrollX,
      window.innerWidth - PANEL_WIDTH - 308
    );
    annotationPopup.style.top = `${Math.max(window.scrollY + 4, top)}px`;
    annotationPopup.style.left = `${Math.max(4, left)}px`;
  }

  annotationPopup.style.display = 'block';
  setTimeout(() => {
    (annotationPopup.querySelector('#oer-pop-body') as HTMLTextAreaElement)?.focus();
  }, 0);
}

function hideAnnotationPopup() {
  annotationPopup.style.display = 'none';
  pendingAnchor = null;
}

function handleMouseUp(e: MouseEvent) {
  if (!selectedReview) return;

  // Ignore clicks inside our popup or panel host
  const target = e.target as HTMLElement;
  if (
    target.closest('#oer-ann-popup') ||
    target.closest('#oer-review-host')
  ) return;

  // Hide popup if clicking elsewhere
  if (annotationPopup.style.display !== 'none') {
    if (!target.closest('#oer-ann-popup')) {
      hideAnnotationPopup();
    }
    return;
  }

  setTimeout(() => {
    const anchor = selectionToAnchor();
    if (anchor) showAnnotationPopup(anchor);
  }, 0);
}

// ── Screenshot (pin) ──────────────────────────────────────────────────────────

async function handlePinScreenshot() {
  if (!selectedReview) return;

  const captureResp = await send<{ png: string }>({ type: 'CAPTURE_TAB' });
  if (!captureResp.success || !captureResp.data) {
    showToast('Screenshot capture failed');
    return;
  }

  showToast('Uploading screenshot…');

  const uploadResp = await send<{ url: string }>({
    type: 'UPLOAD_SCREENSHOT',
    payload: { png: captureResp.data.png, reviewId: selectedReview.id },
  });
  if (!uploadResp.success || !uploadResp.data) {
    showToast('Upload failed — check Supabase Storage bucket "screenshots"');
    return;
  }

  showPinPopup(captureResp.data.png, uploadResp.data.url);
}

function showPinPopup(thumbPng: string, screenshotUrl: string) {
  const rubricOptions = rubricItems.map(item => {
    const parts = item.label.split(' · ');
    return `<option value="${item.id}">${parts[0] ?? item.label}</option>`;
  }).join('');

  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: calc(50% - ${PANEL_WIDTH / 2}px);
    transform: translate(-50%, -50%);
    z-index: 2147483647;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
    padding: 16px;
    width: 320px;
    font-family: Inter, -apple-system, sans-serif;
    font-size: 13px;
    color: #1a202c;
  `;
  popup.innerHTML = `
    <div style="font-weight:600;margin-bottom:10px;font-size:14px;">Pin Screenshot</div>
    <img src="${thumbPng}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:10px;border:1px solid #e2e8f0;" />
    <div style="margin-bottom:8px;">
      <label style="display:block;font-size:11px;font-weight:600;color:#4a5568;margin-bottom:4px;">Link to criterion (optional)</label>
      <select id="pin-criterion" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;box-sizing:border-box;outline:none;">
        <option value="">— Free note —</option>
        ${rubricOptions}
      </select>
    </div>
    <div style="margin-bottom:10px;">
      <label style="display:block;font-size:11px;font-weight:600;color:#4a5568;margin-bottom:4px;">Note</label>
      <textarea id="pin-body" rows="3" placeholder="Describe what you're capturing…" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;resize:none;font-family:inherit;box-sizing:border-box;outline:none;"></textarea>
    </div>
    <div style="display:flex;gap:8px;">
      <button id="pin-cancel" style="flex:1;padding:7px;border-radius:6px;border:1px solid #e2e8f0;background:#f7fafc;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;color:#4a5568;">Cancel</button>
      <button id="pin-save" style="flex:1;padding:7px;border-radius:6px;border:none;background:#3D6FA9;color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Save Pin</button>
    </div>
  `;

  const backdrop = document.createElement('div');
  backdrop.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:2147483646;`;

  document.body.appendChild(backdrop);
  document.body.appendChild(popup);

  const remove = () => { backdrop.remove(); popup.remove(); };
  backdrop.addEventListener('click', remove);
  popup.querySelector('#pin-cancel')?.addEventListener('click', remove);
  popup.querySelector('#pin-save')?.addEventListener('click', async () => {
    const criterionId = (popup.querySelector('#pin-criterion') as HTMLSelectElement).value || null;
    const body = (popup.querySelector('#pin-body') as HTMLTextAreaElement).value.trim() || 'Screenshot';
    const anchor: BboxAnchor = {
      type: 'bbox',
      x: 0, y: 0,
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      screenshotUrl,
    };
    remove();
    await saveAnnotation(criterionId, body, null, anchor);
    showToast('Screenshot pinned');
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(message: string) {
  let toast = document.getElementById('oer-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'oer-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: ${PANEL_WIDTH + 16}px;
      background: #2d3748;
      color: white;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-family: Inter, -apple-system, sans-serif;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 0.2s;
      max-width: 240px;
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast!.style.opacity = '0'; }, 2500);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderContent(state: 'loading' | 'login' | 'no-assignments' | 'select-review' | 'review') {
  if (!panelBody) return;

  switch (state) {
    case 'loading':
      panelBody.innerHTML = `
        <div class="state-box">
          <div class="spinner"></div>
          <p class="state-sub">Loading…</p>
        </div>
      `;
      break;

    case 'login':
      panelBody.innerHTML = `
        <div class="state-box" style="padding:24px 20px;">
          <div style="font-size:28px;margin-bottom:8px;">🔒</div>
          <p class="state-title">Sign in to review</p>
          <p class="state-sub" style="margin-bottom:16px;">Use your OER Hub account credentials</p>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input id="login-email" type="email" class="input" placeholder="you@institution.edu" />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input id="login-password" type="password" class="input" placeholder="Password" />
          </div>
          <div id="login-error" style="color:#e53e3e;font-size:12px;margin-bottom:8px;display:none;"></div>
          <button id="btn-login" class="btn btn-primary btn-full" style="margin-top:4px;">Sign In</button>
        </div>
      `;
      shadow.getElementById('btn-login')?.addEventListener('click', handleLogin);
      shadow.getElementById('login-password')?.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') handleLogin();
      });
      break;

    case 'no-assignments':
      panelBody.innerHTML = `
        <div class="state-box">
          <div style="font-size:28px;">📋</div>
          <p class="state-title">No active assignments</p>
          <p class="state-sub">You have no in-progress review assignments. Check the OER Hub dashboard for new tasks.</p>
        </div>
      `;
      break;

    case 'select-review':
      panelBody.innerHTML = `
        <div style="padding:16px;">
          <p class="section-label">Select review to annotate</p>
          <div class="assignment-list">
            ${assignments.map(a => `
              <div class="assignment-card" data-id="${a.id}">
                <div class="assignment-title">${escHtml(a.documents?.title ?? 'Untitled')}</div>
                <div class="assignment-rubric">${escHtml(a.rubrics?.title ?? 'Unknown rubric')} · ${a.status}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      shadow.querySelectorAll<HTMLElement>('.assignment-card').forEach(card => {
        card.addEventListener('click', () => selectReview(card.dataset.id!));
      });
      break;

    case 'review':
      renderReviewInterface();
      break;
  }
}

function renderReviewInterface() {
  if (!panelBody || !selectedReview) return;
  panelBody.innerHTML = `
    <div class="rubric-header">
      <div>
        <div class="doc-title">${escHtml(selectedReview.documents?.title ?? 'Untitled')}</div>
        <div class="rubric-name">${escHtml(selectedReview.rubrics?.title ?? '')}</div>
      </div>
      <button class="switch-btn" id="btn-switch-review" title="Switch review">⇄</button>
    </div>

    <div class="completion-bar">
      <div class="completion-track">
        <div class="completion-fill" id="completion-fill" style="width:0%"></div>
      </div>
      <span class="completion-text" id="completion-text">0/${rubricItems.length}</span>
    </div>

    <div class="criterion-list" id="criterion-list"></div>

    <div style="padding:12px 16px;border-top:1px solid #f0f4f8;">
      <p class="section-label" style="margin-bottom:8px;">Free Notes</p>
      <div class="ann-list" id="ann-list-__free__"></div>
    </div>
  `;

  completionFill = shadow.getElementById('completion-fill') as HTMLElement;
  completionText = shadow.getElementById('completion-text') as HTMLElement;

  shadow.getElementById('btn-switch-review')?.addEventListener('click', () => {
    selectedReview = null;
    sessionStorage.removeItem(SESSION_KEY);
    renderContent('select-review');
  });

  renderRubricCriteria();
  updateCompletion();
  refreshAnnotationList('__free__');
}

function renderRubricCriteria() {
  const list = shadow.getElementById('criterion-list');
  if (!list) return;

  list.innerHTML = rubricItems.map((item, idx) => {
    const labelParts = item.label.split(' · ');
    const code = labelParts[0] ?? `C${idx + 1}`;
    const name = labelParts.slice(1).join(' · ') || item.label;
    const score = scores.get(item.id);
    const level = score?.score ?? null;
    const annCount = annotations.filter(a => a.rubric_item_id === item.id).length;

    return `
      <div class="criterion-item">
        <div class="criterion-hd" data-id="${item.id}">
          <span class="expand-icon" id="expand-${item.id}">▶</span>
          <span class="crit-code">${escHtml(code)}</span>
          <span class="crit-name">${escHtml(name)}</span>
          ${annCount > 0 ? `<span class="ann-count">${annCount}</span>` : ''}
          <span class="score-badge ${level ?? 'unscored'}" id="badge-${item.id}">${level ? SCORE_ABBR[level] : '—'}</span>
        </div>
        <div class="criterion-bd" id="crit-body-${item.id}">
          <div class="crit-desc">${escHtml(item.description.slice(0, 200))}${item.description.length > 200 ? '…' : ''}</div>
          <div class="score-btns">
            ${((['does_not_meet', 'exemplifies', 'exceeds'] as CriterionScore[])).map(lvl => `
              <button class="score-btn ${lvl === level ? `active ${lvl}` : ''}" data-level="${lvl}" data-item="${item.id}">
                ${SCORE_LABELS[lvl]}
              </button>
            `).join('')}
          </div>
          <div class="ann-section-label">Annotations</div>
          <div class="ann-list" id="ann-list-${item.id}"></div>
        </div>
      </div>
    `;
  }).join('');

  // Accordion toggles
  list.querySelectorAll<HTMLElement>('.criterion-hd').forEach(hd => {
    hd.addEventListener('click', () => {
      const id = hd.dataset.id!;
      const body = shadow.getElementById(`crit-body-${id}`);
      const icon = shadow.getElementById(`expand-${id}`);
      if (!body) return;
      const isOpen = body.classList.toggle('open');
      if (icon) icon.textContent = isOpen ? '▼' : '▶';
      if (isOpen) refreshAnnotationList(id);
    });
  });

  // Score buttons
  list.querySelectorAll<HTMLButtonElement>('.score-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleScore(btn.dataset.item!, btn.dataset.level as CriterionScore);
    });
  });

  // Populate open criterion annotation lists
  rubricItems.forEach(item => {
    const body = shadow.getElementById(`crit-body-${item.id}`);
    if (body?.classList.contains('open')) refreshAnnotationList(item.id);
  });
}

// ── Panel creation ────────────────────────────────────────────────────────────

function createPanel() {
  const host = document.createElement('div');
  host.id = 'oer-review-host';
  host.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: ${PANEL_WIDTH}px !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
  `;

  shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      :host { display: block; }

      .panel {
        width: ${PANEL_WIDTH}px;
        height: 100vh;
        background: #fff;
        border-left: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        color: #1a202c;
        box-shadow: -4px 0 24px rgba(0,0,0,0.08);
      }

      .panel-hd {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: #3D6FA9;
        color: #fff;
        flex-shrink: 0;
        gap: 8px;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: 7px;
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.01em;
      }

      .logo-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #C4622D;
        flex-shrink: 0;
      }

      .hd-btn {
        background: rgba(255,255,255,0.15);
        border: none;
        color: #fff;
        cursor: pointer;
        width: 26px;
        height: 26px;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        transition: background 0.15s;
        flex-shrink: 0;
        font-family: inherit;
        line-height: 1;
      }
      .hd-btn:hover { background: rgba(255,255,255,0.25); }

      .panel-body {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
      }

      .panel-body::-webkit-scrollbar { width: 4px; }
      .panel-body::-webkit-scrollbar-track { background: transparent; }
      .panel-body::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }

      .panel-ft {
        padding: 10px 14px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
        gap: 8px;
      }

      .btn-pin {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 11px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        background: #f7fafc;
        color: #4a5568;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
      }
      .btn-pin:hover { background: #edf2f7; border-color: #cbd5e0; }

      .save-status { font-size: 11px; color: #a0aec0; }
      .save-status.saving { color: #C4622D; }
      .save-status.saved  { color: #38a169; }
      .save-status.error  { color: #e53e3e; }

      /* State boxes */
      .state-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
        gap: 8px;
        min-height: 200px;
      }

      .state-title {
        font-size: 14px;
        font-weight: 600;
        color: #2d3748;
      }

      .state-sub {
        font-size: 12px;
        color: #718096;
        line-height: 1.5;
        max-width: 280px;
      }

      .spinner {
        width: 24px;
        height: 24px;
        border: 2.5px solid #e2e8f0;
        border-top-color: #3D6FA9;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Forms */
      .input {
        width: 100%;
        padding: 7px 10px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 13px;
        color: #1a202c;
        background: #fff;
        outline: none;
        font-family: inherit;
        transition: border-color 0.15s;
      }
      .input:focus { border-color: #3D6FA9; box-shadow: 0 0 0 2px rgba(61,111,169,0.12); }

      .form-group { margin-bottom: 10px; }
      .form-label { display: block; font-size: 11px; font-weight: 600; color: #4a5568; margin-bottom: 4px; }

      .btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; transition: all 0.15s; }
      .btn-primary { background: #3D6FA9; color: #fff; }
      .btn-primary:hover { background: #2c5f96; }
      .btn-full { width: 100%; }

      .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #a0aec0; }

      /* Assignments */
      .assignment-list { display: flex; flex-direction: column; gap: 6px; }
      .assignment-card { padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.15s; background: #fff; }
      .assignment-card:hover { border-color: #3D6FA9; background: #eff6ff; }
      .assignment-title { font-size: 13px; font-weight: 600; color: #2d3748; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px; }
      .assignment-rubric { font-size: 11px; color: #718096; }

      /* Rubric header */
      .rubric-header {
        padding: 10px 14px;
        background: #f7fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
        flex-shrink: 0;
      }
      .doc-title { font-size: 12px; font-weight: 600; color: #2d3748; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
      .rubric-name { font-size: 11px; color: #718096; margin-top: 1px; }
      .switch-btn { background: none; border: none; font-size: 16px; cursor: pointer; color: #a0aec0; padding: 2px; border-radius: 4px; flex-shrink: 0; }
      .switch-btn:hover { color: #3D6FA9; background: #eff6ff; }

      /* Completion */
      .completion-bar { padding: 7px 14px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f0f4f8; }
      .completion-track { flex: 1; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; }
      .completion-fill { height: 100%; background: #3D6FA9; border-radius: 2px; transition: width 0.3s; }
      .completion-text { font-size: 11px; color: #a0aec0; white-space: nowrap; }

      /* Criterion cards */
      .criterion-item { border-bottom: 1px solid #f0f4f8; }
      .criterion-hd { display: flex; align-items: center; gap: 7px; padding: 10px 14px; cursor: pointer; transition: background 0.1s; user-select: none; }
      .criterion-hd:hover { background: #f7fafc; }
      .expand-icon { font-size: 9px; color: #a0aec0; width: 12px; flex-shrink: 0; }
      .crit-code { font-size: 11px; font-weight: 700; color: #718096; min-width: 28px; flex-shrink: 0; }
      .crit-name { flex: 1; font-size: 12px; font-weight: 500; color: #2d3748; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ann-count { font-size: 10px; background: #edf2f7; color: #718096; border-radius: 10px; padding: 1px 6px; flex-shrink: 0; }

      .score-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; }
      .score-badge.does_not_meet { background: #fed7d7; color: #c53030; }
      .score-badge.exemplifies   { background: #dbeafe; color: #1d4ed8; }
      .score-badge.exceeds       { background: #fde8d8; color: #c4622d; }
      .score-badge.unscored      { background: #f7fafc; color: #a0aec0; border: 1px dashed #e2e8f0; }

      .criterion-bd { display: none; padding: 10px 14px 14px; }
      .criterion-bd.open { display: block; }
      .crit-desc { font-size: 12px; color: #718096; line-height: 1.5; margin-bottom: 10px; max-height: 72px; overflow-y: auto; }

      .score-btns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-bottom: 10px; }
      .score-btn { padding: 6px 4px; border-radius: 5px; border: 1.5px solid #e2e8f0; background: #f7fafc; font-size: 11px; font-weight: 600; cursor: pointer; text-align: center; transition: all 0.12s; color: #718096; font-family: inherit; line-height: 1.2; }
      .score-btn:hover { border-color: #cbd5e0; background: #edf2f7; }
      .score-btn.active.does_not_meet { background: #fed7d7; border-color: #fc8181; color: #c53030; }
      .score-btn.active.exemplifies   { background: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
      .score-btn.active.exceeds       { background: #fde8d8; border-color: #fdba74; color: #c4622d; }

      .ann-section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #a0aec0; margin-bottom: 6px; }

      .ann-list { display: flex; flex-direction: column; gap: 5px; }
      .ann-item { position: relative; background: #f7fafc; border: 1px solid #e8edf2; border-radius: 6px; padding: 7px 28px 7px 9px; font-size: 12px; color: #4a5568; line-height: 1.4; }
      .ann-item.highlighted { background: #fffbeb; border-color: #fbbf24; }
      .ann-quote { font-style: italic; color: #a0aec0; font-size: 11px; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ann-body { }
      .ann-tag { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 3px; margin-top: 4px; text-transform: uppercase; }
      .ann-tag.action_item { background: #fed7aa; color: #c2410c; }
      .ann-tag.quick_fix   { background: #bfdbfe; color: #1d4ed8; }
      .ann-delete { position: absolute; top: 5px; right: 5px; background: none; border: none; cursor: pointer; color: #cbd5e0; font-size: 15px; line-height: 1; padding: 2px; border-radius: 3px; display: none; font-family: inherit; }
      .ann-item:hover .ann-delete { display: block; }
      .ann-delete:hover { color: #e53e3e; }

      .screenshot-thumb { width: 100%; height: 56px; object-fit: cover; border-radius: 4px; margin-bottom: 3px; border: 1px solid #e2e8f0; display: block; }
    </style>

    <div class="panel">
      <div class="panel-hd">
        <div class="logo">
          <div class="logo-dot"></div>
          OER Review
        </div>
        <button class="hd-btn" id="btn-min" title="Minimize">−</button>
      </div>

      <div class="panel-body" id="panel-body"></div>

      <div class="panel-ft">
        <button class="btn-pin" id="btn-pin">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 2L14 6L9 11L5 7L10 2Z"/><path d="M5 7L2 14"/><path d="M7 4L12 9"/>
          </svg>
          Pin Screenshot
        </button>
        <span class="save-status" id="save-status"></span>
      </div>
    </div>
  `;

  document.body.appendChild(host);

  panelBody = shadow.getElementById('panel-body') as HTMLElement;
  saveStatusEl = shadow.getElementById('save-status') as HTMLElement;

  shadow.getElementById('btn-min')?.addEventListener('click', () => {
    host.style.width = host.style.width === '48px' ? `${PANEL_WIDTH}px` : '48px';
  });
  shadow.getElementById('btn-pin')?.addEventListener('click', handlePinScreenshot);
}

// ── Review selection ──────────────────────────────────────────────────────────

async function selectReview(reviewId: string) {
  const review = assignments.find(a => a.id === reviewId);
  if (!review) return;
  selectedReview = review;
  sessionStorage.setItem(SESSION_KEY, reviewId);

  renderContent('loading');

  // Set status to in_progress if assigned
  if (review.status === 'assigned') {
    await send({ type: 'SET_REVIEW_STATUS', payload: { reviewId, status: 'in_progress' } });
  }

  const [itemsResp, annResp, scoresResp] = await Promise.all([
    send<RubricItem[]>({ type: 'GET_RUBRIC_ITEMS', payload: { rubricId: review.rubric_id } }),
    send<AnnotationRecord[]>({ type: 'GET_ANNOTATIONS', payload: { reviewId } }),
    send<ReviewScoreRecord[]>({ type: 'GET_SCORES', payload: { reviewId } }),
  ]);

  rubricItems = itemsResp.data ?? [];
  annotations = annResp.data ?? [];
  scores.clear();
  (scoresResp.data ?? []).forEach(s => scores.set(s.rubric_item_id, s));

  renderContent('review');
  applyHighlights();
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function handleLogin() {
  const emailEl = shadow.getElementById('login-email') as HTMLInputElement;
  const passEl  = shadow.getElementById('login-password') as HTMLInputElement;
  const errEl   = shadow.getElementById('login-error') as HTMLElement;
  const btn     = shadow.getElementById('btn-login') as HTMLButtonElement;

  const email = emailEl.value.trim();
  const password = passEl.value;
  if (!email || !password) return;

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  errEl.style.display = 'none';

  const resp = await send<StoredAuth>({ type: 'LOGIN', payload: { email, password } });

  if (!resp.success || !resp.data) {
    errEl.textContent = resp.error ?? 'Sign in failed';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Sign In';
    return;
  }

  currentAuth = resp.data;
  renderContent('loading');

  const assignResp = await send<ReviewAssignment[]>({ type: 'GET_ASSIGNMENTS' });
  assignments = assignResp.data ?? [];
  renderContent(assignments.length === 0 ? 'no-assignments' : 'select-review');
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  createPanel();
  createAnnotationPopupEl();

  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') hideAnnotationPopup();
  });

  // Let the popup query current state
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'GET_CURRENT_REVIEW') {
      sendResponse({ success: true, data: selectedReview });
    }
    return false;
  });

  const authResp = await send<StoredAuth>({ type: 'GET_AUTH' });
  if (!authResp.success || !authResp.data) {
    renderContent('login');
    return;
  }
  currentAuth = authResp.data;
  renderContent('loading');

  const assignResp = await send<ReviewAssignment[]>({ type: 'GET_ASSIGNMENTS' });
  if (!assignResp.success) { renderContent('login'); return; }

  assignments = assignResp.data ?? [];

  // Restore previously selected review from session storage
  const savedId = sessionStorage.getItem(SESSION_KEY);
  if (savedId && assignments.some(a => a.id === savedId)) {
    await selectReview(savedId);
    return;
  }

  renderContent(assignments.length === 0 ? 'no-assignments' : 'select-review');
}

init();
