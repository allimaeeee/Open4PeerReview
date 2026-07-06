'use client'

import { useEffect, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import ViewerPanelHeader from './ViewerPanelHeader'
import { openInTorus } from '@/lib/torus'

interface BboxAnchor {
  type: 'bbox'
  screenshotUrl?: string
  pageUrl?: string
  pageName?: string
  textQuote?: string
}

interface PointAnchor {
  type: 'point'
  pageUrl?: string
  pageName?: string
  screenshotUrl?: string
}

interface HtmlCharOffsetAnchor {
  type: 'html-char-offset'
  screenshotUrl?: string
  pageUrl?: string
  pageName?: string
  selector?: Array<{ type: string; exact?: string; prefix?: string; suffix?: string }>
}

type GalleryAnchor = BboxAnchor | PointAnchor | HtmlCharOffsetAnchor

interface SavedAnnotation {
  id: string
  anchor: Record<string, unknown>
  body: string
  tag: string | null
  rubricItemId: string | null
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
}: TorusAnnotationViewerProps) {
  const handleOpenInTorus = () => {
    if (supabase) {
      openInTorus(supabase, sourceUrl, reviewId ?? null)
    } else if (sourceUrl) {
      window.open(sourceUrl, '_blank', 'noopener,noreferrer')
    }
  }

  // "View annotation" → open the exact Torus page this annotation lives on and ask
  // the extension (via oer_goto) to scroll to it and expand its criterion.
  const handleViewAnnotation = (annotationId: string, pageUrl: string) => {
    if (supabase) {
      openInTorus(supabase, sourceUrl, reviewId ?? null, { pageUrl, annotationId })
    } else {
      const target = pageUrl && pageUrl !== '#' ? pageUrl : sourceUrl
      if (!target) return
      const sep = target.includes('?') ? '&' : '?'
      window.open(`${target}${sep}oer_goto=${encodeURIComponent(annotationId)}`, '_blank', 'noopener,noreferrer')
    }
  }

  const criterionById = Object.fromEntries(rubricItems.map(r => [r.id, r.label]))

  const galleryAnnotations = savedAnnotations.filter(ann => {
    const anchorType = (ann.anchor as { type?: unknown }).type
    return anchorType === 'bbox' || anchorType === 'point' || anchorType === 'html-char-offset'
  })

  const total = galleryAnnotations.length
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll to a specific screenshot when "View annotation" is clicked in the right-hand panel.
  useEffect(() => {
    if (!scrollToAnnotationId) return
    const el = containerRef.current?.querySelector(`[data-annotation-id="${scrollToAnnotationId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    onGoToAnnotation?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToAnnotationId])

  // Pulse-highlight the target screenshot once the scroll above has had time to settle.
  useEffect(() => {
    if (!pulseAnnotationId) return
    let cleanupTimer: ReturnType<typeof setTimeout>
    const timer = setTimeout(() => {
      const el = containerRef.current?.querySelector(`[data-annotation-id="${pulseAnnotationId}"]`)
      if (!el) { onPulseComplete?.(); return }
      el.classList.add('card-highlight', 'active')
      cleanupTimer = setTimeout(() => {
        el.classList.remove('card-highlight', 'active')
        onPulseComplete?.()
      }, 1600)
    }, 400)
    return () => { clearTimeout(timer); clearTimeout(cleanupTimer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseAnnotationId])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface">
      <ViewerPanelHeader
        onBack={onBack}
        centerSlot={
          <span className="text-body-sm font-semibold text-text-primary">
            OLI Torus{total > 0 ? ` · ${total} screenshot${total === 1 ? '' : 's'}` : ''}
          </span>
        }
      />

      {/* Course URL bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-card border-b border-border">
        <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        {sourceUrl ? (
          <button
            type="button"
            onClick={handleOpenInTorus}
            className="flex-1 min-w-0 text-body-sm text-primary hover:underline truncate text-left"
          >
            {sourceUrl}
          </button>
        ) : (
          <span className="flex-1 text-body-sm text-text-muted">No course URL</span>
        )}
        {!disabled && (
          <button
            type="button"
            onClick={handleOpenInTorus}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover transition-colors"
          >
            Open in Torus
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        )}
      </div>

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
        /* Continuous feed — every screenshot is visible at once, no paging required */
        <div ref={containerRef} className="flex-1 overflow-y-auto divide-y divide-border">
          {galleryAnnotations.map(ann => {
            const anchor = ann.anchor as unknown as GalleryAnchor
            const screenshotUrl = anchor?.screenshotUrl
            const textQuote = anchor
              ? 'textQuote' in anchor
                ? (anchor as BboxAnchor).textQuote
                : 'selector' in anchor
                  ? (anchor as HtmlCharOffsetAnchor).selector?.find(s => s.type === 'TextQuoteSelector')?.exact
                  : undefined
              : undefined
            const pageName = anchor?.pageName
            const pageUrl = anchor?.pageUrl ?? sourceUrl ?? '#'
            const criterionLabel = ann.rubricItemId ? criterionById[ann.rubricItemId] ?? null : null

            return (
              <div
                key={ann.id}
                data-annotation-id={ann.id}
                onClick={() => onAnnotationViewFull?.(ann.id)}
                className="cursor-pointer transition-colors hover:bg-surface-elevated/50 rounded-lg"
              >
                {/* Screenshot */}
                {screenshotUrl ? (
                  <div className="relative">
                    <img
                      src={screenshotUrl}
                      alt="Page screenshot"
                      className="w-full object-cover object-top"
                      style={{ maxHeight: '55vh' }}
                    />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleViewAnnotation(ann.id, pageUrl) }}
                      className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-label-sm font-semibold bg-surface-card/90 backdrop-blur-sm text-primary border border-primary/30 hover:bg-primary hover:text-on-primary transition-colors"
                    >
                      View annotation
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  /* No screenshot — hotspot or unscreenshotted annotation */
                  <div className="flex items-center justify-center h-32 bg-surface-elevated border-b border-border">
                    <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                )}

                <div className="p-4 space-y-2.5">
                  {/* Page name */}
                  {pageName && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                      <span className="text-label-sm text-text-muted truncate">{pageName}</span>
                    </div>
                  )}

                  {/* Criterion */}
                  <p className={[
                    'text-label-sm font-semibold',
                    criterionLabel ? 'text-primary' : 'text-text-muted',
                  ].join(' ')}>
                    {criterionLabel ?? 'General note'}
                  </p>

                  {/* Text quote (for text highlights converted on Torus) */}
                  {textQuote && (
                    <p className="text-body-sm text-text-secondary italic border-l-2 border-border pl-2.5 line-clamp-3">
                      &ldquo;{textQuote}&rdquo;
                    </p>
                  )}

                  {/* Annotation body */}
                  <p className="text-body-md text-text-primary">{ann.body}</p>

                  {/* View link when there's no screenshot */}
                  {!screenshotUrl && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleViewAnnotation(ann.id, pageUrl) }}
                      className="inline-flex items-center gap-1.5 text-label-sm text-primary hover:underline"
                    >
                      View annotation
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
