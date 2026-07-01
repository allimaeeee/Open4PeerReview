import type {
  BackgroundMessage,
  BackgroundResponse,
  StoredAuth,
  ReviewAssignment,
  RubricItem,
  AnnotationRecord,
  ReviewScoreRecord,
  ScoreCommentRecord,
  CriterionScore,
  HighlightTag,
  HtmlCharOffsetAnchor,
  BboxAnchor,
  PointAnchor,
  AnchorSelector,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PANEL_WIDTH = 380;
const CONTEXT = 32;
const SCORE_DEBOUNCE_MS = 1500;
// Injected at build time via esbuild `define` — see extension/build.mjs.
// `npm run build:ext:dev` points this at localhost for local testing.
declare const __OERHUB_URL__: string;
const OERHUB_URL = __OERHUB_URL__;

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
const PANEL_GEOM_KEY = 'oer_panel_geom';
const EXPANDED_CRIT_KEY = 'oer_expanded_criteria';

// ── State ─────────────────────────────────────────────────────────────────────

let currentAuth: StoredAuth | null = null;
let assignments: ReviewAssignment[] = [];
let selectedReview: ReviewAssignment | null = null;
let rubricItems: RubricItem[] = [];
let annotations: AnnotationRecord[] = [];
let scores = new Map<string, ReviewScoreRecord>();

const scoreTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingScores = new Map<string, CriterionScore | null>();
type ScoreCommentEntry = { id: string | null; body: string };
type ScoreCommentMap = { does_not_meet: ScoreCommentEntry; exceeds: ScoreCommentEntry };
const EMPTY_SCORE_COMMENTS: ScoreCommentMap = { does_not_meet: { id: null, body: '' }, exceeds: { id: null, body: '' } };
const scoreComments = new Map<string, ScoreCommentMap>();

// ── Shadow DOM refs ───────────────────────────────────────────────────────────

let shadow: ShadowRoot;
let panelHost: HTMLElement;
let panelBody: HTMLElement;
let saveStatusEl: HTMLElement;
let completionFill: HTMLElement;

// ── Panel drag / resize state ─────────────────────────────────────────────────

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
let isDragging = false;
let isResizing = false;
let resizeDir: ResizeDir | null = null;
let dragOffset = { x: 0, y: 0 };
let resizeSt = { x: 0, y: 0, w: 0, h: 0, l: 0, t: 0 };
let savedPanelH = 560;
const MIN_PANEL_W = 280;
const MIN_PANEL_H = 300;
let completionText: HTMLElement;

// ── Popup overlay (page DOM, not shadow) ──────────────────────────────────────

let annotationPopup: HTMLElement;
let annotationTooltip: HTMLElement | null = null;
let pendingAnchor: HtmlCharOffsetAnchor | null = null;
let pendingHotspotAnchor: PointAnchor | null = null;
let hotspotMode = false;

// ── Messaging ─────────────────────────────────────────────────────────────────

function send<T = unknown>(msg: BackgroundMessage): Promise<BackgroundResponse<T>> {
  try {
    return (chrome.runtime.sendMessage(msg) as Promise<BackgroundResponse<T>>)
      .catch((err: Error) => {
        if (err?.message?.includes('Extension context invalidated')) {
          showToast('Extension reloaded — please refresh this page to reconnect.');
        }
        return { success: false, error: err?.message ?? 'messaging error' } as BackgroundResponse<T>;
      });
  } catch (err) {
    const errMsg = (err as Error)?.message ?? '';
    if (errMsg.includes('Extension context invalidated')) {
      showToast('Extension reloaded — please refresh this page to reconnect.');
    }
    return Promise.resolve({ success: false, error: errMsg } as BackgroundResponse<T>);
  }
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
      mark.addEventListener('mouseenter', (ev) => showAnnotationTooltipFor(annotationId, (ev as MouseEvent).clientX, (ev as MouseEvent).clientY));
      mark.addEventListener('mouseleave', scheduleHideTooltip);
    } catch {
      // Skip partial overlaps
    }
  }
}

function clearPendingHighlight() {
  document.querySelectorAll('mark[data-annotation-id="pending"]').forEach(m => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

function applyPendingHighlight(range: Range) {
  clearPendingHighlight();
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
    mark.dataset.annotationId = 'pending';
    mark.style.cssText = 'background:rgba(254,214,91,0.6);border-radius:2px;padding:0;';
    try { r.surroundContents(mark); } catch { /* skip partial overlaps */ }
  }
}

function applyHighlights() {
  // Remove saved marks only — pending mark is managed separately
  document.querySelectorAll('mark[data-annotation-id]:not([data-annotation-id="pending"])').forEach(m => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });

  const base = currentPageBase();
  const textAnnotations = annotations
    .filter(a => {
      if (a.anchor.type !== 'html-char-offset') return false;
      const anchor = a.anchor as HtmlCharOffsetAnchor;
      if (!anchor.pageUrl) return true; // legacy annotations without pageUrl
      try {
        const anchorBase = new URL(anchor.pageUrl).origin + new URL(anchor.pageUrl).pathname;
        return anchorBase === base;
      } catch { return true; }
    })
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

  applyHotspotMarkers();
}

// ── Hotspot markers ───────────────────────────────────────────────────────────

function placeHotspotMarker(ann: AnnotationRecord, index: number) {
  const anchor = ann.anchor as PointAnchor;
  const el = document.createElement('div');
  el.id = `hotspot-marker-${ann.id}`;
  el.dataset.annotationId = ann.id;
  el.className = 'oer-hotspot-marker';
  el.style.cssText = `
    position: absolute;
    left: ${anchor.pageX}px;
    top: ${anchor.pageY}px;
    transform: translate(-50%, -100%);
    width: 28px;
    height: 36px;
    cursor: pointer;
    z-index: 2147483645;
    filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35));
    pointer-events: auto;
    transition: filter 0.15s, transform 0.15s;
  `;
  el.innerHTML = `
    <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;">
      <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#3D6FA9"/>
      <circle cx="14" cy="14" r="7" fill="white" fill-opacity="0.9"/>
    </svg>
    <div style="position:absolute;top:7px;left:0;width:28px;text-align:center;font-size:10px;font-weight:700;color:#3D6FA9;font-family:Inter,-apple-system,sans-serif;line-height:1;">${index}</div>
  `;
  el.addEventListener('mouseenter', (ev) => {
    el.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.45))';
    el.style.transform = 'translate(-50%, -105%)';
    showAnnotationTooltipFor(ann.id, (ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
  });
  el.addEventListener('mouseleave', () => {
    el.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,0.35))';
    el.style.transform = 'translate(-50%, -100%)';
    scheduleHideTooltip();
  });
  el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    scrollToAnnotationInPanel(ann.id);
  });
  document.body.appendChild(el);
}

function currentPageBase(): string {
  return window.location.origin + window.location.pathname;
}

function applyHotspotMarkers() {
  document.querySelectorAll('.oer-hotspot-marker').forEach(m => m.remove());
  const base = currentPageBase();
  const pointAnnotations = annotations.filter(a => {
    if (a.anchor.type !== 'point') return false;
    const anchor = a.anchor as PointAnchor;
    if (!anchor.pageUrl) return true; // legacy annotations without pageUrl
    try {
      const anchorBase = new URL(anchor.pageUrl).origin + new URL(anchor.pageUrl).pathname;
      return anchorBase === base;
    } catch {
      return true;
    }
  });
  pointAnnotations.forEach((ann, idx) => placeHotspotMarker(ann, idx + 1));
}

// Torus renders page content asynchronously (both on a full reload/re-visit and
// on in-app SPA navigation), so a single synchronous applyHighlights() call right
// after fetching annotations can run before the text it's searching for has been
// painted into the DOM. Retry a few times — applyHighlights is idempotent, so the
// extra calls are harmless once the content has already settled.
function scheduleHighlightRetries() {
  setTimeout(applyHighlights, 350);
  setTimeout(applyHighlights, 900);
  setTimeout(applyHighlights, 2200);
}

