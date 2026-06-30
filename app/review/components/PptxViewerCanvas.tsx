'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { HighlightTag } from '@/types'
import type { ReviewEventType } from '@/hooks/useReviewTracking'
import type { Json } from '@/types/database.types'
import type { PptxTextSelection } from '@/lib/supabase/types'
import { parsePptxFromUrl, type PptxSlide } from '@/lib/pptx-parser'
import { scaleRect, type PdfRect } from '@/lib/pdf-coords'
import { getCharOffset } from '@/lib/anchoring/html'
import { AnnotationPopup } from './AnnotationPopup'
import { AnnotationHoverCard } from './AnnotationHoverCard'
import { ViewerPanelHeader } from './ViewerPanelHeader'
import type { AnnotationConfirmPayload, SavedAnnotation } from './PDFViewerCanvas'

export type { AnnotationConfirmPayload, SavedAnnotation }

interface TooltipPosition {
  x: number
  selectionTop: number
  selectionBottom: number
}

interface PptxViewerCanvasProps {
  fileUrl: string
  rubricItems: { id: string; label: string }[]
  activeItemId: string | null
  pendingSelection: PptxTextSelection | null
  savedAnnotations: SavedAnnotation[]
  onTextSelected: (selection: PptxTextSelection) => void
  onAnnotationConfirm: (payload: AnnotationConfirmPayload) => Promise<string | null | undefined>
  onPendingSelectionClear: () => void
  onAnnotationEdit: (id: string, changes: { body: string; tag: HighlightTag | null }) => Promise<void>
  onAnnotationDelete: (id: string) => Promise<void>
  onAnnotationRelink?: (annotationId: string, newRubricItemIds: string[], updates: { body: string; tag: HighlightTag | null }) => Promise<void>
  onTrackEvent: (type: ReviewEventType, data?: Json) => void
  disabled: boolean
  scrollToAnnotationId?: string | null
  onGoToAnnotation?: (annotationId: string) => void
  onAnnotationViewFull?: (annotationId: string) => void
  onBack: () => void
}

