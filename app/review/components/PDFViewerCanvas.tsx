'use client'

// Renders the OER PDF (client-only — react-pdf requires browser APIs like DOMMatrix).

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import type { HighlightTag } from '@/types'
import type { ReviewEventType } from '@/hooks/useReviewTracking'
import type { Json } from '@/types/database.types'
import { scaleRect, type PdfRect, ZOOM_LEVELS, DEFAULT_ZOOM } from '@/lib/pdf-coords'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export interface TextSelection {
  text: string
  page: number
  rects: { x1: number; y1: number; x2: number; y2: number }[]
  pageWidth: number
  containerWidth: number
}

export interface AnnotationConfirmPayload {
  body: string
  rubricItemId: string | null
  tag: HighlightTag | null
}

export interface SavedAnnotation {
  id: string
  rubricItemId: string | null
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

const HIGHLIGHT_BG: Record<string, string> = {
  action_item: 'bg-orange-300/40',
  quick_fix:   'bg-blue-300/40',
}
const HIGHLIGHT_BG_DEFAULT = 'bg-slate-400/30'

interface TooltipPosition {
  x: number
  y: number
}

const TAG_OPTIONS: { value: HighlightTag; label: string; bg: string; text: string; ring: string }[] = [
  { value: 'action_item', label: 'Action Item', bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-400' },
  { value: 'quick_fix',   label: 'Quick Fix',   bg: 'bg-blue-50',   text: 'text-blue-700',  ring: 'ring-blue-400' },
]

interface PDFViewerCanvasProps {
  fileUrl: string
  rubricItems: { id: string; label: string }[]
  activeItemId: string | null
  pendingSelection: TextSelection | null
  savedAnnotations: SavedAnnotation[]
  onTextSelected: (selection: TextSelection) => void
  onAnnotationConfirm: (payload: AnnotationConfirmPayload) => Promise<string | null | undefined>
  onPendingSelectionClear: () => void
  onAnnotationEdit: (annotationId: string, changes: { body: string; tag: HighlightTag | null }) => Promise<void>
  onAnnotationDelete: (annotationId: string) => Promise<void>
  onTrackEvent: (type: ReviewEventType, data?: Json) => void
  disabled: boolean
}

export default function PDFViewerCanvas({
  fileUrl,
  rubricItems,
  activeItemId,
  pendingSelection,
  savedAnnotations,
  onTextSelected,
  onAnnotationConfirm,
  onPendingSelectionClear,
  onAnnotationEdit,
  onAnnotationDelete,
  onTrackEvent,
  disabled,
}: PDFViewerCanvasProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [annotationBody, setAnnotationBody] = useState('')
  const [selectedCriterionId, setSelectedCriterionId] = useState<string>('')
  const [selectedTag, setSelectedTag] = useState<HighlightTag | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null)

  const [editingAnnotation, setEditingAnnotation] = useState<SavedAnnotation | null>(null)
  const [editTooltipPos, setEditTooltipPos] = useState<TooltipPosition | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editTag, setEditTag] = useState<HighlightTag | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editDeleting, setEditDeleting] = useState(false)

  const [hoverAnnotation, setHoverAnnotation] = useState<SavedAnnotation | null>(null)
  const [hoverPos, setHoverPos] = useState<TooltipPosition | null>(null)

  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [containerWidth, setContainerWidth] = useState(800)

  const containerRef = useRef<HTMLDivElement>(null)
  const editPopoverRef = useRef<HTMLDivElement>(null)
  const prevPageRef = useRef(1)
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track container width for coordinate scaling
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.clientWidth)
    const obs = new ResizeObserver((entries) => setContainerWidth((entries[0].target as HTMLElement).clientWidth))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const renderPageWidth = Math.min(containerWidth - 32, 900) * zoom

  // Pre-scale all annotation rects to the current render space for hit-testing and rendering
  const scaledAnnotations = useMemo(() =>
    savedAnnotations.map((ann) => ({
      ...ann,
      scaledRects: ((ann.anchor as any)?.rects ?? []).map(
        (r: { x1: number; y1: number; x2: number; y2: number }) =>
          scaleRect(r, ann.anchor as any, renderPageWidth, containerWidth)
      ),
    })),
    [savedAnnotations, renderPageWidth, containerWidth]
  )

  // ── PDF page change tracking ───────────────────────────────────────────────
  useEffect(() => {
    if (currentPage === prevPageRef.current) return
    onTrackEvent('pdf_page_change', { page: currentPage, prev_page: prevPageRef.current })
    prevPageRef.current = currentPage
  }, [currentPage, onTrackEvent])

  // ── Scroll sampling (throttled to 1 sample/sec) ────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleScroll = () => {
      if (scrollThrottleRef.current) return
      scrollThrottleRef.current = setTimeout(() => {
        scrollThrottleRef.current = null
        const container = containerRef.current
        if (!container) return
        onTrackEvent('pdf_scroll', {
          scroll_y: Math.round(container.scrollTop),
          page: currentPage,
        })
      }, 1000)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (scrollThrottleRef.current) {
        clearTimeout(scrollThrottleRef.current)
        scrollThrottleRef.current = null
      }
    }
  // currentPage intentionally excluded: we want the latest value inside the
  // throttled callback without resetting the listener on every page change.
  // The ref pattern avoids stale closure issues here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTrackEvent])

  // Reset tooltip state when it opens
  useEffect(() => {
    if (tooltipPos) {
      setAnnotationBody('')
      setSelectedTag(null)
      setSaveError(null)
      setSelectedCriterionId(activeItemId ?? rubricItems[0]?.id ?? '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tooltipPos])

  // Close edit popover when clicking outside it
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

  const openEditPopover = useCallback((e: React.MouseEvent, ann: SavedAnnotation) => {
    e.stopPropagation()
    if (disabled) return
    onPendingSelectionClear()
    setTooltipPos(null)
    setHoverAnnotation(null)
    window.getSelection()?.removeAllRanges()
    setEditingAnnotation(ann)
    setEditBody(ann.body)
    setEditTag(ann.tag as HighlightTag | null)
    const rawRects: { x1: number; y1: number; x2: number; y2: number }[] = (ann.anchor as any)?.rects ?? []
    const lastRaw = rawRects[rawRects.length - 1]
    if (lastRaw) {
      const scaled = scaleRect(lastRaw, ann.anchor as any, renderPageWidth, containerWidth)
      setEditTooltipPos({ x: (scaled.x1 + scaled.x2) / 2, y: scaled.y2 + 8 })
    }
  }, [disabled, onPendingSelectionClear, renderPageWidth, containerWidth])

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

  const handleMouseUp = useCallback(() => {
    if (disabled) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return

    const text = selection.toString().trim()
    const range = selection.getRangeAt(0)
    const containerEl = containerRef.current
    if (!containerEl) return

    const containerRect = containerEl.getBoundingClientRect()
    const scrollLeft = containerEl.scrollLeft
    const scrollTop = containerEl.scrollTop
    const clientRects = Array.from(range.getClientRects())

    // Store rects relative to the container's scrollable content so
    // highlight overlays (position: absolute inside the container) stay
    // aligned with the text regardless of scroll position.
    const rects = clientRects.map((r) => ({
      x1: r.left  - containerRect.left + scrollLeft,
      y1: r.top   - containerRect.top  + scrollTop,
      x2: r.right - containerRect.left + scrollLeft,
      y2: r.bottom- containerRect.top  + scrollTop,
    }))

    const last = clientRects[clientRects.length - 1]
    setTooltipPos({
      x: last.left - containerRect.left + (last.right - last.left) / 2,
      y: last.top  - containerRect.top - 8,
    })

    onTextSelected({
      text,
      page: currentPage,
      rects,
      pageWidth: renderPageWidth,
      containerWidth,
    })
  }, [disabled, currentPage, onTextSelected, renderPageWidth, containerWidth])

  const handleConfirm = async () => {
    if (!annotationBody.trim()) return
    setIsSaving(true)
    setSaveError(null)
    const err = await onAnnotationConfirm({
      body: annotationBody.trim(),
      rubricItemId: selectedCriterionId || null,
      tag: selectedTag,
    })
    setIsSaving(false)
    if (err) {
      setSaveError(err)
      return
    }
    setAnnotationBody('')
    setTooltipPos(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleCancelTooltip = () => {
    onPendingSelectionClear()
    setTooltipPos(null)
    setAnnotationBody('')
    setSaveError(null)
    window.getSelection()?.removeAllRanges()
  }

  const activeItemLabel = rubricItems.find((r) => r.id === activeItemId)?.label ?? null

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-xs text-slate-600 tabular-nums">
            {currentPage} / {numPages || '—'}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd" />
            </svg>
          </button>

          <span className="w-px h-4 bg-slate-200 mx-1" />

          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => {
              const idx = ZOOM_LEVELS.indexOf(z as typeof ZOOM_LEVELS[number])
              return idx > 0 ? ZOOM_LEVELS[idx - 1] : z
            })}
            disabled={zoom <= ZOOM_LEVELS[0]}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              <path d="M5 8h6" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-xs text-slate-500 tabular-nums w-8 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => {
              const idx = ZOOM_LEVELS.indexOf(z as typeof ZOOM_LEVELS[number])
              return idx < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[idx + 1] : z
            })}
            disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom in"
          >
            <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              <path d="M8 5v6M5 8h6" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {activeItemLabel && !disabled && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-[#1e3a5f] animate-pulse" />
            Active: <span className="font-medium text-slate-700">{activeItemLabel}</span>
          </div>
        )}

        {disabled && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd" />
            </svg>
            Review submitted
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative flex justify-center py-6 px-4"
        onMouseUp={handleMouseUp}
        onMouseMove={(e) => {
          if (editingAnnotation || pendingSelection) {
            if (hoverAnnotation) setHoverAnnotation(null)
            return
          }
          const el = containerRef.current
          if (!el) return
          const cr = el.getBoundingClientRect()
          const mx = e.clientX - cr.left + el.scrollLeft
          const my = e.clientY - cr.top  + el.scrollTop
          for (const ann of scaledAnnotations) {
            if ((ann.anchor as any)?.page !== currentPage) continue
            for (const r of ann.scaledRects) {
              if (mx >= r.x1 && mx <= r.x2 && my >= r.y1 && my <= r.y2) {
                setHoverAnnotation(ann)
                setHoverPos({ x: (r.x1 + r.x2) / 2, y: r.y1 })
                return
              }
            }
          }
          if (hoverAnnotation) setHoverAnnotation(null)
        }}
        onMouseLeave={() => setHoverAnnotation(null)}
      >
        {loadError ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <p className="text-sm text-red-500 font-medium">Failed to load PDF</p>
              <p className="text-xs text-slate-400">{loadError}</p>
            </div>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={(err) => setLoadError(err.message)}
            loading={<PDFLoadingSkeleton />}
          >
            <Page
              pageNumber={currentPage}
              renderTextLayer
              renderAnnotationLayer={false}
              className="shadow-lg rounded"
              width={renderPageWidth}
            />
          </Document>
        )}

        {/* Saved annotation highlights */}
        {scaledAnnotations
          .filter((ann) => (ann.anchor as any)?.page === currentPage)
          .flatMap((ann) =>
            ann.scaledRects.map((rect: PdfRect, i: number) => (
              <div
                key={`${ann.id}-${i}`}
                className={[
                  'absolute rounded-sm transition-opacity',
                  ann.tag ? (HIGHLIGHT_BG[ann.tag] ?? HIGHLIGHT_BG_DEFAULT) : HIGHLIGHT_BG_DEFAULT,
                  disabled ? 'pointer-events-none' : 'cursor-pointer hover:opacity-70',
                  editingAnnotation?.id === ann.id ? 'ring-2 ring-[#1e3a5f]/40' : '',
                ].join(' ')}
                style={{
                  left:   rect.x1,
                  top:    rect.y1,
                  width:  Math.max(2, rect.x2 - rect.x1),
                  height: Math.max(3, rect.y2 - rect.y1),
                }}
                onClick={(e) => openEditPopover(e, ann)}
              />
            ))
          )}

        {/* Hover tooltip — appears when mousing over a highlight */}
        {hoverAnnotation && hoverPos && !editingAnnotation && !pendingSelection && (
          <div
            className="absolute z-40 pointer-events-none bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2.5 w-72"
            style={{
              left: Math.max(8, Math.min(hoverPos.x - 144, (containerRef.current?.clientWidth ?? 600) - 296)),
              top:  hoverPos.y,
              transform: 'translateY(calc(-100% - 8px))',
            }}
          >
            {hoverAnnotation.tag && TAG_OPTIONS.find((o) => o.value === hoverAnnotation.tag) && (() => {
              const opt = TAG_OPTIONS.find((o) => o.value === hoverAnnotation.tag)!
              return (
                <span className={[
                  'inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide mb-1.5',
                  opt.bg, opt.text,
                ].join(' ')}>
                  {opt.label}
                </span>
              )
            })()}
            <p className="text-[11px] text-slate-700 leading-snug">{hoverAnnotation.body}</p>
            {(hoverAnnotation.anchor as any)?.text && (
              <p className="mt-1 text-[10px] text-slate-400 italic line-clamp-2">
                &ldquo;{(hoverAnnotation.anchor as any).text}&rdquo;
              </p>
            )}
            {!disabled && (
              <p className="mt-1.5 text-[9px] text-slate-300">Click to edit</p>
            )}
          </div>
        )}

        {/* Edit popover — appears when an existing highlight is clicked */}
        {editingAnnotation && editTooltipPos && !disabled && (
          <div
            ref={editPopoverRef}
            className="absolute z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-80"
            style={{
              left: Math.max(8, Math.min(editTooltipPos.x - 160, (containerRef.current?.clientWidth ?? 600) - 328)),
              top:  editTooltipPos.y,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700">Edit annotation</p>
              <button
                onClick={() => setEditingAnnotation(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {(editingAnnotation.anchor as any)?.text && (
              <p className="text-[11px] text-slate-400 bg-slate-50 rounded px-2 py-1 mb-3 line-clamp-2 italic">
                &ldquo;{((editingAnnotation.anchor as any).text as string).slice(0, 80)}{((editingAnnotation.anchor as any).text as string).length > 80 ? '…' : ''}&rdquo;
              </p>
            )}

            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Tag</label>
              <div className="flex gap-1.5">
                {TAG_OPTIONS.map((opt) => {
                  const isSelected = editTag === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditTag((prev) => prev === opt.value ? null : opt.value)}
                      className={[
                        'flex-1 py-1 text-[10px] font-semibold rounded-lg border transition-all duration-100',
                        isSelected
                          ? `${opt.bg} ${opt.text} ring-2 ${opt.ring} border-transparent`
                          : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Evidence comment
              </label>
              <textarea
                autoFocus
                rows={3}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEditConfirm()
                  if (e.key === 'Escape') setEditingAnnotation(null)
                }}
                className="w-full text-xs rounded border border-slate-200 px-2.5 py-2 resize-none
                  focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              />
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={handleEditDelete}
                disabled={editDeleting}
                className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {editDeleting ? 'Deleting…' : 'Delete'}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">⌘↵ to save</span>
                <button
                  onClick={handleEditConfirm}
                  disabled={!editBody.trim() || editSaving}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-white font-medium
                    disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#162d4a] transition-colors"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingSelection && tooltipPos && !disabled && (
          <div
            className="absolute z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-80"
            style={{
              left: Math.max(8, Math.min(tooltipPos.x - 160, (containerRef.current?.clientWidth ?? 600) - 328)),
              top: Math.max(8, tooltipPos.y - 200),
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700">Link evidence</p>
              <button
                onClick={handleCancelTooltip}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Highlighted text preview */}
            <p className="text-[11px] text-slate-400 bg-slate-50 rounded px-2 py-1 mb-3 line-clamp-2 italic">
              &ldquo;{pendingSelection.text.slice(0, 80)}{pendingSelection.text.length > 80 ? '…' : ''}&rdquo;
            </p>

            {/* Criterion selector */}
            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Criterion <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedCriterionId}
                onChange={(e) => { setSelectedCriterionId(e.target.value); setSaveError(null) }}
                className="w-full text-xs rounded border border-slate-200 px-2.5 py-1.5
                  focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]
                  text-slate-700 bg-white"
              >
                <option value="">No criterion</option>
                {rubricItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>

            {/* Tag selector */}
            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Tag
              </label>
              <div className="flex gap-1.5">
                {TAG_OPTIONS.map((opt) => {
                  const isSelected = selectedTag === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedTag(prev => prev === opt.value ? null : opt.value)}
                      className={[
                        'flex-1 py-1 text-[10px] font-semibold rounded-lg border transition-all duration-100',
                        isSelected
                          ? `${opt.bg} ${opt.text} ring-2 ${opt.ring} border-transparent`
                          : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Evidence comment */}
            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Evidence comment <span className="text-red-400">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                placeholder="Describe how this passage supports or contradicts the criterion…"
                value={annotationBody}
                onChange={(e) => { setAnnotationBody(e.target.value); setSaveError(null) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleConfirm()
                  if (e.key === 'Escape') handleCancelTooltip()
                }}
                className="w-full text-xs rounded border border-slate-200 px-2.5 py-2 resize-none
                  focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              />
            </div>

            {/* Error */}
            {saveError && (
              <p className="text-[10px] text-red-500 mb-2">{saveError}</p>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400">⌘↵ to save</span>
              <button
                onClick={handleConfirm}
                disabled={!annotationBody.trim() || isSaving}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-white font-medium
                  disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#162d4a] transition-colors"
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

function PDFLoadingSkeleton() {
  return (
    <div className="w-[700px] h-[900px] bg-white rounded shadow-lg animate-pulse flex flex-col gap-4 p-10">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="h-3 bg-slate-200 rounded" style={{ width: `${65 + (i % 4) * 8}%` }} />
      ))}
    </div>
  )
}