function scrollToAnnotationInPanel(annotationId: string) {
  const ann = annotations.find(a => a.id === annotationId);

  // Expand the owning criterion accordion — its annotation list is only
  // rendered into the DOM once opened, so the target element won't exist yet.
  if (ann?.rubric_item_id) {
    const body = shadow.getElementById(`crit-body-${ann.rubric_item_id}`);
    if (body && !body.classList.contains('open')) {
      body.classList.add('open');
      const icon = shadow.getElementById(`expand-${ann.rubric_item_id}`);
      if (icon) icon.textContent = '▼';
      saveExpandedCriteria();
    }
    refreshAnnotationList(ann.rubric_item_id);
  }

  // Expand the panel itself if the user had it minimized.
  const panel = shadow.querySelector('.panel');
  if (panel?.classList.contains('collapsed')) {
    panel.classList.remove('collapsed');
    panelHost.style.height = `${savedPanelH}px`;
    const minBtn = shadow.getElementById('btn-min') as HTMLButtonElement | null;
    if (minBtn) minBtn.textContent = '−';
    savePanelGeometry();
  }

  const el = shadow.getElementById(`ann-${annotationId}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  el?.classList.add('highlighted');
  setTimeout(() => el?.classList.remove('highlighted'), 1200);
}

// ── "View annotation" — navigate to page + scroll to location ─────────────────

const GOTO_ANN_KEY = 'oer_goto_annotation_id';

function scrollToAnchorOnPage(anchor: AnnotationRecord['anchor'], annId: string) {
  if (anchor.type === 'point') {
    const pa = anchor as PointAnchor;
    window.scrollTo({ top: Math.max(0, pa.pageY - window.innerHeight / 2), behavior: 'smooth' });
    // Flash the hotspot marker
    setTimeout(() => {
      const marker = document.getElementById(`hotspot-marker-${annId}`);
      if (marker) {
        marker.style.filter = 'drop-shadow(0 0 12px rgba(61,111,169,0.9))';
        marker.style.transform = 'translate(-50%, -110%) scale(1.25)';
        setTimeout(() => {
          marker.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,0.35))';
          marker.style.transform = 'translate(-50%, -100%)';
        }, 1500);
      }
    }, 400);
  } else if (anchor.type === 'bbox') {
    const ba = anchor as BboxAnchor;
    window.scrollTo({ top: Math.max(0, ba.y - window.innerHeight / 2), behavior: 'smooth' });
  } else if (anchor.type === 'html-char-offset') {
    const range = resolveAnchor(anchor as HtmlCharOffsetAnchor);
    if (range) {
      const el = range.startContainer.parentElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function goToAnnotation(ann: AnnotationRecord) {
  const targetUrl = (ann.anchor as { pageUrl?: string }).pageUrl ?? null;

  // Check if navigation to a different page is needed
  if (targetUrl) {
    try {
      const targetBase = new URL(targetUrl).origin + new URL(targetUrl).pathname;
      if (targetBase !== currentPageBase()) {
        // Store annotation ID so we scroll to it after the page loads
        sessionStorage.setItem(GOTO_ANN_KEY, ann.id);
        window.location.href = targetUrl;
        return;
      }
    } catch { /* malformed URL — fall through to same-page scroll */ }
  }

  // Same page — scroll directly
  scrollToAnchorOnPage(ann.anchor, ann.id);
  scrollToAnnotationInPanel(ann.id);
}

// Called during init() — if we navigated here via goToAnnotation, execute the scroll
function checkPendingAnnotationNavigation() {
  const annId = sessionStorage.getItem(GOTO_ANN_KEY);
  if (!annId) return;
  sessionStorage.removeItem(GOTO_ANN_KEY);
  // Wait for annotations to load before scrolling (they load async in selectReview)
  const tryScroll = (attempts = 0) => {
    const ann = annotations.find(a => a.id === annId);
    if (ann) {
      scrollToAnchorOnPage(ann.anchor, ann.id);
      scrollToAnnotationInPanel(ann.id);
    } else if (attempts < 10) {
      setTimeout(() => tryScroll(attempts + 1), 300);
    }
  };
  setTimeout(() => tryScroll(), 600);
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
  const scored = rubricItems.filter(item => {
    const s = scores.get(item.id);
    const levels = s?.criterion_scores ?? [];
    if (levels.length === 0) return false;
    const comments = scoreComments.get(item.id) ?? EMPTY_SCORE_COMMENTS;
    if (levels.includes('does_not_meet') && !comments.does_not_meet.body.trim()) return false;
    if (levels.includes('exceeds') && !comments.exceeds.body.trim()) return false;
    return true;
  }).length;
  const pct = Math.round((scored / rubricItems.length) * 100);
  completionFill.style.width = `${pct}%`;
  completionText.textContent = `${scored}/${rubricItems.length}`;
}

// ── Score handling ────────────────────────────────────────────────────────────

function toggleScore(rubricItemId: string, level: CriterionScore) {
  const current = scores.get(rubricItemId);
  const currentLevels = current?.criterion_scores ?? [];

  let newLevels: CriterionScore[];
  if (currentLevels.includes(level)) {
    newLevels = currentLevels.filter(s => s !== level);
    if (level === 'does_not_meet' || level === 'exceeds') {
      const prev = scoreComments.get(rubricItemId) ?? EMPTY_SCORE_COMMENTS;
      scoreComments.set(rubricItemId, { ...prev, [level]: { id: prev[level].id, body: '' } });
    }
  } else {
    newLevels = [...currentLevels, level];
  }

  if (newLevels.length === 0) {
    scores.delete(rubricItemId);
  } else {
    const primary: CriterionScore = newLevels.includes('exemplifies') ? 'exemplifies'
      : newLevels.includes('exceeds') ? 'exceeds'
      : 'does_not_meet';
    scores.set(rubricItemId, {
      id: current?.id ?? '',
      review_id: selectedReview!.id,
      rubric_item_id: rubricItemId,
      score: primary,
      criterion_scores: newLevels,
      comment: current?.comment ?? null,
    });
  }

  refreshScoreButtons(rubricItemId);
  updateCompletion();
  setSaveStatus('saving');

  const existing = scoreTimers.get(rubricItemId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => flushScore(rubricItemId), SCORE_DEBOUNCE_MS);
  scoreTimers.set(rubricItemId, timer);
}

async function flushScore(rubricItemId: string) {
  if (!selectedReview) return;
  scoreTimers.delete(rubricItemId);

  const s = scores.get(rubricItemId);
  const levels = s?.criterion_scores ?? [];

  const [scoreResp, dnmOk, exceedsOk] = await Promise.all([
    send({
      type: 'SAVE_SCORE',
      payload: {
        review_id: selectedReview.id,
        rubric_item_id: rubricItemId,
        score: levels[0] ?? null,
        criterion_scores: levels,
      },
    }),
    syncScoreComment(rubricItemId, 'does_not_meet'),
    syncScoreComment(rubricItemId, 'exceeds'),
  ]);
  setSaveStatus(scoreResp.success && dnmOk && exceedsOk ? 'saved' : 'error');
}

// Mirrors the web app's handleAddScoreComment/handleEditScoreComment/handleDeleteScoreComment
// (ReviewerConsole.tsx) so DNM/Exceeds comments made in either client show up in the other —
// both read/write the same `score_comments` rows keyed by (review_id, rubric_item_id, score_level).
async function syncScoreComment(rubricItemId: string, level: 'does_not_meet' | 'exceeds'): Promise<boolean> {
  if (!selectedReview) return false;
  const entry = scoreComments.get(rubricItemId)?.[level] ?? EMPTY_SCORE_COMMENTS[level];
  const body = entry.body.trim();

  if (!body) {
    if (!entry.id) return true;
    const resp = await send({ type: 'DELETE_SCORE_COMMENT', payload: { id: entry.id } });
    if (resp.success) {
      const prev = scoreComments.get(rubricItemId) ?? EMPTY_SCORE_COMMENTS;
      scoreComments.set(rubricItemId, { ...prev, [level]: { id: null, body: '' } });
    }
    return resp.success;
  }

  if (entry.id) {
    const resp = await send({ type: 'SAVE_SCORE_COMMENT', payload: { id: entry.id, body } });
    return resp.success;
  }

  const resp = await send<ScoreCommentRecord>({
    type: 'SAVE_SCORE_COMMENT',
    payload: { review_id: selectedReview.id, rubric_item_id: rubricItemId, score_level: level, body },
  });
  if (resp.success && resp.data) {
    const prev = scoreComments.get(rubricItemId) ?? EMPTY_SCORE_COMMENTS;
    scoreComments.set(rubricItemId, { ...prev, [level]: { id: resp.data.id, body } });
  }
  return resp.success;
}

function refreshScoreButtons(rubricItemId: string) {
  const score = scores.get(rubricItemId);
  const currentLevels = score?.criterion_scores ?? [];
  const item = shadow.getElementById(`crit-body-${rubricItemId}`);
  if (!item) return;

  item.querySelectorAll<HTMLButtonElement>('.score-btn').forEach(btn => {
    const level = btn.dataset.level as CriterionScore;
    const isActive = currentLevels.includes(level);
    btn.className = `score-btn ${isActive ? `active ${level}` : ''}`;
  });

  (['does_not_meet', 'exceeds'] as const).forEach(lvl => {
    const box = shadow.getElementById(`score-comment-${lvl}-${rubricItemId}`);
    if (box) box.style.display = currentLevels.includes(lvl) ? 'block' : 'none';
  });

  const badge = shadow.getElementById(`badge-${rubricItemId}`);
  if (badge) {
    if (currentLevels.length === 0) {
      badge.textContent = '—';
      badge.className = 'score-badge unscored';
    } else if (currentLevels.length === 1) {
      badge.textContent = SCORE_ABBR[currentLevels[0]];
      badge.className = `score-badge ${currentLevels[0]}`;
    } else {
      badge.textContent = currentLevels.map(l => SCORE_ABBR[l]).join('+');
      badge.className = 'score-badge multi';
    }
  }
}

// ── Torus detection & auto-screenshot ────────────────────────────────────────

function isTorusPage(): boolean {
  const href = window.location.href;
  const sourceUrl = selectedReview?.documents?.source_url ?? '';
  if (sourceUrl) {
    try {
      const sourceHost = new URL(sourceUrl).hostname;
      return window.location.hostname === sourceHost;
    } catch { /* ignore */ }
  }
  return /torus|oli\.cmu\.edu|course-author\.oli|torus\.oli/.test(href);
}

async function captureAnnotationScreenshot(): Promise<string | null> {
  if (!selectedReview) return null;
  try {
    const captureResp = await send<{ png: string }>({ type: 'CAPTURE_TAB' });
    if (!captureResp.success || !captureResp.data?.png) {
      console.error('[OER] CAPTURE_TAB failed:', captureResp.error);
      return null;
    }
    const uploadResp = await send<{ url: string }>({
      type: 'UPLOAD_SCREENSHOT',
      payload: { png: captureResp.data.png, reviewId: selectedReview.id },
    });
    if (!uploadResp.success) console.error('[OER] UPLOAD_SCREENSHOT failed:', uploadResp.error);
    return uploadResp.success ? (uploadResp.data?.url ?? null) : null;
  } catch (err) {
    console.error('[OER] captureAnnotationScreenshot threw:', err);
    return null;
  }
}

async function computePageFingerprint(): Promise<string> {
  const text = document.body?.innerText ?? '';
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function updateDocumentPages(screenshotUrl: string | null) {
  if (!selectedReview || !isTorusPage()) return;
  const fingerprint = await computePageFingerprint();
  await send({
    type: 'UPDATE_DOCUMENT_PAGES',
    payload: {
      documentId: selectedReview.document_id,
      storagePath: `torus/${selectedReview.document_id}/`,
      pageEntry: {
        url: window.location.href,
        fingerprint,
        storagePath: screenshotUrl ?? '',
      },
    },
  });
}

// ── Annotation handling ───────────────────────────────────────────────────────

async function saveAnnotation(
  rubricItemId: string | null,
  body: string,
  tag: HighlightTag | null,
  anchor: HtmlCharOffsetAnchor | BboxAnchor | PointAnchor,
): Promise<AnnotationRecord | null> {
  if (!selectedReview) return null;
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
  if (!resp.success || !resp.data) { setSaveStatus('error'); return null; }
  annotations.push(resp.data);
  setSaveStatus('saved');
  applyHighlights();
  refreshAnnotationList(rubricItemId ?? '__free__');
  return resp.data;
}

// Take screenshot AFTER highlights/markers are painted, then patch the annotation anchor.
async function attachScreenshotToAnnotations(savedAnns: AnnotationRecord[]) {
  if (savedAnns.length === 0) return;
  const screenshotUrl = await captureAnnotationScreenshot();

  if (screenshotUrl) {
    for (const ann of savedAnns) {
      const updatedAnchor = { ...(ann.anchor as unknown as Record<string, unknown>), screenshotUrl };
      const resp = await send<AnnotationRecord>({
        type: 'SAVE_ANNOTATION',
        payload: { id: ann.id, anchor: updatedAnchor },
      });
      if (!resp.success) continue;
      const idx = annotations.findIndex(a => a.id === ann.id);
      if (idx !== -1) {
        annotations[idx] = { ...annotations[idx], anchor: updatedAnchor as unknown as HtmlCharOffsetAnchor | BboxAnchor | PointAnchor };
        refreshAnnotationList(ann.rubric_item_id ?? '__free__');
      }
    }
  }

  // Track annotated Torus pages in documents.pages (fire-and-forget, non-critical)
  updateDocumentPages(screenshotUrl).catch(() => { /* non-critical */ });
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
  container.querySelectorAll<HTMLButtonElement>('.ann-edit').forEach(btn => {
    btn.addEventListener('click', () => editAnnotation(btn.dataset.id!));
  });
  container.querySelectorAll<HTMLButtonElement>('.ann-goto').forEach(btn => {
    btn.addEventListener('click', () => {
      const annId = btn.dataset.id!;
      const ann = annotations.find(a => a.id === annId);
      if (ann) goToAnnotation(ann);
    });
  });
}

function renderAnnotationItem(ann: AnnotationRecord): string {
  const isScreenshot = ann.anchor.type === 'bbox';
  const isHotspot = ann.anchor.type === 'point';
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

  // screenshotUrl can live on any anchor type (bbox, point, or html-char-offset)
  const screenshotUrl = (ann.anchor as { screenshotUrl?: string }).screenshotUrl ?? null;
  const screenshotHtml = screenshotUrl
    ? `<img class="screenshot-thumb" src="${screenshotUrl}" alt="Screenshot" />`
    : '';

  const quoteHtml = quote
    ? `<div class="ann-quote">"${quote.slice(0, 60)}${quote.length > 60 ? '…' : ''}"</div>`
    : '';

  const hotspotBadge = isHotspot
    ? `<div class="ann-hotspot-label">📍 Hotspot</div>`
    : '';

  // Page label — show when the annotation is on a specific (named) page
  const anchorPageName = (ann.anchor as { pageName?: string }).pageName ?? null;
  const pageLabelHtml = anchorPageName
    ? `<div class="ann-page-label" title="${escHtml(anchorPageName)}">📄 ${escHtml(anchorPageName.slice(0, 40))}${anchorPageName.length > 40 ? '…' : ''}</div>`
    : '';

  // "View" button — only shown for annotations that have a page URL to navigate to
  const anchorPageUrl = (ann.anchor as { pageUrl?: string }).pageUrl ?? null;
  const gotoBtn = anchorPageUrl
    ? `<button class="ann-goto" data-id="${ann.id}" title="Go to annotation on page">↗ View</button>`
    : '';

  return `
    <div class="ann-item" id="ann-${ann.id}">
      ${screenshotHtml}
      ${hotspotBadge}
      ${pageLabelHtml}
      ${quoteHtml}
      <div class="ann-body">${escHtml(ann.body)}</div>
      ${tagHtml}
      ${gotoBtn}
      <button class="ann-edit" data-id="${ann.id}" title="Edit">✎</button>
      <button class="ann-delete" data-id="${ann.id}" title="Delete">×</button>
    </div>
  `;
}

function editAnnotation(annotationId: string) {
  const item = shadow.getElementById(`ann-${annotationId}`);
  const ann = annotations.find(a => a.id === annotationId);
  if (!item || !ann) return;

  const savedInnerHTML = item.innerHTML;
  item.innerHTML = `
    <textarea class="ann-edit-input" rows="3">${escHtml(ann.body)}</textarea>
    <div class="inline-note-actions" style="margin-top:4px;">
      <button class="ann-edit-cancel">Cancel</button>
      <button class="ann-edit-confirm">Save</button>
    </div>
  `;
  (item.querySelector('.ann-edit-input') as HTMLTextAreaElement)?.focus();

  item.querySelector('.ann-edit-cancel')?.addEventListener('click', () => {
    item.innerHTML = savedInnerHTML;
    item.querySelector<HTMLButtonElement>('.ann-delete')?.addEventListener('click',
      () => deleteAnnotation(annotationId));
    item.querySelector<HTMLButtonElement>('.ann-edit')?.addEventListener('click',
      () => editAnnotation(annotationId));
  });

  item.querySelector('.ann-edit-confirm')?.addEventListener('click', async () => {
    const newBody = (item.querySelector('.ann-edit-input') as HTMLTextAreaElement).value.trim();
    if (!newBody) return;
    setSaveStatus('saving');
    const resp = await send({ type: 'UPDATE_ANNOTATION', payload: { id: annotationId, body: newBody } });
    if (resp.success) {
      ann.body = newBody;
      setSaveStatus('saved');
    } else {
      setSaveStatus('error');
    }
    refreshAnnotationList(ann.rubric_item_id ?? '__free__');
  });
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

  // Prevent clicks inside popup from clearing the text selection, but allow
  // textarea and input clicks through so focus can be placed after interacting
  // with criteria checkboxes.
  annotationPopup.addEventListener('mousedown', e => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    e.preventDefault();
  });
}

// ── Annotation hover tooltip ──────────────────────────────────────────────────

let tooltipHideTimer: ReturnType<typeof setTimeout> | null = null;

// Grace period before hiding so the cursor can travel from the mark/marker
// into the tooltip to reach its Edit/Delete/Open buttons.
function scheduleHideTooltip() {
  cancelHideTooltip();
  tooltipHideTimer = setTimeout(hideAnnotationTooltip, 200);
}

function cancelHideTooltip() {
  if (tooltipHideTimer) { clearTimeout(tooltipHideTimer); tooltipHideTimer = null; }
}

function createAnnotationTooltip() {
  annotationTooltip = document.createElement('div');
  annotationTooltip.id = 'oer-ann-tooltip';
  annotationTooltip.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    'background:#1a202c',
    'color:#e2e8f0',
    'border-radius:8px',
    'padding:8px 12px',
    'font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif',
    'font-size:12px',
    'line-height:1.5',
    'max-width:260px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
    'pointer-events:auto',
    'display:none',
    'word-break:break-word',
  ].join(';');
  annotationTooltip.addEventListener('mouseenter', cancelHideTooltip);
  annotationTooltip.addEventListener('mouseleave', scheduleHideTooltip);
  document.body.appendChild(annotationTooltip);
}

function showAnnotationTooltipFor(annId: string, clientX: number, clientY: number) {
  if (!annotationTooltip) return;
  cancelHideTooltip();
  const ann = annotations.find(a => a.id === annId);
  if (!ann) return;

  const criterionLabel = ann.rubric_item_id
    ? rubricItems.find(r => r.id === ann.rubric_item_id)?.label ?? null
    : null;

  const actionBtnStyle = 'cursor:pointer;background:rgba(255,255,255,0.12);border:none;color:#e2e8f0;' +
    'font-size:11px;font-weight:600;padding:4px 8px;border-radius:5px;font-family:inherit;';

  let html = '';
  if (criterionLabel) {
    const code = criterionLabel.split(' · ')[0] ?? criterionLabel;
    html += `<div style="font-size:10px;font-weight:700;color:#90cdf4;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;">${escHtml(code)}</div>`;
  }
  html += `<div>${escHtml(ann.body.slice(0, 140))}${ann.body.length > 140 ? '…' : ''}</div>`;
  html += `
    <div style="display:flex;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.12);">
      <button class="tt-open" style="${actionBtnStyle}">↗ Open</button>
      <button class="tt-edit" style="${actionBtnStyle}">✎ Edit</button>
      <button class="tt-delete" style="cursor:pointer;background:rgba(229,62,62,0.25);border:none;color:#feb2b2;font-size:11px;font-weight:600;padding:4px 8px;border-radius:5px;font-family:inherit;">🗑 Delete</button>
    </div>
  `;

  annotationTooltip.innerHTML = html;
  annotationTooltip.style.display = 'block';

  annotationTooltip.querySelector('.tt-open')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hideAnnotationTooltip();
    scrollToAnnotationInPanel(annId);
  });
  annotationTooltip.querySelector('.tt-edit')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hideAnnotationTooltip();
    scrollToAnnotationInPanel(annId);
    editAnnotation(annId);
  });
  annotationTooltip.querySelector('.tt-delete')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hideAnnotationTooltip();
    deleteAnnotation(annId);
  });

  const tipW = 260;
  let left = clientX - tipW / 2;
  let top = clientY - (annotationTooltip.offsetHeight || 56) - 12;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  if (top < 8) top = clientY + 20;
  annotationTooltip.style.left = `${left}px`;
  annotationTooltip.style.top = `${top}px`;
}

function hideAnnotationTooltip() {
  cancelHideTooltip();
  if (annotationTooltip) annotationTooltip.style.display = 'none';
}

function showAnnotationPopup(anchor: HtmlCharOffsetAnchor) {
  pendingAnchor = anchor;
  annotationPopup.style.position = 'absolute';
  const quote = (anchor.selector.find(s => s.type === 'TextQuoteSelector') as { exact?: string })?.exact ?? '';
  const sel = window.getSelection();
  const selRange = sel && !sel.isCollapsed ? sel.getRangeAt(0).cloneRange() : null;
  const rect = selRange?.getBoundingClientRect();

  const criteriaCheckboxes = rubricItems.map(item => {
    const code = item.label.split(' · ')[0] ?? item.label;
    return `<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:11px;cursor:pointer;border-radius:3px;user-select:none;" onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" class="oer-crit-check" value="${item.id}" style="cursor:pointer;flex-shrink:0;"> ${code}
    </label>`;
  }).join('');

  annotationPopup.innerHTML = `
    <div style="font-size:11px;color:#718096;margin-bottom:8px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
      "${quote.slice(0, 60)}${quote.length > 60 ? '…' : ''}"
    </div>

    <div style="margin-bottom:8px;">
      <label style="display:block;font-size:11px;font-weight:600;color:#4a5568;margin-bottom:4px;">Criteria <span style="font-weight:400;color:#a0aec0;">(select all that apply)</span></label>
      <div style="max-height:110px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px;padding:2px 2px;">
        ${criteriaCheckboxes || '<span style="font-size:11px;color:#a0aec0;padding:4px 6px;display:block;">No criteria available</span>'}
      </div>
      <div style="font-size:10px;color:#a0aec0;margin-top:3px;">Leave all unchecked to save as a general note</div>
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
    const checkedCriteria = [...annotationPopup.querySelectorAll<HTMLInputElement>('.oer-crit-check:checked')]
      .map(cb => cb.value);
    const body = (annotationPopup.querySelector('#oer-pop-body') as HTMLTextAreaElement).value.trim();
    if (!body) {
      (annotationPopup.querySelector('#oer-pop-body') as HTMLTextAreaElement)
        .style.borderColor = '#fc8181';
      return;
    }
    const rawAnchor = pendingAnchor;
    hideAnnotationPopup();

    // Always keep the text-position anchor so applyHighlights() can mark the text in the DOM.
    // Record pageUrl (for the "View" button) and pageName (shown on Torus multi-page courses).
    // Screenshot is taken AFTER save so the highlight mark appears in the image.
    const finalAnchor = {
      ...rawAnchor,
      pageUrl: window.location.href,
      pageName: document.title,
    } as HtmlCharOffsetAnchor;

    const savedAnns: AnnotationRecord[] = [];
    if (checkedCriteria.length === 0) {
      const a = await saveAnnotation(null, body, selectedTag, finalAnchor);
      if (a) savedAnns.push(a);
    } else {
      for (const criterionId of checkedCriteria) {
        const a = await saveAnnotation(criterionId, body, selectedTag, finalAnchor);
        if (a) savedAnns.push(a);
      }
    }

    // Capture screenshot after highlight marks are in the DOM (~200 ms for paint).
    setTimeout(() => attachScreenshotToAnnotations(savedAnns), 200);
  });

  // Position popup near selection
  if (rect) {
    const top = rect.top + window.scrollY - annotationPopup.offsetHeight - 8;
    const left = Math.min(
      rect.left + window.scrollX,
      window.innerWidth - 316
    );
    annotationPopup.style.top = `${Math.max(window.scrollY + 4, top)}px`;
    annotationPopup.style.left = `${Math.max(4, left)}px`;
  }

  // Apply persistent pending highlight and clear native browser selection.
  // This keeps the selected text visually highlighted while the popup is open.
  if (selRange) {
    applyPendingHighlight(selRange);
    sel?.removeAllRanges();
  }

  annotationPopup.style.display = 'block';
  setTimeout(() => {
    (annotationPopup.querySelector('#oer-pop-body') as HTMLTextAreaElement)?.focus();
  }, 0);
}

