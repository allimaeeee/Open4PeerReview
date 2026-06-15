'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { HighlightTag } from '@/types'
import type { ReviewEventType } from '@/hooks/useReviewTracking'
import type { Json } from '@/types/database.types'
import { selectionToAnchor, applyHighlights } from '@/lib/anchoring/html'

// ── Public types ──────────────────────────────────────────────────────────────

export interface HtmlTextSelection {
  type: 'html'
  text: string
  start: number
  end: number
  pageIndex: number
}

export interface AnnotationConfirmPayload {
  body: string
  rubricItemIds: string[]
  tag: HighlightTag | null
}

export interface SavedAnnotation {
  id: string
  rubricItemId: string | null
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TAG_OPTIONS: { value: HighlightTag; label: string; bg: string; text: string; ring: string }[] = [
  { value: 'action_item', label: 'Action Item', bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-400' },
  { value: 'quick_fix',   label: 'Quick Fix',   bg: 'bg-blue-50',   text: 'text-blue-700',  ring: 'ring-blue-400' },
]

interface TooltipPos { x: number; y: number }

interface OERPage {
  fingerprint: string | null
  url?: string
}

interface HtmlViewerCanvasProps {
  snapshotSrc: string
  additionalPages?: OERPage[]
  rubricItems: { id: string; label: string }[]
  activeItemId: string | null
  pendingSelection: HtmlTextSelection | null
  savedAnnotations: SavedAnnotation[]
  focusAnnotationId?: string | null
  onTextSelected: (sel: HtmlTextSelection) => void
  onAnnotationConfirm: (payload: AnnotationConfirmPayload) => Promise<string | null | undefined>
  onPendingSelectionClear: () => void
  onAnnotationEdit: (id: string, changes: { body: string; tag: HighlightTag | null }) => Promise<void>
  onAnnotationDelete: (id: string) => Promise<void>
  onTrackEvent: (type: ReviewEventType, data?: Json) => void
  disabled: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HtmlViewerCanvas({
  snapshotSrc,
  additionalPages = [],
  rubricItems,
  activeItemId,
  pendingSelection,
  savedAnnotations,
  focusAnnotationId,
  onTextSelected,
  onAnnotationConfirm,
  onPendingSelectionClear,
  onAnnotationEdit,
  onAnnotationDelete,
  onTrackEvent,
  disabled,
}: HtmlViewerCanvasProps) {

  // Include all pages that have either a URL or fingerprint
  const validAdditionalPages = additionalPages.filter(p => p.url || p.fingerprint)
  const totalPages = 1 + validAdditionalPages.length
  const [currentPageIndex, setCurrentPageIndex] = useState(0)

  // Fingerprints resolved lazily for pages that were stored without one
  const [resolvedFingerprints, setResolvedFingerprints] = useState<Record<number, string>>({})
  const [snapshotting, setSnapshotting] = useState<Set<number>>(new Set())
  const [snapshotErrors, setSnapshotErrors] = useState<Record<number, string>>({})

  const getFingerprint = (idx: number): string | null => {
    if (idx === 0) return null  // primary page uses snapshotSrc directly
    const page = validAdditionalPages[idx - 1]
    return page?.fingerprint || resolvedFingerprints[idx] || null
  }

  // The snapshot URL for the currently active page
  const fp = getFingerprint(currentPageIndex)
  const activeSnapshotSrc = currentPageIndex === 0 ? snapshotSrc : fp ? `/api/snapshot/${fp}` : null

  // ── New-annotation tooltip state ───────────────────────────────────────────
  const [tooltipPos,        setTooltipPos]        = useState<TooltipPos | null>(null)
  const [annotationBody,    setAnnotationBody]    = useState('')
  const [selectedCriterions, setSelectedCriterions] = useState<string[]>([])
  const [selectedTag,       setSelectedTag]       = useState<HighlightTag | null>(null)
  const [saveError,         setSaveError]         = useState<string | null>(null)
  const [isSaving,          setIsSaving]          = useState(false)

  // ── Edit-popover state ─────────────────────────────────────────────────────
  const [editingAnnotation, setEditingAnnotation] = useState<SavedAnnotation | null>(null)
  const [editTooltipPos,    setEditTooltipPos]    = useState<TooltipPos | null>(null)
  const [editBody,          setEditBody]          = useState('')
  const [editTag,           setEditTag]           = useState<HighlightTag | null>(null)
  const [editSaving,        setEditSaving]        = useState(false)
  const [editDeleting,      setEditDeleting]      = useState(false)

  // ── Hover-tooltip state ────────────────────────────────────────────────────
  const [hoverAnnotation, setHoverAnnotation] = useState<SavedAnnotation | null>(null)
  const [hoverPos,        setHoverPos]        = useState<TooltipPos | null>(null)

  // True once the iframe has loaded and originalHtmlRef is populated
  const [iframeReady, setIframeReady] = useState(false)
  // Shown briefly when the user manages to trigger a navigation despite CSS
  const [navBannerVisible, setNavBannerVisible] = useState(false)

  // Reset iframe state when page changes
  useEffect(() => {
    setIframeReady(false)
    setTooltipPos(null)
    setEditingAnnotation(null)
    originalHtmlRef.current = null
    onPendingSelectionClear()
  // onPendingSelectionClear is intentionally excluded — stable enough and would loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageIndex])

  // Lazy-snapshot pages that were saved without a fingerprint
  useEffect(() => {
    if (currentPageIndex === 0) return
    const page = validAdditionalPages[currentPageIndex - 1]
    if (!page?.url || page.fingerprint || resolvedFingerprints[currentPageIndex] || snapshotting.has(currentPageIndex)) return

    setSnapshotting(prev => new Set(prev).add(currentPageIndex))
    setSnapshotErrors(prev => { const n = { ...prev }; delete n[currentPageIndex]; return n })

    fetch('/api/snapshot/page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: page.url }),
    })
      .then(res => res.ok ? res.json() : res.json().then(b => Promise.reject(b.error ?? 'Snapshot failed')))
      .then(({ fingerprint }: { fingerprint: string }) => {
        setResolvedFingerprints(prev => ({ ...prev, [currentPageIndex]: fingerprint }))
      })
      .catch((err: string) => {
        setSnapshotErrors(prev => ({ ...prev, [currentPageIndex]: err }))
      })
      .finally(() => {
        setSnapshotting(prev => { const n = new Set(prev); n.delete(currentPageIndex); return n })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageIndex])

  // ── Refs ───────────────────────────────────────────────────────────────────
  const containerRef    = useRef<HTMLDivElement>(null)
  const iframeRef       = useRef<HTMLIFrameElement>(null)
  const editPopoverRef  = useRef<HTMLDivElement>(null)
  const originalHtmlRef = useRef<string | null>(null)   // clean snapshot before any marks

  // Stable callback refs — updated every render so mark handlers never go stale
  const onMarkClickRef = useRef<(id: string, x: number, y: number) => void>(() => {})
  const onMarkHoverRef = useRef<(id: string | null, x: number, y: number) => void>(() => {})

  // ── Coord conversion: iframe viewport → container-relative ────────────────
  const iframeToContainer = useCallback((iframeX: number, iframeY: number): TooltipPos => {
    const iframe    = iframeRef.current
    const container = containerRef.current
    if (!iframe || !container) return { x: iframeX, y: iframeY }
    const ir = iframe.getBoundingClientRect()
    const cr = container.getBoundingClientRect()
    return { x: iframeX + ir.left - cr.left, y: iframeY + ir.top - cr.top }
  }, [])

  // ── Update stable refs every render ───────────────────────────────────────
  onMarkClickRef.current = (annId, clientX, clientY) => {
    if (disabled) return
    const ann = savedAnnotations.find(a => a.id === annId)
    if (!ann) return
    onPendingSelectionClear()
    setTooltipPos(null)
    setHoverAnnotation(null)
    setEditingAnnotation(ann)
    setEditBody(ann.body)
    setEditTag(ann.tag as HighlightTag | null)
    setEditTooltipPos(iframeToContainer(clientX, clientY))
  }

  onMarkHoverRef.current = (annId, clientX, clientY) => {
    if (annId === null) { setHoverAnnotation(null); return }
    if (editingAnnotation || pendingSelection) return
    const ann = savedAnnotations.find(a => a.id === annId)
    if (ann) { setHoverAnnotation(ann); setHoverPos(iframeToContainer(clientX, clientY)) }
  }

  // ── Re-inject highlights when annotations change or iframe first loads ───────
  useEffect(() => {
    if (!iframeReady) return
    const doc = iframeRef.current?.contentDocument
    if (!doc || originalHtmlRef.current === null) return

    // Preserve scroll position across DOM restoration
    const scrollX = doc.defaultView?.scrollX ?? 0
    const scrollY = doc.defaultView?.scrollY ?? 0

    doc.body.innerHTML = originalHtmlRef.current

    const htmlAnns = savedAnnotations
      .filter(a => {
        const anchor = a.anchor as any
        if (anchor?.type !== 'html-char-offset') return false
        // Only show highlights for annotations on the current page
        const annPage = anchor?.pageIndex ?? 0
        return annPage === currentPageIndex
      })
      .map(a => ({
        id:    a.id,
        start: (a.anchor as any).start as number,
        end:   (a.anchor as any).end   as number,
        tag:   a.tag,
        body:  a.body,
      }))

    if (htmlAnns.length > 0) {
      applyHighlights(
        doc,
        htmlAnns,
        (id, x, y) => onMarkClickRef.current(id, x, y),
        (id, x, y) => onMarkHoverRef.current(id, x, y),
      )
    }

    doc.defaultView?.scrollTo(scrollX, scrollY)
  }, [savedAnnotations, iframeReady, currentPageIndex])

  // ── Navigate to focused annotation: switch page if needed ────────────────
  useEffect(() => {
    if (!focusAnnotationId) return
    const ann = savedAnnotations.find(a => a.id === focusAnnotationId)
    if (!ann) return
    const targetPage = (ann.anchor as any)?.pageIndex ?? 0
    if (targetPage !== currentPageIndex) setCurrentPageIndex(targetPage)
  // Only re-run when the focused annotation changes, not on every page change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAnnotationId])

  // ── Scroll to and pulse the mark once the right page is loaded ───────────
  useEffect(() => {
    if (!focusAnnotationId || !iframeReady) return
    const ann = savedAnnotations.find(a => a.id === focusAnnotationId)
    if (!ann) return
    const targetPage = (ann.anchor as any)?.pageIndex ?? 0
    if (targetPage !== currentPageIndex) return  // still waiting for page switch

    // Marks are injected synchronously in the effect above; query after a tick
    const t = setTimeout(() => {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const mark = doc.querySelector(`[data-annotation-id="${focusAnnotationId}"]`) as HTMLElement | null
      if (!mark) return
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
      mark.style.outline = '3px solid rgba(234,179,8,0.7)'
      mark.style.outlineOffset = '2px'
      mark.style.borderRadius = '2px'
      setTimeout(() => { mark.style.outline = ''; mark.style.outlineOffset = '' }, 1500)
    }, 0)
    return () => clearTimeout(t)
  }, [focusAnnotationId, iframeReady, currentPageIndex, savedAnnotations])

  // ── Wire up iframe after load ──────────────────────────────────────────────
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe || !activeSnapshotSrc) return

    // Detect cross-origin navigation (user clicked a link that escaped the snapshot).
    // Accessing contentWindow.location throws for cross-origin frames; a non-matching
    // origin means we ended up on openstax.org which renders a no-JS error page.
    try {
      const href = iframe.contentWindow?.location.href ?? ''
      const escaped = href !== '' && href !== 'about:blank' && !href.startsWith(window.location.origin)
      if (escaped) {
        // Reset iframeReady first so the upcoming reload triggers the highlights effect
        setIframeReady(false)
        iframe.src = activeSnapshotSrc
        setNavBannerVisible(true)
        setTimeout(() => setNavBannerVisible(false), 4000)
        return
      }
    } catch {
      // Cross-origin access denied — definitely navigated away
      setIframeReady(false)
      iframe.src = activeSnapshotSrc
      setNavBannerVisible(true)
      setTimeout(() => setNavBannerVisible(false), 4000)
      return
    }

    const doc = iframe.contentDocument
    if (!doc) return

    // Snapshot clean HTML and signal the highlights effect to run
    originalHtmlRef.current = doc.body.innerHTML
    setIframeReady(true)

    const handleMouseUp = () => {
      if (disabled) return
      const win = iframe.contentWindow
      if (!win) return

      const anchor = selectionToAnchor(win)
      if (!anchor) return

      // Position tooltip above the last selection rect
      const sel = win.getSelection()
      if (!sel || sel.isCollapsed) return
      const range = sel.getRangeAt(0)
      const rects = Array.from(range.getClientRects())
      const last  = rects[rects.length - 1]
      if (last) {
        const pos = iframeToContainer(last.left + (last.right - last.left) / 2, last.top)
        setTooltipPos({ x: pos.x, y: pos.y - 8 })
      }

      onTextSelected({ type: 'html', text: anchor.text, start: anchor.start, end: anchor.end, pageIndex: currentPageIndex })
      onTrackEvent('html_text_select', {
        text_length:  anchor.text.length,
        text_preview: anchor.text.slice(0, 80),
      })
    }

    doc.addEventListener('mouseup', handleMouseUp)
    return () => doc.removeEventListener('mouseup', handleMouseUp)
  }, [activeSnapshotSrc, currentPageIndex, disabled, iframeToContainer, onTextSelected, onTrackEvent])

  // ── Reset tooltip form when it opens ──────────────────────────────────────
  useEffect(() => {
    if (!tooltipPos) return
    setAnnotationBody('')
    setSelectedTag(null)
    setSaveError(null)
    setSelectedCriterions(activeItemId ? [activeItemId] : rubricItems[0]?.id ? [rubricItems[0].id] : [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tooltipPos])

  // ── Close edit popover on outside click ───────────────────────────────────
  useEffect(() => {
    if (!editingAnnotation) return
    const handler = (e: MouseEvent) => {
      if (editPopoverRef.current && !editPopoverRef.current.contains(e.target as Node)) {
        setEditingAnnotation(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [editingAnnotation])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!annotationBody.trim()) return
    setIsSaving(true)
    setSaveError(null)
    const err = await onAnnotationConfirm({
      body:           annotationBody.trim(),
      rubricItemIds:  selectedCriterions,
      tag:            selectedTag,
    })
    setIsSaving(false)
    if (err) { setSaveError(err); return }
    setAnnotationBody('')
    setTooltipPos(null)
    iframeRef.current?.contentWindow?.getSelection()?.removeAllRanges()
  }

  const handleCancelTooltip = () => {
    onPendingSelectionClear()
    setTooltipPos(null)
    setAnnotationBody('')
    setSaveError(null)
    iframeRef.current?.contentWindow?.getSelection()?.removeAllRanges()
  }

  const handleEditConfirm = async () => {
    if (!editingAnnotation || !editBody.trim()) return
    setEditSaving(true)
    await onAnnotationEdit(editingAnnotation.id, { body: editBody.trim(), tag: editTag })
    setEditSaving(false)
    setEditingAnnotation(null)
  }

  const handleEditDelete = async () => {
    if (!editingAnnotation) return
    setEditDeleting(true)
    await onAnnotationDelete(editingAnnotation.id)
    setEditDeleting(false)
    setEditingAnnotation(null)
  }

  const activeItemLabel = rubricItems.find(r => r.id === activeItemId)?.label ?? null
  const containerWidth  = containerRef.current?.clientWidth ?? 600

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-slate-100">

      {/* ── Header bar ───────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        {disabled ? (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Review submitted
          </span>
        ) : activeItemLabel ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-[#1e3a5f] animate-pulse" />
            Active: <span className="font-medium text-slate-700">{activeItemLabel}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Select text to annotate</p>
        )}
      </div>

      {/* ── Page tabs (only shown for multi-page documents) ───────────────────── */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white border-b border-slate-200 overflow-x-auto">
          {Array.from({ length: totalPages }, (_, i) => {
            const isActive = i === currentPageIndex
            const annotationCount = savedAnnotations.filter(a => {
              const anchor = a.anchor as any
              if (anchor?.type !== 'html-char-offset') return false
              return (anchor?.pageIndex ?? 0) === i
            }).length
            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentPageIndex(i)}
                className={[
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-[#1e3a5f] text-white'
                    : snapshotErrors[i] ? 'text-red-400 hover:bg-red-50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                Page {i + 1}
                {snapshotting.has(i) && (
                  <svg className="animate-spin h-3 w-3 opacity-60" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {annotationCount > 0 && !snapshotting.has(i) && (
                  <span className={[
                    'inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold',
                    isActive ? 'bg-white/20 text-white' : 'bg-[#1e3a5f]/10 text-[#1e3a5f]',
                  ].join(' ')}>
                    {annotationCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── iframe + overlay layer ────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">

        {/* Navigation-blocked banner */}
        {navBannerVisible && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 text-white text-xs shadow-xl pointer-events-none">
            <svg className="h-4 w-4 flex-shrink-0 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Navigation is disabled — this is a saved snapshot for review
          </div>
        )}

        {snapshotErrors[currentPageIndex] ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-2 px-6">
              <p className="text-sm font-medium text-slate-700">Could not load page snapshot</p>
              <p className="text-xs text-slate-400">{snapshotErrors[currentPageIndex]}</p>
            </div>
          </div>
        ) : !activeSnapshotSrc ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-6 w-6 text-[#1e3a5f]/40" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-xs text-slate-400">Creating snapshot…</p>
            </div>
          </div>
        ) : (
          <iframe
            key={currentPageIndex}
            ref={iframeRef}
            src={activeSnapshotSrc}
            className="w-full h-full border-0"
            title="OpenStax content"
            sandbox="allow-same-origin allow-popups"
            onLoad={handleIframeLoad}
          />
        )}

        {/* Hover tooltip */}
        {hoverAnnotation && hoverPos && !editingAnnotation && !pendingSelection && (
          <div
            className="absolute z-40 pointer-events-none bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2.5 w-72"
            style={{
              left:      Math.max(8, Math.min(hoverPos.x - 144, containerWidth - 296)),
              top:       hoverPos.y,
              transform: 'translateY(calc(-100% - 8px))',
            }}
          >
            {hoverAnnotation.tag && (() => {
              const opt = TAG_OPTIONS.find(o => o.value === hoverAnnotation.tag)
              return opt ? (
                <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide mb-1.5 ${opt.bg} ${opt.text}`}>
                  {opt.label}
                </span>
              ) : null
            })()}
            <p className="text-[11px] text-slate-700 leading-snug">{hoverAnnotation.body}</p>
            {(hoverAnnotation.anchor as any)?.text && (
              <p className="mt-1 text-[10px] text-slate-400 italic line-clamp-2">
                &ldquo;{(hoverAnnotation.anchor as any).text}&rdquo;
              </p>
            )}
            {!disabled && <p className="mt-1.5 text-[9px] text-slate-300">Click to edit</p>}
          </div>
        )}

        {/* Edit popover */}
        {editingAnnotation && editTooltipPos && !disabled && (
          <div
            ref={editPopoverRef}
            className="absolute z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-80"
            style={{
              left: Math.max(8, Math.min(editTooltipPos.x - 160, containerWidth - 328)),
              top:  Math.max(8, editTooltipPos.y - 200),
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700">Edit annotation</p>
              <button onClick={() => setEditingAnnotation(null)} className="text-slate-400 hover:text-slate-600 p-0.5">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {(editingAnnotation.anchor as any)?.text && (
              <p className="text-[11px] text-slate-400 bg-slate-50 rounded px-2 py-1 mb-3 line-clamp-2 italic">
                &ldquo;{((editingAnnotation.anchor as any).text as string).slice(0, 80)}&rdquo;
              </p>
            )}

            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Tag</label>
              <div className="flex gap-1.5">
                {TAG_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditTag(prev => prev === opt.value ? null : opt.value)}
                    className={[
                      'flex-1 py-1 text-[10px] font-semibold rounded-lg border transition-all duration-100',
                      editTag === opt.value
                        ? `${opt.bg} ${opt.text} ring-2 ${opt.ring} border-transparent`
                        : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Evidence comment</label>
              <textarea
                autoFocus
                rows={3}
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEditConfirm()
                  if (e.key === 'Escape') setEditingAnnotation(null)
                }}
                className="w-full text-xs rounded border border-slate-200 px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              />
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={handleEditDelete}
                disabled={editDeleting}
                className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                {editDeleting ? 'Deleting…' : 'Delete'}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">⌘↵ to save</span>
                <button
                  onClick={handleEditConfirm}
                  disabled={!editBody.trim() || editSaving}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-white font-medium disabled:opacity-40 hover:bg-[#162d4a] transition-colors"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New-annotation tooltip */}
        {pendingSelection && tooltipPos && !disabled && (
          <div
            className="absolute z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-80"
            style={{
              left: Math.max(8, Math.min(tooltipPos.x - 160, containerWidth - 328)),
              top:  Math.max(8, tooltipPos.y - 200),
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700">Link evidence</p>
              <button onClick={handleCancelTooltip} className="text-slate-400 hover:text-slate-600 p-0.5">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 bg-slate-50 rounded px-2 py-1 mb-3 line-clamp-2 italic">
              &ldquo;{pendingSelection.text.slice(0, 80)}{pendingSelection.text.length > 80 ? '…' : ''}&rdquo;
            </p>

            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Criteria
              </label>
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded px-2 py-1.5 space-y-1 bg-white">
                {rubricItems.map(item => (
                  <label key={item.id} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedCriterions.includes(item.id)}
                      onChange={(e) => {
                        setSelectedCriterions((prev) =>
                          e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                        )
                        setSaveError(null)
                      }}
                      className="mt-0.5 rounded border-slate-300 text-[#1e3a5f] focus:ring-[#1e3a5f]/30 flex-shrink-0"
                    />
                    <span className="text-[11px] text-slate-700 leading-tight group-hover:text-slate-900">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Tag</label>
              <div className="flex gap-1.5">
                {TAG_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedTag(prev => prev === opt.value ? null : opt.value)}
                    className={[
                      'flex-1 py-1 text-[10px] font-semibold rounded-lg border transition-all duration-100',
                      selectedTag === opt.value
                        ? `${opt.bg} ${opt.text} ring-2 ${opt.ring} border-transparent`
                        : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Evidence comment <span className="text-red-400">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                placeholder="Describe how this passage supports or contradicts the criterion…"
                value={annotationBody}
                onChange={e => { setAnnotationBody(e.target.value); setSaveError(null) }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleConfirm()
                  if (e.key === 'Escape') handleCancelTooltip()
                }}
                className="w-full text-xs rounded border border-slate-200 px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              />
            </div>

            {saveError && <p className="text-[10px] text-red-500 mb-2">{saveError}</p>}

            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400">⌘↵ to save</span>
              <button
                onClick={handleConfirm}
                disabled={!annotationBody.trim() || isSaving}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-white font-medium disabled:opacity-40 hover:bg-[#162d4a] transition-colors"
              >
                {isSaving ? 'Saving…' : 'Save evidence'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
