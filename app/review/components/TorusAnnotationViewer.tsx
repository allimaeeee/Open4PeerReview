'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import ViewerPanelHeader from './ViewerPanelHeader'
import { TagChip } from './TagChip'
import { openInTorus } from '@/lib/torus'

interface BboxAnchor {
  type: 'bbox'
  screenshotUrl?: string
  pageUrl?: string
  pageName?: string
  pageType?: string
  textQuote?: string
}

interface PointAnchor {
  type: 'point'
  pageUrl?: string
  pageName?: string
  pageType?: string
  screenshotUrl?: string
}

interface HtmlCharOffsetAnchor {
  type: 'html-char-offset'
  screenshotUrl?: string
  pageUrl?: string
  pageName?: string
  pageType?: string
  selector?: Array<{ type: string; exact?: string; prefix?: string; suffix?: string }>
}

type GalleryAnchor = BboxAnchor | PointAnchor | HtmlCharOffsetAnchor

interface SavedAnnotation {
  id: string
  anchor: Record<string, unknown>
  body: string
  tag: string | null
  rubricItemId: string | null
  created_at?: string
}

interface TorusAnnotationViewerProps {
  // Only reviewers deep-link into the extension with an auth token — the author's
  // read-only feedback view omits these and gets a plain course link instead.
  supabase?: SupabaseClient
  reviewId?: string | null
  sourceUrl: string | null
  courseAccessCode: string | null
  savedAnnotations: SavedAnnotation[]
  rubricItems: { id: string; label: string }[]
  onBack: () => void
  disabled: boolean
  scrollToAnnotationId?: string | null
  onGoToAnnotation?: () => void
  onAnnotationViewFull?: (annotationId: string) => void
  pulseAnnotationId?: string | null
  onPulseComplete?: () => void
  // Carousel props
  submissionTitle?: string
  onIndexMapReady?: (map: Map<string, number>) => void
  onCarouselNavigate?: (annotationId: string) => void
}