function hideAnnotationPopup() {
  clearPendingHighlight();
  annotationPopup.style.display = 'none';
  pendingAnchor = null;
  pendingHotspotAnchor = null;
}

// ── Hotspot mode ──────────────────────────────────────────────────────────────

function enterHotspotMode() {
  hotspotMode = true;
  document.body.style.cursor = 'crosshair';
  shadow.getElementById('btn-hotspot')?.classList.add('active');

  const banner = document.createElement('div');
  banner.id = 'oer-hotspot-banner';
  banner.style.cssText = `
    position: fixed;
    top: 12px;
    left: calc(50% - ${PANEL_WIDTH / 2}px);
    transform: translateX(-50%);
    background: #3D6FA9;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-family: Inter, -apple-system, sans-serif;
    font-size: 12px;
    font-weight: 500;
    z-index: 2147483646;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    white-space: nowrap;
  `;
  banner.innerHTML = `📍 Click anywhere to place a hotspot &nbsp;<span style="background:rgba(255,255,255,0.2);padding:2px 7px;border-radius:10px;font-size:11px;">Esc to cancel</span>`;
  document.body.appendChild(banner);
}

function exitHotspotMode() {
  hotspotMode = false;
  document.body.style.cursor = '';
  shadow.getElementById('btn-hotspot')?.classList.remove('active');
  document.getElementById('oer-hotspot-banner')?.remove();
}

