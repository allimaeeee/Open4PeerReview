'use client'

import { useState, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const HIGHLIGHT_BG: Record<string, string> = {
  action_item: 'bg-orange-300/40',
  quick_fix:   'bg-blue-300/40',
}
const HIGHLIGHT_BG_DEFAULT = 'bg-slate-400/30'

export interface ReadOnlyAnnotation {
  id: string
  anchor: unknown
  tag: string | null
  body: string
  rubricItemLabel: string | null
}

interface Props {
  fileUrl: string
  annotations: ReadOnlyAnnotation[]
  focusAnnotationId: string | null
}

interface HoverState {
  ann: ReadOnlyAnnotation
  x: number
  y: number
}

export default function PDFViewerReadOnlyCanvas({ fileUrl, annotations, focusAnnotationId }: Props) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [hover, setHover] = useState<HoverState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focusAnnotationId) return
    const ann = annotations.find(a => a.id === focusAnnotationId)
    const page = (ann?.anchor as any)?.page
    if (typeof page === 'number') setCurrentPage(page)
  }, [focusAnnotationId, annotations])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.clientWidth)
    const obs = new ResizeObserver(entries => setContainerWidth((entries[0].target as HTMLElement).clientWidth))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const pageWidth = Math.min(containerWidth - 32, 900)

  function scaleRect(
    rect: { x1: number; y1: number; x2: number; y2: number },
    anchor: any,
  ) {
    const storedPW: number = anchor?.pageWidth
    const storedCW: number = anchor?.containerWidth
    if (!storedPW || !storedCW) return rect

    const storedOffsetX = 16 + Math.max(0, (storedCW - 32 - storedPW) / 2)
    const scale = pageWidth / storedPW
    const newOffsetX = 16 + Math.max(0, (containerWidth - 32 - pageWidth) / 2)

    return {
      x1: newOffsetX + (rect.x1 - storedOffsetX) * scale,
      y1: 24 + (rect.y1 - 24) * scale,
      x2: newOffsetX + (rect.x2 - storedOffsetX) * scale,
      y2: 24 + (rect.y2 - 24) * scale,
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
          onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative flex justify-center py-6 px-4"
      >
        {loadError ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-red-500 font-medium">{loadError}</p>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={err => setLoadError(err.message)}
          >
            <Page
              pageNumber={currentPage}
              renderTextLayer
              renderAnnotationLayer={false}
              className="shadow-lg rounded"
              width={pageWidth}
            />
          </Document>
        )}

        {annotations
          .filter(ann => (ann.anchor as any)?.page === currentPage)
          .flatMap(ann =>
            ((ann.anchor as any)?.rects ?? []).map(
              (rect: { x1: number; y1: number; x2: number; y2: number }, i: number) => {
                const isFocused = ann.id === focusAnnotationId
                const r = scaleRect(rect, ann.anchor)
                return (
                  <div
                    key={`${ann.id}-${i}`}
                    className={[
                      'absolute rounded-sm transition-all cursor-default',
                      isFocused
                        ? 'bg-amber-300/60 ring-2 ring-amber-500/60'
                        : ann.tag
                          ? (HIGHLIGHT_BG[ann.tag] ?? HIGHLIGHT_BG_DEFAULT)
                          : HIGHLIGHT_BG_DEFAULT,
                    ].join(' ')}
                    style={{
                      left:   r.x1,
                      top:    r.y1 + 10,
                      width:  Math.max(2, r.x2 - r.x1),
                      height: Math.max(3, r.y2 - r.y1),
                    }}
                    onMouseEnter={() => setHover({ ann, x: (r.x1 + r.x2) / 2, y: r.y1 + 10 })}
                    onMouseLeave={() => setHover(null)}
                  />
                )
              }
            )
          )}

        {hover && (
          <div
            className="absolute z-50 pointer-events-none bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2.5 w-72"
            style={{
              left: Math.max(8, Math.min(hover.x - 144, containerWidth - 296)),
              top: hover.y,
              transform: 'translateY(calc(-100% - 8px))',
            }}
          >
            {hover.ann.rubricItemLabel && (
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                {hover.ann.rubricItemLabel}
              </p>
            )}
            {hover.ann.tag && (
              <span className={[
                'inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide mb-1.5',
                hover.ann.tag === 'quick_fix'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-orange-50 text-orange-700',
              ].join(' ')}>
                {hover.ann.tag === 'quick_fix' ? 'Quick Fix' : 'Action Item'}
              </span>
            )}
            <p className="text-[11px] text-slate-700 leading-snug">{hover.ann.body}</p>
            {(hover.ann.anchor as any)?.text && (
              <p className="mt-1 text-[10px] text-slate-400 italic line-clamp-2">
                &ldquo;{(hover.ann.anchor as any).text}&rdquo;
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
