import type { FeedbackResponseStatus } from '@/types'
import { AddressStatusControl } from '@/components/ui/AddressStatusControl'

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

interface AnnotationRecord {
  id: string
  rubric_item_id: string | null
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

interface EvidenceCardProps {
  annotation: AnnotationRecord
  className?: string
  onGoToAnnotation?: () => void
  goToLabel?: string
  screenshotNumber?: number
  /** When true, show the author-only "addressed / will address later" control. */
  showStatusControl?: boolean
  status?: FeedbackResponseStatus | null
  onStatusChange?: (status: FeedbackResponseStatus | null) => void
}

function getAnchorType(anchor: Record<string, unknown>): 'html' | 'pdf' | 'torus' | 'free-note' {
  if (!anchor || Object.keys(anchor).length === 0) return 'free-note'
  if (anchor.type === 'html-char-offset') return 'html'
  if (anchor.type === 'pdf-rect') return 'pdf'
  if (anchor.type === 'bbox' || anchor.type === 'point') return 'torus'
  return 'free-note'
}

const TAG_CONFIG: Record<'action_item' | 'quick_fix', { label: string; bg: string; text: string; border: string }> = {
  action_item: {
    label:  'Action Item',
    bg:     'var(--color-rating-dnm-bg)',
    text:   'var(--color-rating-dnm-text)',
    border: 'var(--color-rating-dnm-border)',
  },
  quick_fix: {
    label:  'Quick Fix',
    bg:     'var(--color-status-assigned-bg)',
    text:   'var(--color-primary)',
    border: 'var(--color-border)',
  },
}

export function EvidenceCard({ annotation, className, onGoToAnnotation, goToLabel, screenshotNumber, showStatusControl, status, onStatusChange }: EvidenceCardProps) {
  const anchorType        = getAnchorType(annotation.anchor)
  const isLinkedHighlight = anchorType !== 'free-note'
  const rawType           = annotation.anchor.type as string | undefined
  const tag               = (annotation.tag === 'action_item' || annotation.tag === 'quick_fix')
    ? annotation.tag
    : null

  // Torus-specific anchor data
  const isTorus     = rawType === 'bbox' || rawType === 'point' || rawType === 'html-char-offset'
  const pageName    = isTorus ? (annotation.anchor.pageName as string | undefined) : undefined
  const pageType    = isTorus ? (annotation.anchor.pageType as string | undefined) : undefined
  const isHotspot   = rawType === 'point'
  const hasScreenshot = isTorus && !!(annotation.anchor.screenshotUrl as string | undefined)

  // Non-Torus html-char-offset stores text in a flat anchor.text field.
  // Torus html-char-offset (extension) stores it in anchor.selector[].exact (TextQuoteSelector).
  // Torus bbox stores it in anchor.textQuote.
  const quotedText: string | undefined = (() => {
    if (rawType === 'html-char-offset') {
      if (annotation.anchor.text) return annotation.anchor.text as string
      const selectors = annotation.anchor.selector as Array<Record<string, unknown>> | undefined
      if (Array.isArray(selectors)) {
        const tqs = selectors.find(s => s.type === 'TextQuoteSelector')
        if (tqs?.exact) return tqs.exact as string
      }
    }
    if (rawType === 'bbox') return annotation.anchor.textQuote as string | undefined
    return undefined
  })()

  // Page-type icon matching carousel and extension
  const PageIcon = pageType === 'nav' ? (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ) : pageType === 'checkpoint' ? (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  ) : (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  )

  const linkLabel = `${goToLabel ?? 'Go to Annotation'} ↗`

  return (
    <div
      className={cx(
        'rounded-md border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-3 flex flex-col gap-2',
        className
      )}
    >
      {/* Page name row — Torus only, when pageName exists */}
      {isTorus && pageName && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0 text-[var(--color-text-primary)]">
              {PageIcon}
              <span className="text-body-md font-heading font-semibold text-[var(--color-text-primary)] truncate">
                {pageName}
              </span>
              {screenshotNumber != null && hasScreenshot && (
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-label-sm bg-[var(--color-surface-container)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  Screenshot #{screenshotNumber}
                </span>
              )}
            </div>
            {onGoToAnnotation && (
              <button
                type="button"
                onClick={onGoToAnnotation}
                className="shrink-0 text-body-sm text-[var(--color-secondary)] underline-offset-2 hover:underline whitespace-nowrap"
              >
                {linkLabel}
              </button>
            )}
          </div>
          <hr className="border-[var(--color-border)]" />
        </>
      )}

      {/* Annotated text / hotspot section — for all linked highlights */}
      {isLinkedHighlight && (
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {isHotspot ? 'Hotspot' : 'Annotated Text'}
            </span>
            {/* Link lives here only when there is no page-name row above (non-Torus) */}
            {!pageName && onGoToAnnotation && (
              <button
                type="button"
                onClick={onGoToAnnotation}
                className="shrink-0 text-body-sm text-[var(--color-secondary)] underline-offset-2 hover:underline"
              >
                {linkLabel}
              </button>
            )}
          </div>
          {isHotspot ? (
            <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-3 h-4 shrink-0" viewBox="0 0 28 36" fill="currentColor" aria-hidden="true">
                <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" />
              </svg>
              <span className="text-body-sm italic">Hotspot annotation</span>
            </div>
          ) : quotedText ? (
            <blockquote
              className="pl-3 italic text-body-sm text-[var(--color-text-secondary)] leading-relaxed"
              style={{ borderLeft: '2px solid var(--color-secondary)' }}
            >
              {quotedText}
            </blockquote>
          ) : null}
        </div>
      )}

      {/* COMMENT heading + body — always shown */}
      <div className="space-y-1">
        <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Comment
        </span>
        <p className="text-body-sm text-[var(--color-text-primary)] leading-relaxed break-words hyphens-auto">
          {annotation.body}
        </p>
      </div>

      {/* TAGS row — below comment, only when a tag exists */}
      {tag && (
        <div className="flex items-center gap-2">
          <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)] shrink-0">
            Tags:
          </span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label font-semibold border"
            style={{
              backgroundColor: TAG_CONFIG[tag].bg,
              color:           TAG_CONFIG[tag].text,
              borderColor:     TAG_CONFIG[tag].border,
            }}
          >
            {TAG_CONFIG[tag].label}
          </span>
        </div>
      )}

      {/* Author-only status control */}
      {showStatusControl && onStatusChange && (
        <div className="pt-2 mt-1 border-t border-[var(--color-border)]">
          <AddressStatusControl status={status ?? null} onChange={onStatusChange} />
        </div>
      )}
    </div>
  )
}