function showHotspotPopup(anchor: PointAnchor, clientX: number, clientY: number) {
  pendingHotspotAnchor = anchor;

  const criteriaCheckboxes = rubricItems.map(item => {
    const code = item.label.split(' · ')[0] ?? item.label;
    return `<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:11px;cursor:pointer;border-radius:3px;user-select:none;" onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" class="oer-crit-check" value="${item.id}" style="cursor:pointer;flex-shrink:0;"> ${code}
    </label>`;
  }).join('');

  annotationPopup.style.position = 'fixed';
  annotationPopup.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
      <svg width="14" height="14" viewBox="0 0 28 36" fill="#3D6FA9"><path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z"/></svg>
      <span style="font-size:12px;font-weight:600;color:#2d3748;">Hotspot Annotation</span>
    </div>

    <div style="margin-bottom:8px;">
      <label style="display:block;font-size:11px;font-weight:600;color:#4a5568;margin-bottom:4px;">Criteria <span style="font-weight:400;color:#a0aec0;">(select all that apply)</span></label>
      <div style="max-height:100px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px;padding:2px 2px;">
        ${criteriaCheckboxes || '<span style="font-size:11px;color:#a0aec0;padding:4px 6px;display:block;">No criteria available</span>'}
      </div>
      <div style="font-size:10px;color:#a0aec0;margin-top:3px;">Leave unchecked to save as a general note</div>
    </div>

    <div style="margin-bottom:10px;">
      <label style="display:block;font-size:11px;font-weight:600;color:#4a5568;margin-bottom:4px;">Note</label>
      <textarea id="oer-pop-body" rows="3" placeholder="Describe this hotspot…" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;resize:none;font-family:inherit;color:#1a202c;box-sizing:border-box;outline:none;"></textarea>
    </div>

    <div style="display:flex;gap:8px;">
      <button id="oer-pop-cancel" style="flex:1;padding:7px;border-radius:6px;border:1px solid #e2e8f0;background:#f7fafc;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;color:#4a5568;">Cancel</button>
      <button id="oer-pop-save" style="flex:1;padding:7px;border-radius:6px;border:none;background:#3D6FA9;color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Save Hotspot</button>
    </div>
  `;

  annotationPopup.querySelector('#oer-pop-cancel')?.addEventListener('click', () => {
    hideAnnotationPopup();
    exitHotspotMode();
  });

  annotationPopup.querySelector('#oer-pop-save')?.addEventListener('click', async () => {
    if (!pendingHotspotAnchor) return;
    const checkedCriteria = [...annotationPopup.querySelectorAll<HTMLInputElement>('.oer-crit-check:checked')]
      .map(cb => cb.value);
    const body = (annotationPopup.querySelector('#oer-pop-body') as HTMLTextAreaElement).value.trim();
    if (!body) {
      (annotationPopup.querySelector('#oer-pop-body') as HTMLTextAreaElement).style.borderColor = '#fc8181';
      return;
    }
    const savedAnchor: PointAnchor = {
      ...pendingHotspotAnchor,
      pageName: document.title,
    };
    hideAnnotationPopup();
    exitHotspotMode();

    const savedAnns: AnnotationRecord[] = [];
    if (checkedCriteria.length === 0) {
      const a = await saveAnnotation(null, body, null, savedAnchor);
      if (a) savedAnns.push(a);
    } else {
      for (const criterionId of checkedCriteria) {
        const a = await saveAnnotation(criterionId, body, null, savedAnchor);
        if (a) savedAnns.push(a);
      }
    }

    // Screenshot after hotspot marker is placed in the DOM.
    setTimeout(() => attachScreenshotToAnnotations(savedAnns), 200);
  });

  // Position near click, keep within viewport
  const popupW = 300;
  const popupH = 280;
  let left = clientX + 12;
  let top = clientY - popupH / 2;
  if (left + popupW > window.innerWidth - PANEL_WIDTH - 8) left = clientX - popupW - 12;
  top = Math.max(8, Math.min(top, window.innerHeight - popupH - 8));
  annotationPopup.style.top = `${top}px`;
  annotationPopup.style.left = `${Math.max(8, left)}px`;
  annotationPopup.style.display = 'block';

  setTimeout(() => {
    (annotationPopup.querySelector('#oer-pop-body') as HTMLTextAreaElement)?.focus();
  }, 0);
}

function handleMouseUp(e: MouseEvent) {
  if (!selectedReview) return;

  const target = e.target as HTMLElement;
  if (target.closest('#oer-ann-popup') || target.closest('#oer-review-host')) return;

  if (annotationPopup.style.display !== 'none') {
    if (!target.closest('#oer-ann-popup')) hideAnnotationPopup();
    return;
  }

  if (hotspotMode) {
    if (target.classList.contains('oer-hotspot-marker') || target.closest('.oer-hotspot-marker')) return;
    const anchor: PointAnchor = {
      type: 'point',
      pageX: e.pageX,
      pageY: e.pageY,
      relX: e.pageX / document.documentElement.scrollWidth,
      relY: e.pageY / document.documentElement.scrollHeight,
      pageUrl: window.location.href,
    };
    showHotspotPopup(anchor, e.clientX, e.clientY);
    return;
  }

  setTimeout(() => {
    const anchor = selectionToAnchor();
    if (anchor) showAnnotationPopup(anchor);
  }, 0);
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
      right: 20px;
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

  // A document can have several independent per-rubric reviews assigned to the
  // same reviewer — surface them as tabs instead of only ever showing the one
  // the extension happened to land on.
  const siblingReviews = assignments.filter(a => a.document_id === selectedReview!.document_id);
  const rubricTabsHtml = siblingReviews.length > 1
    ? `
      <div class="rubric-tabs" id="rubric-tabs">
        ${siblingReviews.map(sib => `
          <button
            class="rubric-tab${sib.id === selectedReview!.id ? ' active' : ''}"
            data-review-id="${sib.id}"
          >${escHtml(sib.rubrics?.title ?? 'Untitled rubric')}</button>
        `).join('')}
      </div>
    `
    : '';

  panelBody.innerHTML = `
    <div class="rubric-header">
      <div style="flex:1;min-width:0;">
        <div class="doc-title">${escHtml(selectedReview.documents?.title ?? 'Untitled')}</div>
        <div class="rubric-name">${escHtml(selectedReview.rubrics?.title ?? '')}</div>
      </div>
      <a class="btn-open-console" id="btn-open-console" href="${OERHUB_URL}/review?document=${selectedReview.document_id}&review=${selectedReview.id}" target="_blank" title="Open review console with snapshots and rubric grading">↗ Console</a>
      <button class="switch-btn" id="btn-switch-review" title="Switch review">⇄</button>
    </div>

    ${rubricTabsHtml}

    <div class="completion-bar">
      <div class="completion-track">
        <div class="completion-fill" id="completion-fill" style="width:0%"></div>
      </div>
      <span class="completion-text" id="completion-text">0/${rubricItems.length}</span>
    </div>

    <div class="criterion-list" id="criterion-list"></div>

    <div style="padding:12px 16px;border-top:1px solid #f0f4f8;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <p class="section-label">General Notes</p>
        <button class="add-note-btn" id="btn-add-general-note">+ Add Note</button>
      </div>
      <div class="ann-list" id="ann-list-__free__"></div>
      <div id="general-note-form" style="display:none;margin-top:8px;">
        <textarea class="inline-note-input" id="general-note-input" rows="3" placeholder="Add a general note…"></textarea>
        <div class="inline-note-actions">
          <button class="inline-note-cancel" id="btn-cancel-general-note">Cancel</button>
          <button class="inline-note-save" id="btn-save-general-note">Save Note</button>
        </div>
      </div>
    </div>
  `;

  completionFill = shadow.getElementById('completion-fill') as HTMLElement;
  completionText = shadow.getElementById('completion-text') as HTMLElement;

  shadow.getElementById('btn-switch-review')?.addEventListener('click', () => {
    selectedReview = null;
    sessionStorage.removeItem(SESSION_KEY);
    renderContent('select-review');
  });

  shadow.querySelectorAll<HTMLButtonElement>('.rubric-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.reviewId!;
      if (targetId !== selectedReview?.id) selectReview(targetId);
    });
  });

  shadow.getElementById('btn-add-general-note')?.addEventListener('click', () => {
    const form = shadow.getElementById('general-note-form')!;
    form.style.display = 'block';
    shadow.getElementById('btn-add-general-note')!.style.display = 'none';
    (shadow.getElementById('general-note-input') as HTMLTextAreaElement)?.focus();
  });

  shadow.getElementById('btn-cancel-general-note')?.addEventListener('click', () => {
    shadow.getElementById('general-note-form')!.style.display = 'none';
    (shadow.getElementById('general-note-input') as HTMLTextAreaElement).value = '';
    shadow.getElementById('btn-add-general-note')!.style.display = '';
  });

  shadow.getElementById('btn-save-general-note')?.addEventListener('click', async () => {
    const input = shadow.getElementById('general-note-input') as HTMLTextAreaElement;
    const body = input?.value.trim() ?? '';
    if (!body) { if (input) input.style.borderColor = '#fc8181'; return; }
    input.style.borderColor = '#e2e8f0';
    shadow.getElementById('general-note-form')!.style.display = 'none';
    input.value = '';
    shadow.getElementById('btn-add-general-note')!.style.display = '';
    const anchor: BboxAnchor = { type: 'bbox', x: 0, y: 0, width: 0, height: 0, pageUrl: window.location.href };
    await saveAnnotation(null, body, null, anchor);
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
    const selectedLevels = score?.criterion_scores ?? [];
    const badgeClass = selectedLevels.length === 0 ? 'unscored'
      : selectedLevels.length === 1 ? selectedLevels[0]
      : 'multi';
    const badgeText = selectedLevels.length === 0 ? '—'
      : selectedLevels.length === 1 ? SCORE_ABBR[selectedLevels[0]]
      : selectedLevels.map(l => SCORE_ABBR[l]).join('+');
    const annCount = annotations.filter(a => a.rubric_item_id === item.id).length;
    const savedComments = scoreComments.get(item.id) ?? EMPTY_SCORE_COMMENTS;

    return `
      <div class="criterion-item">
        <div class="criterion-hd" data-id="${item.id}">
          <span class="expand-icon" id="expand-${item.id}">▶</span>
          <span class="crit-code">${escHtml(code)}</span>
          <span class="crit-name">${escHtml(name)}</span>
          ${annCount > 0 ? `<span class="ann-count">${annCount}</span>` : ''}
          <span class="score-badge ${badgeClass}" id="badge-${item.id}">${escHtml(badgeText)}</span>
        </div>
        <div class="criterion-bd" id="crit-body-${item.id}">
          <div class="crit-desc">${escHtml(item.description.slice(0, 200))}${item.description.length > 200 ? '…' : ''}</div>
          <div class="score-btns">
            ${((['does_not_meet', 'exemplifies', 'exceeds'] as CriterionScore[])).map(lvl => `
              <button class="score-btn ${selectedLevels.includes(lvl) ? `active ${lvl}` : ''}" data-level="${lvl}" data-item="${item.id}">
                ${SCORE_LABELS[lvl]}
              </button>
            `).join('')}
          </div>
          <div class="score-comment-box score-comment-dnm" id="score-comment-does_not_meet-${item.id}" style="display:${selectedLevels.includes('does_not_meet') ? 'block' : 'none'};">
            <div class="score-comment-label">Why does this not meet the standard? <span class="score-comment-required">required</span></div>
            <textarea class="score-comment-input" data-item="${item.id}" data-level="does_not_meet" rows="2" placeholder="Describe what's missing or needs improvement…">${escHtml(savedComments.does_not_meet.body)}</textarea>
          </div>
          <div class="score-comment-box score-comment-exc" id="score-comment-exceeds-${item.id}" style="display:${selectedLevels.includes('exceeds') ? 'block' : 'none'};">
            <div class="score-comment-label">Why does this exceed the standard? <span class="score-comment-required">required</span></div>
            <textarea class="score-comment-input" data-item="${item.id}" data-level="exceeds" rows="2" placeholder="Describe what makes this exemplary…">${escHtml(savedComments.exceeds.body)}</textarea>
          </div>
          <div class="ann-section-label">Annotations</div>
          <div class="ann-list" id="ann-list-${item.id}"></div>
          <button class="add-crit-comment-btn" data-item="${item.id}">+ Add Comment</button>
          <div class="crit-comment-form" id="crit-comment-form-${item.id}" style="display:none;">
            <textarea class="inline-note-input" id="crit-comment-input-${item.id}" rows="2" placeholder="Add a comment…"></textarea>
            <div class="inline-note-actions">
              <button class="inline-note-cancel crit-comment-cancel" data-item="${item.id}">Cancel</button>
              <button class="inline-note-save crit-comment-save" data-item="${item.id}">Save</button>
            </div>
          </div>
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
      saveExpandedCriteria();
    });
  });

  // Score buttons
  list.querySelectorAll<HTMLButtonElement>('.score-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleScore(btn.dataset.item!, btn.dataset.level as CriterionScore);
    });
  });

  // Add Comment buttons
  list.querySelectorAll<HTMLButtonElement>('.add-crit-comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.item!;
      const form = shadow.getElementById(`crit-comment-form-${itemId}`)!;
      const isOpen = form.style.display !== 'none';
      form.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        (shadow.getElementById(`crit-comment-input-${itemId}`) as HTMLTextAreaElement)?.focus();
      }
    });
  });

  list.querySelectorAll<HTMLButtonElement>('.crit-comment-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.item!;
      shadow.getElementById(`crit-comment-form-${itemId}`)!.style.display = 'none';
      const input = shadow.getElementById(`crit-comment-input-${itemId}`) as HTMLTextAreaElement;
      if (input) { input.value = ''; input.style.borderColor = '#e2e8f0'; }
    });
  });

  list.querySelectorAll<HTMLButtonElement>('.crit-comment-save').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.item!;
      const input = shadow.getElementById(`crit-comment-input-${itemId}`) as HTMLTextAreaElement;
      const body = input?.value.trim() ?? '';
      if (!body) { if (input) input.style.borderColor = '#fc8181'; return; }
      input.style.borderColor = '#e2e8f0';
      shadow.getElementById(`crit-comment-form-${itemId}`)!.style.display = 'none';
      input.value = '';
      const anchor: BboxAnchor = { type: 'bbox', x: 0, y: 0, width: 0, height: 0 };
      await saveAnnotation(itemId, body, null, anchor);
    });
  });

  // Score comment inputs (required when Does Not Meet or Exceeds is selected)
  list.querySelectorAll<HTMLTextAreaElement>('.score-comment-input').forEach(ta => {
    ta.addEventListener('input', () => {
      const itemId = ta.dataset.item!;
      const level = ta.dataset.level as 'does_not_meet' | 'exceeds';
      const prev = scoreComments.get(itemId) ?? EMPTY_SCORE_COMMENTS;
      scoreComments.set(itemId, { ...prev, [level]: { id: prev[level].id, body: ta.value } });
      updateCompletion();
      setSaveStatus('saving');
      const existing = scoreTimers.get(itemId);
      if (existing) clearTimeout(existing);
      scoreTimers.set(itemId, setTimeout(() => flushScore(itemId), SCORE_DEBOUNCE_MS));
    });
  });

  // Restore which criterion accordions were expanded before this render
  // (e.g. after a reload/navigation, or a full re-render triggered by delete).
  const expanded = new Set(loadExpandedCriteria());
  rubricItems.forEach(item => {
    if (!expanded.has(item.id)) return;
    const body = shadow.getElementById(`crit-body-${item.id}`);
    const icon = shadow.getElementById(`expand-${item.id}`);
    if (!body) return;
    body.classList.add('open');
    if (icon) icon.textContent = '▼';
    refreshAnnotationList(item.id);
  });
}

