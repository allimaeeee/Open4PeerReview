'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { HighlightTag } from '@/types'
import type { ReviewEventType } from '@/hooks/useReviewTracking'
import type { Json } from '@/types/database.types'
import { selectionToAnchor, applyHighlights } from '@/lib/anchoring/html'
import { AnnotationPopup } from './AnnotationPopup'
import { AnnotationHoverCard } from './AnnotationHoverCard'

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

// ── Component ─────────────────────────────────────────────────────────────────

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
  onAnnotationRelink?: (annotationId: string, newRubricItemIds: string[], updates: { body: string; tag: HighlightTag | null }) => Promise<void>
  onTrackEvent: (type: ReviewEventType, data?: Json) => void
  disabled: boolean
  onGoToAnnotation?: (annotationId: string) => void
  onAnnotationViewFull?: (annotationId: string) => void
  scrollToAnnotationId?: string | null
  pulseAnnotationId?: string | null
  onPulseComplete?: () => void
}

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
  onAnnotationRelink,
  onTrackEvent,
  disabled,
  onGoToAnnotation,
  onAnnotationViewFull,
  scrollToAnnotationId,
  pulseAnnotationId,
  onPulseComplete,
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
  const [tooltipPos, setTooltipPos] = useState<{ x: number; selectionTop: number; selectionBottom: number } | null>(null)

  // ── Hover card state ───────────────────────────────────────────────────────
  const [hoverAnnotation, setHoverAnnotation] = useState<SavedAnnotation | null>(null)
  const [hoverPos,        setHoverPos]        = useState<{ x: number; y: number } | null>(null)
  const [isHoveringCard,  setIsHoveringCard]  = useState(false)
  const isHoveringCardRef = useRef(false)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)

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
  const originalHtmlRef = useRef<string | null>(null)

  // Stable callback refs — updated every render so mark handlers never go stale
  const onMarkClickRef = useRef<(id: string, x: number, y: number) => void>(() => {})
  const onMarkHoverRef = useRef<(id: string | null, x: number, y: number) => void>(() => {})

  // ── Hide timer cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  // ── Coord conversion: iframe viewport → container-relative ────────────────
  const iframeToContainer = useCallback((iframeX: number, iframeY: number): { x: number; y: number } => {
    const iframe    = iframeRef.current
    const container = containerRef.current
    if (!iframe || !container) return { x: iframeX, y: iframeY }
    const ir = iframe.getBoundingClientRect()
    const cr = container.getBoundingClientRect()
    return { x: iframeX + ir.left - cr.left, y: iframeY + ir.top - cr.top }
  }, [])

  // ── Helper to keep isHoveringCard state and ref in sync ───────────────────
  function setHoveringCard(val: boolean) {
    isHoveringCardRef.current = val
    setIsHoveringCard(val)
  }

  // ── Update stable refs every render ───────────────────────────────────────
  onMarkClickRef.current = (annId, clientX, clientY) => {
    if (disabled) return
    const ann = savedAnnotations.find(a => a.id === annId)
    if (!ann) return
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setHoverAnnotation(ann)
    setHoverPos(iframeToContainer(clientX, clientY))
  }

  onMarkHoverRef.current = (annId, clientX, clientY) => {
    if (pendingSelection) return
    if (annId === null) {
      hideTimerRef.current = setTimeout(() => {
        if (!isHoveringCardRef.current) {
          setHoverAnnotation(null)
          setHoverPos(null)
        }
      }, 120)
    } else {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      const ann = savedAnnotations.find(a => a.id === annId)
      if (!ann) return
      setHoverAnnotation(ann)
      setHoverPos(iframeToContainer(clientX, clientY))
    }
  }

  // ── Re-inject highlights when annotations change or iframe first loads ───────
  useEffect(() => {
    if (!iframeReady) return
    const doc = iframeRef.current?.contentDocument
    if (!doc || originalHtmlRef.current === null) return

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

    try {
      const href = iframe.contentWindow?.location.href ?? ''
      const escaped = href !== '' && href !== 'about:blank' && !href.startsWith(window.location.origin)
      if (escaped) {
        setIframeReady(false)
        iframe.src = activeSnapshotSrc
        setNavBannerVisible(true)
        setTimeout(() => setNavBannerVisible(false), 4000)
        return
      }
    } catch {
      setIframeReady(false)
      iframe.src = activeSnapshotSrc
      setNavBannerVisible(true)
      setTimeout(() => setNavBannerVisible(false), 4000)
      return
    }

    const doc = iframe.contentDocument
    if (!doc) return

    originalHtmlRef.current = doc.body.innerHTML
    setIframeReady(true)

    // Inject pulse animation CSS — parent stylesheet doesn't apply inside the iframe document
    const style = doc.createElement('style')
    style.textContent = [
      '@keyframes highlight-pulse {',
      '  0%   { background-color: rgba(115,92,0,0.35); box-shadow: 0 0 0 3px rgba(115,92,0,0.25); }',
      '  40%  { background-color: rgba(254,214,91,0.80); box-shadow: 0 0 0 1px rgba(115,92,0,0.15); }',
      '  100% { background-color: rgba(254,214,91,0.80); box-shadow: none; }',
      '}',
      '.annotation-highlight.active {',
      '  background-color: rgba(254,214,91,0.80);',
      '  animation: highlight-pulse 1.6s ease-out 2 forwards;',
      '}',
      '::selection { background: rgba(254,214,91,0.45); }',
    ].join('\n')
    doc.head.appendChild(style)

    const handleMouseUp = () => {
      if (disabled) return
      const win = iframe.contentWindow
      if (!win) return

      const anchor = selectionToAnchor(win)
      if (!anchor) return

      const sel = win.getSelection()
      if (!sel || sel.isCollapsed) return
      const range = sel.getRangeAt(0)
      const rects = Array.from(range.getClientRects())
      const first = rects[0]
      const last  = rects[rects.length - 1]
      if (first && last) {
        const pos = iframeToContainer(last.left + (last.right - last.left) / 2, last.top)
        setTooltipPos({
          x:               pos.x,
          selectionTop:    iframeToContainer(0, first.top).y,
          selectionBottom: iframeToContainer(0, last.bottom).y,
        })
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

  // ── handleGoToAnnotation ──────────────────────────────────────────────────
  function handleGoToAnnotation(annotationId: string) {
    const iframeDoc = iframeRef.current?.contentDocument
    if (iframeDoc) {
      const mark = iframeDoc.querySelector(`[data-annotation-id="${annotationId}"]`)
      if (mark) {
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    onGoToAnnotation?.(annotationId)
  }

  // ── React to scrollToAnnotationId from parent ──────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (scrollToAnnotationId) handleGoToAnnotation(scrollToAnnotationId)
  }, [scrollToAnnotationId])

  // ── Pulse active annotation after scroll completes ─────────────────────────
  useEffect(() => {
    if (!pulseAnnotationId) return

    let cleanupTimer: ReturnType<typeof setTimeout>

    const timer = setTimeout(() => {
      const iframeDoc = iframeRef.current?.contentDocument
      const mark = iframeDoc?.querySelector(`[data-annotation-id="${pulseAnnotationId}"]`)
      if (!mark) return

      mark.classList.add('active')

      cleanupTimer = setTimeout(() => {
        mark.classList.remove('active')
        onPulseComplete?.()
      }, 3300)
    }, 400)

    return () => {
      clearTimeout(timer)
      clearTimeout(cleanupTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseAnnotationId])

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

        {/* Hover card — appears when hovering or clicking a highlight mark */}
        {hoverAnnotation && hoverPos && !disabled && (() => {
          const anchorKey = JSON.stringify(hoverAnnotation.anchor)
          const linkedCriteriaIds = savedAnnotations
            .filter(a => JSON.stringify(a.anchor) === anchorKey && a.rubricItemId !== null)
            .map(a => a.rubricItemId as string)
          return (
            <AnnotationHoverCard
              annotation={hoverAnnotation}
              criterionLabel={
                hoverAnnotation.rubricItemId
                  ? (rubricItems.find(r => r.id === hoverAnnotation.rubricItemId)?.label ?? null)
                  : null
              }
              criteria={rubricItems}
              linkedCriteriaIds={linkedCriteriaIds}
              position={hoverPos}
              onSave={(updates) => onAnnotationEdit(hoverAnnotation.id, updates)}
              onRelink={onAnnotationRelink
                ? (newIds, updates) => onAnnotationRelink(hoverAnnotation.id, newIds, updates)
                : undefined}
              onDelete={() => {
                onAnnotationDelete(hoverAnnotation.id)
                setHoverAnnotation(null)
                setHoverPos(null)
              }}
              onViewFullComment={onAnnotationViewFull ? () => onAnnotationViewFull(hoverAnnotation.id) : undefined}
              onMouseEnter={() => {
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
                setHoveringCard(true)
              }}
              onMouseLeave={() => {
                setHoveringCard(false)
                setHoverAnnotation(null)
                setHoverPos(null)
              }}
            />
          )
        })()}

        {/* Backdrop — catches outside clicks while popup is open */}
        {pendingSelection && tooltipPos && !disabled && (
          <div className="absolute inset-0 z-[29]" onMouseDown={() => { iframeRef.current?.contentWindow?.getSelection()?.removeAllRanges(); onPendingSelectionClear() }} />
        )}

        {/* Create-annotation popup */}
        {pendingSelection && tooltipPos && !disabled && (
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
