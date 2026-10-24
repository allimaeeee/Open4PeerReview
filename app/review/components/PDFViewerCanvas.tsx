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
import { getCharOffset } from '@/lib/anchoring/html'
import { AnnotationPopup } from './AnnotationPopup'
import { AnnotationHoverCard } from './AnnotationHoverCard'
import { ViewerPanelHeader } from './ViewerPanelHeader'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export interface TextSelection {
  text: string
  page: number
  rects: { x1: number; y1: number; x2: number; y2: number }[]
  pageWidth: number
  containerWidth: number
  prefix: string
  suffix: string
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


interface TooltipPosition {
  x: number
  selectionTop: number
  selectionBottom: number
}

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
  onAnnotationRelink?: (annotationId: string, newRubricItemIds: string[], updates: { body: string; tag: HighlightTag | null }) => Promise<void>
  onTrackEvent: (type: ReviewEventType, data?: Json) => void
  disabled: boolean
  onGoToAnnotation?: (annotationId: string) => void
  onAnnotationViewFull?: (annotationId: string) => void
  scrollToAnnotationId?: string | null
  onBack: () => void
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
  onAnnotationRelink,
  onTrackEvent,
  disabled,
  onGoToAnnotation,
  onAnnotationViewFull,
  scrollToAnnotationId,
  onBack,
}: PDFViewerCanvasProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null)

  const [hoveringAnnotation, setHoveringAnnotation] = useState<SavedAnnotation | null>(null)
  const [hoverCardPos, setHoverCardPos] = useState<{ x: number; y: number } | null>(null)
  const [isHoveringCard, setIsHoveringCard] = useState(false)
  const isHoveringCardRef = useRef(false)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [containerWidth, setContainerWidth] = useState(800)

  const containerRef = useRef<HTMLDivElement>(null)
  const prevPageRef = useRef(1)
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

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
    onTrackEvent('pdf_page_change', { page: currentPage, prev_page: prevPageRef.current, rubric_item_id: activeItemId })
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

  function setHoveringCard(val: boolean) {
    isHoveringCardRef.current = val
    setIsHoveringCard(val)
  }

  function handleGoToAnnotation(annotationId: string) {
    const ann = savedAnnotations.find(a => a.id === annotationId)
    if (!ann) return
    const anchor = ann.anchor as { page?: number }
    if (typeof anchor.page === 'number' && anchor.page !== currentPage) {
      setCurrentPage(anchor.page)
    }
    onGoToAnnotation?.(annotationId)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (scrollToAnnotationId) handleGoToAnnotation(scrollToAnnotationId)
  }, [scrollToAnnotationId])

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

    const first = clientRects[0]
    const last  = clientRects[clientRects.length - 1]
    setTooltipPos({
      x:              last.left  - containerRect.left + (last.right - last.left) / 2,
      selectionTop:   first.top  - containerRect.top,
      selectionBottom: last.bottom - containerRect.top,
    })

    // Capture surrounding text context from the PDF text layer for TextQuoteSelector
    const CONTEXT = 32
    let prefix = ''
    let suffix = ''
    let textLayerEl: Element | null =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : (range.startContainer as Node).parentElement
    while (textLayerEl && !textLayerEl.classList.contains('react-pdf__Page__textContent')) {
      textLayerEl = textLayerEl.parentElement
    }
    if (textLayerEl) {
      const fullText = textLayerEl.textContent ?? ''
      const startOff = getCharOffset(textLayerEl, range.startContainer, range.startOffset)
      const endOff   = getCharOffset(textLayerEl, range.endContainer,   range.endOffset)
      prefix = fullText.slice(Math.max(0, startOff - CONTEXT), startOff)
      suffix = fullText.slice(endOff, endOff + CONTEXT)
    }

    onTextSelected({
      text,
      page: currentPage,
      rects,
      pageWidth: renderPageWidth,
      containerWidth,
      prefix,
      suffix,
    })
  }, [disabled, currentPage, onTextSelected, renderPageWidth, containerWidth])

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <ViewerPanelHeader
        onBack={onBack}
        centerSlot={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-xs text-slate-600 tabular-nums">{currentPage} / {numPages || '—'}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="w-px h-4 bg-slate-200 mx-1" />
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
            <span className="text-xs text-slate-500 tabular-nums w-8 text-center">{Math.round(zoom * 100)}%</span>
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
        }
      />

      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative flex justify-center py-6 px-4 [&_::selection]:bg-annotation"
        onMouseUp={handleMouseUp}
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
                  'absolute z-[3] rounded-sm transition-opacity bg-annotation',
                  disabled ? 'pointer-events-none' : 'cursor-pointer hover:opacity-70',
                ].join(' ')}
                style={{
                  left:   rect.x1,
                  top:    rect.y1,
                  width:  Math.max(2, rect.x2 - rect.x1),
                  height: Math.max(3, rect.y2 - rect.y1),
                }}
                onMouseEnter={() => {
                  if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
                  setHoveringAnnotation(ann)
                  setHoverCardPos({ x: rect.x1, y: rect.y2 + 8 })
                }}
                onMouseLeave={() => {
                  hideTimerRef.current = setTimeout(() => {
                    if (!isHoveringCardRef.current) {
                      setHoveringAnnotation(null)
                      setHoverCardPos(null)
                    }
                  }, 120)
                }}
              />
            ))
          )}

        {/* Hover card — appears when mousing over a highlight */}
        {hoveringAnnotation && hoverCardPos && (() => {
          const anchorKey = JSON.stringify(hoveringAnnotation.anchor)
          const linkedCriteriaIds = savedAnnotations
            .filter(a => JSON.stringify(a.anchor) === anchorKey && a.rubricItemId !== null)
            .map(a => a.rubricItemId as string)
          return (
            <AnnotationHoverCard
              annotation={hoveringAnnotation}
              criterionLabel={
                hoveringAnnotation.rubricItemId
                  ? (rubricItems.find(r => r.id === hoveringAnnotation.rubricItemId)?.label ?? null)
                  : null
              }
              criteria={rubricItems}
              linkedCriteriaIds={linkedCriteriaIds}
              position={hoverCardPos}
              onSave={(updates) => onAnnotationEdit(hoveringAnnotation.id, updates)}
              onRelink={onAnnotationRelink
                ? (newIds, updates) => onAnnotationRelink(hoveringAnnotation.id, newIds, updates)
                : undefined}
              onDelete={() => {
                onAnnotationDelete(hoveringAnnotation.id)
                setHoveringAnnotation(null)
                setHoverCardPos(null)
              }}
              onViewFullComment={onAnnotationViewFull ? () => onAnnotationViewFull(hoveringAnnotation.id) : undefined}
              onMouseEnter={() => {
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
                setHoveringCard(true)
              }}
              onMouseLeave={() => {
                setHoveringCard(false)
                setHoveringAnnotation(null)
                setHoverCardPos(null)
              }}
            />
          )
        })()}

        {/* Backdrop — catches outside clicks while popup is open */}
        {pendingSelection && tooltipPos && (
          <div className="absolute inset-0 z-[29]" onMouseDown={() => { window.getSelection()?.removeAllRanges(); onPendingSelectionClear() }} />
        )}

        {/* Create-annotation popup */}
        {pendingSelection && tooltipPos && (
          <AnnotationPopup
            criteria={rubricItems.map(r => ({ id: r.id, label: r.label }))}
            selectedText={pendingSelection.text}
            position={{
              x:               Math.max(8, Math.min(tooltipPos.x - 160, containerWidth - 328)),
              selectionTop:    tooltipPos.selectionTop,
              selectionBottom: tooltipPos.selectionBottom,
            }}
            onSave={async (payload) => {
              const err = await onAnnotationConfirm(payload)
              if (!err) onPendingSelectionClear()
            }}
            onCancel={onPendingSelectionClear}
          />
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