// ── Persisted UI state (survives page reload / same-tab navigation) ───────────

function saveExpandedCriteria() {
  const openIds = Array.from(shadow.querySelectorAll('.criterion-bd.open'))
    .map(el => el.id.replace('crit-body-', ''));
  try { sessionStorage.setItem(EXPANDED_CRIT_KEY, JSON.stringify(openIds)); } catch { /* storage unavailable */ }
}

function loadExpandedCriteria(): string[] {
  try {
    const raw = sessionStorage.getItem(EXPANDED_CRIT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

interface PanelGeometry {
  left: number | null;
  top: number;
  right: number | null;
  width: number;
  height: number;
  collapsed: boolean;
}

function savePanelGeometry() {
  if (!panelHost || !shadow) return;
  const panel = shadow.querySelector('.panel');
  const collapsed = panel?.classList.contains('collapsed') ?? false;
  const rect = panelHost.getBoundingClientRect();
  const usesLeft = panelHost.style.left !== '' && panelHost.style.left !== 'auto';
  const geom: PanelGeometry = {
    left: usesLeft ? rect.left : null,
    top: rect.top,
    right: usesLeft ? null : window.innerWidth - rect.right,
    width: rect.width,
    height: collapsed ? savedPanelH : rect.height,
    collapsed,
  };
  try { sessionStorage.setItem(PANEL_GEOM_KEY, JSON.stringify(geom)); } catch { /* storage unavailable */ }
}

function loadPanelGeometry(): PanelGeometry | null {
  try {
    const raw = sessionStorage.getItem(PANEL_GEOM_KEY);
    return raw ? (JSON.parse(raw) as PanelGeometry) : null;
  } catch { return null; }
}

// ── Panel creation ────────────────────────────────────────────────────────────

function createPanel() {
  const host = document.createElement('div');
  host.id = 'oer-review-host';
  panelHost = host;
  const defaultW = PANEL_WIDTH;
  const defaultH = 560;
  const initRight = 16;
  const initTop = 16;

  // Restore prior position/size so reloading or navigating the OLI Torus page
  // doesn't reset the console back to its default corner and dimensions.
  const savedGeom = loadPanelGeometry();
  const startW = savedGeom?.width ?? defaultW;
  const expandedH = savedGeom?.height ?? defaultH;
  const startH = savedGeom?.collapsed ? defaultH : expandedH;
  savedPanelH = expandedH; // height to restore to when un-collapsing

  host.style.cssText = `
    position: fixed !important;
    top: ${savedGeom?.top ?? initTop}px !important;
    ${savedGeom?.left != null
      ? `left: ${savedGeom.left}px !important;`
      : `right: ${savedGeom?.right ?? initRight}px !important;`}
    width: ${startW}px !important;
    height: ${startH}px !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
    overflow: visible !important;
    border-radius: 12px !important;
  `;

  shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      :host { display: block; }

      .panel {
        width: 100%;
        height: 100%;
        background: #fff;
        border: 1px solid #c8d5e3;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        color: #1a202c;
        box-shadow: 0 8px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08);
        overflow: hidden;
      }
      .panel.collapsed .panel-body { display: none; }
      .panel.collapsed .panel-ft   { display: none; }

      .panel-hd {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: #3D6FA9;
        color: #fff;
        flex-shrink: 0;
        gap: 8px;
        cursor: grab;
        border-radius: 11px 11px 0 0;
        user-select: none;
      }
      .panel-hd.dragging { cursor: grabbing; }

      /* Resize handles — positioned relative to :host */
      .resize-handle {
        position: absolute;
        z-index: 10;
      }
      .rh-n  { top: -5px; left: 12px; right: 12px; height: 10px; cursor: n-resize; }
      .rh-s  { bottom: -5px; left: 12px; right: 12px; height: 10px; cursor: s-resize; }
      .rh-e  { right: -5px; top: 12px; bottom: 12px; width: 10px; cursor: e-resize; }
      .rh-w  { left: -5px; top: 12px; bottom: 12px; width: 10px; cursor: w-resize; }
      .rh-ne { top: -5px; right: -5px; width: 16px; height: 16px; cursor: ne-resize; }
      .rh-nw { top: -5px; left: -5px; width: 16px; height: 16px; cursor: nw-resize; }
      .rh-se { bottom: -5px; right: -5px; width: 16px; height: 16px; cursor: se-resize; }
      .rh-sw { bottom: -5px; left: -5px; width: 16px; height: 16px; cursor: sw-resize; }

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

      .rubric-tabs { display: flex; gap: 2px; padding: 0 10px; background: #f7fafc; border-bottom: 1px solid #e2e8f0; overflow-x: auto; flex-shrink: 0; }
      .rubric-tab {
        background: none; border: none; border-bottom: 2px solid transparent;
        padding: 7px 10px; font-size: 11px; font-weight: 600; color: #718096;
        cursor: pointer; white-space: nowrap; font-family: inherit; transition: color 0.15s, border-color 0.15s;
      }
      .rubric-tab:hover { color: #3D6FA9; }
      .rubric-tab.active { color: #3D6FA9; border-bottom-color: #3D6FA9; }

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

      .score-badge.multi { background: #e2e8f0; color: #2d3748; }

      .score-comment-box { margin: 4px 0 8px; padding: 8px 10px; border-radius: 6px; border: 1.5px solid #e2e8f0; }
      .score-comment-dnm { background: #fff5f5; border-color: #fc8181; }
      .score-comment-exc { background: #fffaf5; border-color: #fdba74; }
      .score-comment-label { font-size: 11px; font-weight: 600; color: #4a5568; margin-bottom: 4px; }
      .score-comment-required { font-size: 10px; font-weight: 500; color: #e53e3e; margin-left: 3px; }
      .score-comment-input { width: 100%; padding: 5px 7px; border: 1px solid #e2e8f0; border-radius: 5px; font-size: 12px; resize: none; font-family: inherit; color: #1a202c; box-sizing: border-box; outline: none; background: #fff; }
      .score-comment-input:focus { border-color: #3D6FA9; box-shadow: 0 0 0 2px rgba(61,111,169,0.12); }

      .btn-open-console { display: flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 5px; border: 1px solid #e2e8f0; background: #f7fafc; color: #3D6FA9; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; text-decoration: none; flex-shrink: 0; }
      .btn-open-console:hover { background: #ebf4ff; border-color: #3D6FA9; }

      .ann-section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #a0aec0; margin-bottom: 6px; }

      .ann-list { display: flex; flex-direction: column; gap: 5px; }
      .ann-item { position: relative; background: #f7fafc; border: 1px solid #e8edf2; border-radius: 6px; padding: 7px 28px 9px 9px; font-size: 12px; color: #4a5568; line-height: 1.4; }
      .ann-item.highlighted { background: #fffbeb; border-color: #fbbf24; }
      .ann-quote { font-style: italic; color: #a0aec0; font-size: 11px; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ann-body { }
      .ann-tag { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 3px; margin-top: 4px; text-transform: uppercase; }
      .ann-tag.action_item { background: #fed7aa; color: #c2410c; }
      .ann-tag.quick_fix   { background: #bfdbfe; color: #1d4ed8; }

      .screenshot-thumb { width: 100%; height: 56px; object-fit: cover; border-radius: 4px; margin-bottom: 3px; border: 1px solid #e2e8f0; display: block; }

      .add-note-btn { background: none; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px; font-weight: 600; color: #a0aec0; cursor: pointer; padding: 2px 7px; font-family: inherit; transition: all 0.12s; }
      .add-note-btn:hover { border-color: #3D6FA9; color: #3D6FA9; }

      .inline-note-input { width: 100%; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; resize: none; font-family: inherit; color: #1a202c; box-sizing: border-box; outline: none; }
      .inline-note-input:focus { border-color: #3D6FA9; box-shadow: 0 0 0 2px rgba(61,111,169,0.12); }

      .inline-note-actions { display: flex; gap: 6px; margin-top: 4px; }
      .inline-note-cancel { flex: 1; padding: 5px; border-radius: 5px; border: 1px solid #e2e8f0; background: #f7fafc; font-size: 11px; cursor: pointer; font-family: inherit; color: #4a5568; }
      .inline-note-save { flex: 1; padding: 5px; border-radius: 5px; border: none; background: #3D6FA9; color: white; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }

      .add-crit-comment-btn { margin-top: 8px; background: none; border: 1px dashed #e2e8f0; border-radius: 5px; font-size: 11px; font-weight: 500; color: #a0aec0; cursor: pointer; padding: 5px; width: 100%; font-family: inherit; transition: all 0.12s; }
      .add-crit-comment-btn:hover { border-color: #3D6FA9; color: #3D6FA9; border-style: solid; }
      .crit-comment-form { margin-top: 6px; }

      .btn-hotspot { display: flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 6px; border: 1px solid #e2e8f0; background: #f7fafc; color: #4a5568; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
      .btn-hotspot:hover { background: #edf2f7; border-color: #cbd5e0; }
      .btn-hotspot.active { background: #ebf4ff; border-color: #3D6FA9; color: #3D6FA9; }

      .ann-page-label { font-size: 10px; color: #a0aec0; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ann-goto { display: inline-flex; align-items: center; gap: 3px; margin-top: 5px; padding: 3px 7px; border-radius: 4px; border: 1px solid #3D6FA9; background: none; color: #3D6FA9; font-size: 10px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.12s; }
      .ann-goto:hover { background: #3D6FA9; color: white; }

      .ann-edit { position: absolute; top: 5px; right: 22px; background: none; border: none; cursor: pointer; color: #cbd5e0; font-size: 13px; line-height: 1; padding: 2px 3px; border-radius: 3px; display: none; font-family: inherit; }
      .ann-item:hover .ann-edit { display: block; }
      .ann-edit:hover { color: #3D6FA9; }
      .ann-delete { position: absolute; top: 5px; right: 5px; background: none; border: none; cursor: pointer; color: #cbd5e0; font-size: 15px; line-height: 1; padding: 2px; border-radius: 3px; display: none; font-family: inherit; }
      .ann-item:hover .ann-delete { display: block; }
      .ann-delete:hover { color: #e53e3e; }

      .ann-edit-input { width: 100%; padding: 5px 7px; border: 1px solid #3D6FA9; border-radius: 5px; font-size: 12px; resize: none; font-family: inherit; color: #1a202c; box-sizing: border-box; outline: none; }
      .ann-edit-cancel { flex: 1; padding: 4px; border-radius: 4px; border: 1px solid #e2e8f0; background: #f7fafc; font-size: 11px; cursor: pointer; font-family: inherit; color: #4a5568; }
      .ann-edit-confirm { flex: 1; padding: 4px; border-radius: 4px; border: none; background: #3D6FA9; color: white; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }

      .ann-hotspot-label { font-size: 10px; font-weight: 600; color: #3D6FA9; margin-bottom: 3px; }
    </style>

    <div class="panel">
      <div class="panel-hd" id="panel-hd">
        <div class="logo">
          <div class="logo-dot"></div>
          OER Review
        </div>
        <button class="hd-btn" id="btn-min" title="Collapse">−</button>
      </div>

      <div class="panel-body" id="panel-body"></div>

      <div class="panel-ft">
        <div style="display:flex;gap:5px;flex:1;">
          <button class="btn-hotspot" id="btn-hotspot">
            <svg width="12" height="15" viewBox="0 0 28 36" fill="currentColor">
              <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z"/>
            </svg>
            Hotspot
          </button>
        </div>
        <span class="save-status" id="save-status"></span>
      </div>
    </div>

    <!-- Resize handles (positioned relative to :host) -->
    <div class="resize-handle rh-n"  data-dir="n"></div>
    <div class="resize-handle rh-s"  data-dir="s"></div>
    <div class="resize-handle rh-e"  data-dir="e"></div>
    <div class="resize-handle rh-w"  data-dir="w"></div>
    <div class="resize-handle rh-ne" data-dir="ne"></div>
    <div class="resize-handle rh-nw" data-dir="nw"></div>
    <div class="resize-handle rh-se" data-dir="se"></div>
    <div class="resize-handle rh-sw" data-dir="sw"></div>
  `;

  document.body.appendChild(host);

  panelBody = shadow.getElementById('panel-body') as HTMLElement;
  saveStatusEl = shadow.getElementById('save-status') as HTMLElement;

  // Re-apply the collapsed state now that the shadow DOM (and its .panel
  // element) actually exists.
  if (savedGeom?.collapsed) {
    const panel = shadow.querySelector('.panel');
    const minBtn = shadow.getElementById('btn-min') as HTMLButtonElement | null;
    panel?.classList.add('collapsed');
    host.style.height = 'auto';
    if (minBtn) minBtn.textContent = '+';
  }

  // ── Minimize / collapse ──────────────────────────────────────────────────────
  shadow.getElementById('btn-min')?.addEventListener('click', () => {
    const panel = shadow.querySelector('.panel')!;
    const willCollapse = !panel.classList.contains('collapsed');
    const btn = shadow.getElementById('btn-min') as HTMLButtonElement;
    if (willCollapse) {
      savedPanelH = host.offsetHeight;
      panel.classList.add('collapsed');
      host.style.height = 'auto';
      if (btn) btn.textContent = '+';
    } else {
      panel.classList.remove('collapsed');
      host.style.height = `${savedPanelH}px`;
      if (btn) btn.textContent = '−';
    }
    savePanelGeometry();
  });

  shadow.getElementById('btn-hotspot')?.addEventListener('click', () => {
    if (!selectedReview) { showToast('Select a review first'); return; }
    if (hotspotMode) { exitHotspotMode(); } else { enterHotspotMode(); }
  });

  // ── Drag to move (header) ────────────────────────────────────────────────────
  const hd = shadow.getElementById('panel-hd')!;
  hd.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // don't drag on buttons
    isDragging = true;
    const rect = host.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    hd.classList.add('dragging');
    e.preventDefault();
  });

  // ── Resize handles ───────────────────────────────────────────────────────────
  shadow.querySelectorAll<HTMLElement>('.resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e: MouseEvent) => {
      isResizing = true;
      resizeDir = handle.dataset.dir as ResizeDir;
      const rect = host.getBoundingClientRect();
      resizeSt = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height, l: rect.left, t: rect.top };
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // ── Global mousemove / mouseup ───────────────────────────────────────────────
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (isDragging) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      let l = e.clientX - dragOffset.x;
      let t = e.clientY - dragOffset.y;
      l = Math.max(0, Math.min(l, vw - w));
      t = Math.max(0, Math.min(t, vh - 40));
      host.style.left  = `${l}px`;
      host.style.top   = `${t}px`;
      host.style.right = 'auto';
    }
    if (isResizing && resizeDir) {
      const dx = e.clientX - resizeSt.x;
      const dy = e.clientY - resizeSt.y;
      let w = resizeSt.w, h = resizeSt.h, l = resizeSt.l, t = resizeSt.t;
      const maxH = window.innerHeight - 16;

      if (resizeDir.includes('e')) w = Math.max(MIN_PANEL_W, resizeSt.w + dx);
      if (resizeDir.includes('s')) h = Math.max(MIN_PANEL_H, Math.min(maxH, resizeSt.h + dy));
      if (resizeDir.includes('w')) {
        const clamped = Math.max(MIN_PANEL_W, resizeSt.w - dx);
        l = resizeSt.l + (resizeSt.w - clamped);
        w = clamped;
      }
      if (resizeDir.includes('n')) {
        const clamped = Math.max(MIN_PANEL_H, Math.min(maxH, resizeSt.h - dy));
        t = resizeSt.t + (resizeSt.h - clamped);
        h = clamped;
      }

      host.style.width  = `${w}px`;
      host.style.height = `${h}px`;
      host.style.left   = `${l}px`;
      host.style.top    = `${t}px`;
      host.style.right  = 'auto';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      hd.classList.remove('dragging');
      savePanelGeometry();
    }
    if (isResizing) {
      isResizing = false;
      resizeDir = null;
      document.body.style.userSelect = '';
      savePanelGeometry();
    }
  });
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

  const [itemsResp, annResp, scoresResp, scoreCommentsResp] = await Promise.all([
    send<RubricItem[]>({ type: 'GET_RUBRIC_ITEMS', payload: { rubricId: review.rubric_id } }),
    send<AnnotationRecord[]>({ type: 'GET_ANNOTATIONS', payload: { reviewId } }),
    send<ReviewScoreRecord[]>({ type: 'GET_SCORES', payload: { reviewId } }),
    send<ScoreCommentRecord[]>({ type: 'GET_SCORE_COMMENTS', payload: { reviewId } }),
  ]);

  rubricItems = itemsResp.data ?? [];
  annotations = annResp.data ?? [];
  scores.clear();
  scoreComments.clear();
  (scoresResp.data ?? []).forEach(s => scores.set(s.rubric_item_id, s));
  // One comment per (item, level) surfaced here, same simplification the web app's
  // RatingBox uses (comments?.[0]) — first by created_at wins if more than one exists.
  (scoreCommentsResp.data ?? []).forEach(c => {
    const prev = scoreComments.get(c.rubric_item_id) ?? EMPTY_SCORE_COMMENTS;
    if (prev[c.score_level].id) return;
    scoreComments.set(c.rubric_item_id, { ...prev, [c.score_level]: { id: c.id, body: c.body } });
  });

  renderContent('review');
  applyHighlights();
  scheduleHighlightRetries();
  checkPendingAnnotationNavigation();
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
  createAnnotationTooltip();

  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') {
      hideAnnotationPopup();
      exitHotspotMode();
    }
  });

  // Re-apply all highlights and hotspot markers when Torus navigates (SPA routing).
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = (...args) => { origPush(...args); scheduleHighlightRetries(); };
  history.replaceState = (...args) => { origReplace(...args); scheduleHighlightRetries(); };
  window.addEventListener('popstate', scheduleHighlightRetries);

  // Let the popup query current state
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'GET_CURRENT_REVIEW') {
      sendResponse({ success: true, data: selectedReview });
    }
    return false;
  });

  // ── Auto-login from platform deep link ───────────────────────────────────────
  // When the dashboard opens Torus with ?oer_token=, decode and store auth so
  // the reviewer never sees the login form.
  const urlParams = new URLSearchParams(window.location.search);
  const rawToken = urlParams.get('oer_token');
  if (rawToken) {
    try {
      const auth = JSON.parse(decodeURIComponent(atob(rawToken))) as StoredAuth;
      if (auth.access_token && auth.user_id) {
        await new Promise<void>(resolve => chrome.storage.local.set({ auth }, resolve));
        // Remove the token from browser history so it isn't exposed in the URL bar
        urlParams.delete('oer_token');
        const clean = window.location.pathname
          + (urlParams.toString() ? '?' + urlParams.toString() : '')
          + window.location.hash;
        window.history.replaceState({}, '', clean);
      }
    } catch { /* malformed token — fall through to normal auth */ }
  }

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

  // Auto-select review from URL param (deep link from dashboard)
  const urlReviewId = new URLSearchParams(window.location.search).get('oer_review_id');
  if (urlReviewId && assignments.some(a => a.id === urlReviewId)) {
    await selectReview(urlReviewId);
    return;
  }

  // Restore previously selected review from session storage
  const savedId = sessionStorage.getItem(SESSION_KEY);
  if (savedId && assignments.some(a => a.id === savedId)) {
    await selectReview(savedId);
    return;
  }

  renderContent(assignments.length === 0 ? 'no-assignments' : 'select-review');
}

init();