export function TorusAnnotationViewer({
  supabase,
  reviewId,
  sourceUrl,
  courseAccessCode,
  savedAnnotations,
  rubricItems,
  onBack,
  disabled,
  scrollToAnnotationId,
  onGoToAnnotation,
  onAnnotationViewFull,
  pulseAnnotationId,
  onPulseComplete,
  submissionTitle,
  onIndexMapReady,
  onCarouselNavigate,
}: TorusAnnotationViewerProps) {
  const handleOpenInTorus = () => {
    if (supabase) {
      openInTorus(supabase, sourceUrl, reviewId ?? null)
    } else if (sourceUrl) {
      window.open(sourceUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const criterionById = Object.fromEntries(rubricItems.map(r => [r.id, r.label]))

  // Carousel annotations: only Torus anchor types, sorted chronologically oldest-first.
  // Separate from the right panel evidence order — do not reuse for the right panel.
  const carouselAnnotations = useMemo(() => {
    return savedAnnotations
      .filter(ann => {
        const anchorType = (ann.anchor as { type?: unknown }).type
        return anchorType === 'bbox' || anchorType === 'point' || anchorType === 'html-char-offset'
      })
      .slice()
      .sort((a, b) => {
        const ta = a.created_at ?? ''
        const tb = b.created_at ?? ''
        return ta < tb ? -1 : ta > tb ? 1 : 0
      })
  }, [savedAnnotations])

  // Stable 1-based index map for future "Screenshot #N" badges in the right panel
  const annotationIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    carouselAnnotations.forEach((ann, i) => map.set(ann.id, i + 1))
    return map
  }, [carouselAnnotations])

  useEffect(() => {
    onIndexMapReady?.(annotationIndexMap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationIndexMap])

  const total = carouselAnnotations.length
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Navigate to a specific 0-based index and fire the reverse sync
  function navigateTo(newIndex: number) {
    const idx = Math.max(0, Math.min(newIndex, total - 1))
    setCurrentIndex(idx)
    if (carouselAnnotations[idx]) {
      onCarouselNavigate?.(carouselAnnotations[idx].id)
    }
  }

  // Right panel → carousel: switch to the slide matching scrollToAnnotationId
  useEffect(() => {
    if (!scrollToAnnotationId) return
    const idx = carouselAnnotations.findIndex(a => a.id === scrollToAnnotationId)
    if (idx !== -1) setCurrentIndex(idx)
    onGoToAnnotation?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToAnnotationId])

  // Right panel → carousel: sync to the correct slide (no pulse on the carousel card)
  useEffect(() => {
    if (!pulseAnnotationId) return
    const idx = carouselAnnotations.findIndex(a => a.id === pulseAnnotationId)
    if (idx !== -1) setCurrentIndex(idx)
    onPulseComplete?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseAnnotationId])

  // Guard against currentIndex going out-of-bounds if carouselAnnotations shrinks
  const safeIndex = total > 0 ? Math.min(currentIndex, total - 1) : 0
  const currentAnnotation = carouselAnnotations[safeIndex] ?? null

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface">
      {/* Row 1: header — hidden in read-only/report mode (disabled=true) */}
      {!disabled && (
        <ViewerPanelHeader
          onBack={onBack}
          centerSlot={
            submissionTitle ? (
              <span className="font-heading text-body-md font-semibold text-text-primary truncate max-w-xs">
                {submissionTitle}
              </span>
            ) : (
              <span className="font-heading text-body-md font-semibold text-text-primary">
                OLI Torus{total > 0 ? ` · ${total} screenshot${total === 1 ? '' : 's'}` : ''}
              </span>
            )
          }
          rightSlot={sourceUrl ? (
            <button
              type="button"
              onClick={handleOpenInTorus}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover transition-colors"
            >
              Open in Torus
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          ) : undefined}
        />
      )}

      {/* Access code banner */}
      {courseAccessCode && (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-amber-50 border-b border-amber-200">
          <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
          <span className="text-label-sm text-amber-800">
            Access code: <span className="font-mono font-semibold">{courseAccessCode}</span>
          </span>
        </div>
      )}

      {total === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
          <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p className="text-body-md font-medium text-text-secondary">No annotations yet</p>
          <p className="text-body-sm text-text-muted mt-1 max-w-xs">
            Use the OER Review Chrome extension on the OLI Torus page to capture screenshots and annotations.
          </p>
          {!disabled && sourceUrl && (
            <button
              type="button"
              onClick={handleOpenInTorus}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-label-md font-semibold bg-primary text-on-primary hover:bg-primary-hover transition-colors"
            >
              Open in Torus
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Row 2: numbered navigation — ← [1] [2] … [N] → centered as a cluster */}
          <div className="flex items-center justify-center py-2 px-3 bg-surface-card border-b border-border shrink-0">
            {/* Left arrow — disabled at first slide */}
            <button
              type="button"
              disabled={safeIndex === 0}
              onClick={() => navigateTo(safeIndex - 1)}
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:bg-surface-container hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous screenshot"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Horizontally scrollable number pills — bounded so arrows stay adjacent */}
            <div className="overflow-x-auto max-w-[calc(100%-88px)] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-secondary/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-secondary/60">
              <div className="flex gap-1 min-w-max py-0.5 px-1">
                {carouselAnnotations.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => navigateTo(i)}
                    aria-current={i === safeIndex ? 'true' : undefined}
                    className={[
                      'min-w-[28px] h-7 px-1.5 rounded text-label-sm font-semibold transition-colors',
                      i === safeIndex
                        ? 'bg-primary text-on-primary'
                        : 'bg-transparent text-text-secondary hover:bg-surface-container hover:text-text-primary',
                    ].join(' ')}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Right arrow — disabled at last slide */}
            <button
              type="button"
              disabled={safeIndex === total - 1}
              onClick={() => navigateTo(safeIndex + 1)}
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:bg-surface-container hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next screenshot"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Single-slide content area */}
          <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
            {currentAnnotation && (() => {
              const anchor = currentAnnotation.anchor as unknown as GalleryAnchor
              const screenshotUrl = anchor?.screenshotUrl
              const pageName = anchor?.pageName
              const pageType = anchor?.pageType
              const criterionLabel = currentAnnotation.rubricItemId
                ? criterionById[currentAnnotation.rubricItemId] ?? null
                : null

              // Page-type icon: document for content pages, compass for nav, flag for checkpoints
              // Matches the extension's SVG_PAGE_NAV/CHECKPOINT/CONTENT constants exactly.
              const PageIcon = pageType === 'nav' ? (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
              ) : pageType === 'checkpoint' ? (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              )

              return (
                <div
                  data-annotation-id={currentAnnotation.id}
                  className="rounded-xl bg-surface-card shadow-1 overflow-hidden"
                >
                  {/* Screenshot or no-screenshot placeholder */}
                  {screenshotUrl ? (
                    <img
                      src={screenshotUrl}
                      alt="Page screenshot"
                      className="w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-48 bg-surface-elevated">
                      <span className="text-label-sm text-text-muted">NO SCREENSHOT AVAILABLE</span>
                    </div>
                  )}

                  {/* Annotation info block */}
                  <div className="p-4 space-y-3">
                    {/* Page name row — icon + name (Newsreader, criterion-name size) + "View full card" right-aligned */}
                    {pageName && (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0 text-text-primary">
                            {PageIcon}
                            <span className="text-body-md font-heading font-semibold text-text-primary truncate">{pageName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onAnnotationViewFull?.(currentAnnotation.id)}
                            className="shrink-0 inline-flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity text-secondary"
                          >
                            <span className="text-body-sm font-body whitespace-nowrap">View full card</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        </div>
                        <hr className="border-border" />
                      </>
                    )}

                    {/* COMMENT */}
                    <div className="space-y-1">
                      <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">Comment</span>
                      <p className="text-body-sm text-text-secondary break-words hyphens-auto line-clamp-3">{currentAnnotation.body}</p>
                    </div>

                    {/* TAGS */}
                    {currentAnnotation.tag && (
                      <div className="flex items-center gap-2">
                        <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary shrink-0">Tags:</span>
                        <TagChip tag={currentAnnotation.tag} />
                      </div>
                    )}

                    {/* CRITERION */}
                    {criterionLabel && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary shrink-0">Criterion:</span>
                        <span className="px-2.5 py-0.5 rounded-full text-label-sm bg-surface-container text-text-secondary border border-border">
                          {criterionLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