export default function PptxViewerCanvas({
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
  scrollToAnnotationId,
  onGoToAnnotation,
  onAnnotationViewFull,
  onBack,
}: PptxViewerCanvasProps) {
  const [slides, setSlides] = useState<PptxSlide[]>([])
  const [currentSlide, setCurrentSlide] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null)

  const [hoveringAnnotation, setHoveringAnnotation] = useState<SavedAnnotation | null>(null)
  const [hoverCardPos, setHoverCardPos] = useState<{ x: number; y: number } | null>(null)
  const [isHoveringCard, setIsHoveringCard] = useState(false)
  const isHoveringCardRef = useRef(false)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [containerWidth, setContainerWidth] = useState(800)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }, [])

  // Parse PPTX on mount
  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    parsePptxFromUrl(fileUrl)
      .then(setSlides)
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load PPTX'))
      .finally(() => setLoading(false))
  }, [fileUrl])

  // Track container width for coordinate scaling
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.clientWidth)
    const obs = new ResizeObserver(entries => setContainerWidth((entries[0].target as HTMLElement).clientWidth))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // slideWidth mirrors pageWidth from PDF — used as the pageWidth arg to scaleRect()
  const slideWidth = Math.min(containerWidth - 32, 900)

  // Scale annotations for the current slide using the same scaleRect() as PDF
  const scaledAnnotations = useMemo(() =>
    savedAnnotations
      .filter(ann => (ann.anchor as Record<string, unknown>)?.slide === currentSlide)
      .map(ann => ({
        ...ann,
        scaledRects: ((ann.anchor as Record<string, unknown>)?.rects as PdfRect[] ?? []).map(r =>
          scaleRect(
            r,
            // Pass slideWidth/containerWidth as the pageWidth/containerWidth pair
            { pageWidth: (ann.anchor as Record<string, unknown>).slideWidth as number, containerWidth: (ann.anchor as Record<string, unknown>).containerWidth as number },
            slideWidth,
            containerWidth,
          )
        ),
      })),
    [savedAnnotations, currentSlide, slideWidth, containerWidth],
  )

  // Jump to the slide containing the requested annotation
  useEffect(() => {
    if (!scrollToAnnotationId) return
    const ann = savedAnnotations.find(a => a.id === scrollToAnnotationId)
    if (!ann) return
    const slide = (ann.anchor as Record<string, unknown>)?.slide
    if (typeof slide === 'number' && slide !== currentSlide) setCurrentSlide(slide)
    onGoToAnnotation?.(scrollToAnnotationId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToAnnotationId])

  function setHoveringCard(val: boolean) {
    isHoveringCardRef.current = val
    setIsHoveringCard(val)
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
    const scrollTop = containerEl.scrollTop
    const clientRects = Array.from(range.getClientRects())

    const rects = clientRects.map(r => ({
      x1: r.left  - containerRect.left,
      y1: r.top   - containerRect.top + scrollTop,
      x2: r.right - containerRect.left,
      y2: r.bottom - containerRect.top + scrollTop,
    }))

    const first = clientRects[0]
    const last  = clientRects[clientRects.length - 1]
    setTooltipPos({
      x:               last.left  - containerRect.left + (last.right - last.left) / 2,
      selectionTop:    first.top  - containerRect.top,
      selectionBottom: last.bottom - containerRect.top,
    })

    // Capture surrounding text for TextQuoteSelector
    const CONTEXT = 32
    let prefix = ''
    let suffix = ''
    let slideEl: Element | null =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : (range.startContainer as Node).parentElement
    while (slideEl && !(slideEl as HTMLElement).dataset?.slideContent) {
      slideEl = slideEl.parentElement
    }
    if (slideEl) {
      const fullText = slideEl.textContent ?? ''
      const startOff = getCharOffset(slideEl, range.startContainer, range.startOffset)
      const endOff   = getCharOffset(slideEl, range.endContainer, range.endOffset)
      prefix = fullText.slice(Math.max(0, startOff - CONTEXT), startOff)
      suffix = fullText.slice(endOff, endOff + CONTEXT)
    }

    onTextSelected({
      type: 'pptx',
      text,
      slide: currentSlide,
      rects,
      slideWidth,
      containerWidth,
      prefix,
      suffix,
    })
  }, [disabled, currentSlide, slideWidth, containerWidth, onTextSelected])

  const numSlides = slides.length
  const slide = slides[currentSlide - 1]

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <ViewerPanelHeader
        onBack={onBack}
        centerSlot={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentSlide(p => Math.max(1, p - 1))}
              disabled={currentSlide <= 1}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous slide"
            >
              <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-xs text-slate-600 tabular-nums">
              {currentSlide} / {numSlides || '—'}
            </span>
            <button
              onClick={() => setCurrentSlide(p => Math.min(numSlides, p + 1))}
              disabled={currentSlide >= numSlides}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next slide"
            >
              <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
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
        {loading ? (
          <PptxLoadingSkeleton />
        ) : loadError ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <p className="text-sm text-red-500 font-medium">Failed to load presentation</p>
              <p className="text-xs text-slate-400">{loadError}</p>
            </div>
          </div>
        ) : slide ? (
          <div
            className="bg-white shadow-lg rounded w-full max-w-[900px] min-h-[200px] p-8 select-text"
            data-slide-content="true"
          >
            {/* Slide header */}
            <div className="flex items-baseline gap-3 mb-5 pb-4 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest shrink-0">
                Slide {currentSlide}
              </span>
              {slide.title && (
                <h2 className="text-lg font-semibold text-slate-800 leading-snug">
                  {slide.title}
                </h2>
              )}
            </div>

            {/* Slide body text */}
            {slide.paragraphs.length > 0 ? (
              <div className="space-y-2">
                {slide.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm text-slate-700 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No text content on this slide.</p>
            )}

            {/* Note for visual-only content */}
            {slide.paragraphs.length === 0 && !slide.title && (
              <p className="mt-4 text-xs text-slate-400">
                This slide may contain only images or diagrams. Visual content cannot be extracted for text review.
              </p>
            )}
          </div>
        ) : null}

        {/* Saved annotation highlights */}
        {scaledAnnotations.flatMap(ann =>
          ann.scaledRects.map((rect, i) => (
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

        {/* Hover card */}
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
              onSave={updates => onAnnotationEdit(hoveringAnnotation.id, updates)}
              onRelink={onAnnotationRelink
                ? (newIds, updates) => onAnnotationRelink!(hoveringAnnotation.id, newIds, updates)
                : undefined}
              onDelete={() => {
                onAnnotationDelete(hoveringAnnotation.id)
                setHoveringAnnotation(null)
                setHoverCardPos(null)
              }}
              onViewFullComment={onAnnotationViewFull ? () => onAnnotationViewFull!(hoveringAnnotation.id) : undefined}
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

        {/* Backdrop */}
        {pendingSelection && tooltipPos && (
          <div
            className="absolute inset-0 z-[29]"
            onMouseDown={() => { window.getSelection()?.removeAllRanges(); onPendingSelectionClear() }}
          />
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
            onSave={async payload => {
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

function PptxLoadingSkeleton() {
  return (
    <div className="w-full max-w-[900px] min-h-[400px] bg-white rounded shadow-lg animate-pulse flex flex-col gap-4 p-10">
      <div className="h-4 bg-slate-200 rounded w-1/4" />
      <div className="h-6 bg-slate-200 rounded w-2/3" />
      <div className="mt-4 space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-3 bg-slate-200 rounded" style={{ width: `${60 + (i % 5) * 7}%` }} />
        ))}
      </div>
    </div>
  )
}
