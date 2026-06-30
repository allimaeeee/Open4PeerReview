'use client'

import { useState, useEffect, useCallback } from 'react'
import ViewerPanelHeader from './ViewerPanelHeader'

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
}

type GalleryAnchor = BboxAnchor | PointAnchor

interface SavedAnnotation {
  id: string
  anchor: Record<string, unknown>
  body: string
  tag: string | null
  rubricItemId: string | null
}

interface TorusAnnotationViewerProps {
  sourceUrl: string | null
  courseAccessCode: string | null
  savedAnnotations: SavedAnnotation[]
  rubricItems: { id: string; label: string }[]
  onBack: () => void
  disabled: boolean
  scrollToAnnotationId?: string | null
  onGoToAnnotation?: () => void
  onAnnotationViewFull?: (annotationId: string) => void
}

export function TorusAnnotationViewer({
  sourceUrl,
  courseAccessCode,
  savedAnnotations,
  rubricItems,
  onBack,
  scrollToAnnotationId,
  onGoToAnnotation,
  onAnnotationViewFull,
}: TorusAnnotationViewerProps) {
  const criterionById = Object.fromEntries(rubricItems.map(r => [r.id, r.label]))

  const galleryAnnotations = savedAnnotations.filter(ann => {
    const anchorType = (ann.anchor as { type?: unknown }).type
    return anchorType === 'bbox' || anchorType === 'point'
  })

  const [activeIdx, setActiveIdx] = useState(0)
  const total = galleryAnnotations.length
  const clampedIdx = total > 0 ? Math.min(activeIdx, total - 1) : 0
  const current = galleryAnnotations[clampedIdx] ?? null

  useEffect(() => {
    if (!scrollToAnnotationId) return
    const idx = galleryAnnotations.findIndex(a => a.id === scrollToAnnotationId)
    if (idx !== -1) {
      setActiveIdx(idx)
      onGoToAnnotation?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToAnnotationId])

  const prev = useCallback(() => setActiveIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setActiveIdx(i => Math.min(total - 1, i + 1)), [total])

  const anchor = current ? (current.anchor as unknown as GalleryAnchor) : null
  const screenshotUrl = anchor && 'screenshotUrl' in anchor ? anchor.screenshotUrl : undefined
  const textQuote = anchor && 'textQuote' in anchor ? (anchor as BboxAnchor).textQuote : undefined
  const pageName = anchor?.pageName
  const pageUrl = anchor?.pageUrl ?? sourceUrl ?? '#'
  const criterionLabel = current?.rubricItemId ? criterionById[current.rubricItemId] ?? null : null

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface">
      <ViewerPanelHeader
        onBack={onBack}
        centerSlot={
          <span className="text-body-sm font-semibold text-text-primary">OLI Torus</span>
        }
      />

      {/* Course URL bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-card border-b border-border">
        <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 text-body-sm text-primary hover:underline truncate"
          >
            {sourceUrl}
          </a>
        ) : (
          <span className="flex-1 text-body-sm text-text-muted">No course URL</span>
        )}
        <a
          href={sourceUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label-sm font-semibold bg-primary text-on-primary hover:bg-primary-hover transition-colors"
        >
          Open in Torus
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
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
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-label-md font-semibold bg-primary text-on-primary hover:bg-primary-hover transition-colors"
            >
              Open in Torus
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      ) : (
        <>
          {/* Gallery navigation bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-card">
            <button
              onClick={prev}
              disabled={clampedIdx === 0}
              className="p-1.5 rounded-md text-text-secondary hover:bg-surface-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous annotation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="flex-1 text-center text-body-sm text-text-secondary tabular-nums">
              {clampedIdx + 1} <span className="text-text-muted">of</span> {total}
            </span>
            <button
              onClick={next}
              disabled={clampedIdx === total - 1}
              className="p-1.5 rounded-md text-text-secondary hover:bg-surface-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next annotation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Active annotation card */}
          {current && (
            <div
              className="flex-1 overflow-y-auto"
              onClick={() => onAnnotationViewFull?.(current.id)}
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
                  <a
                    href={pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-label-sm font-semibold bg-surface-card/90 backdrop-blur-sm text-primary border border-primary/30 hover:bg-primary hover:text-on-primary transition-colors"
                  >
                    View annotation
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
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
                <p className="text-body-md text-text-primary">{current.body}</p>

                {/* View link when there's no screenshot */}
                {!screenshotUrl && (
                  <a
                    href={pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-label-sm text-primary hover:underline"
                  >
                    View annotation
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Thumbnail strip */}
          <div className="shrink-0 flex gap-1.5 p-2 border-t border-border bg-surface-card overflow-x-auto">
            {galleryAnnotations.map((ann, idx) => {
              const annAnchor = ann.anchor as { screenshotUrl?: string; type?: string }
              const thumb = annAnchor.screenshotUrl
              const isActive = idx === clampedIdx
              return (
                <button
                  key={ann.id}
                  onClick={() => setActiveIdx(idx)}
                  className={[
                    'shrink-0 w-14 h-9 rounded overflow-hidden border-2 transition-all',
                    isActive ? 'border-primary shadow-sm' : 'border-transparent opacity-60 hover:opacity-100 hover:border-border',
                  ].join(' ')}
                  aria-label={`Annotation ${idx + 1}`}
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
                      {annAnchor.type === 'point' ? (
                        <svg className="w-3.5 h-3.5 text-primary" fill="currentColor" viewBox="0 0 28 36">
                          <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" />
                        </svg>
                      ) : (
                        <span className="text-xs font-semibold text-text-muted">{idx + 1}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
