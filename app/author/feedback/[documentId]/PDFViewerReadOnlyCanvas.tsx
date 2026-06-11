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
}

interface Props {
  fileUrl: string
  annotations: ReadOnlyAnnotation[]
  focusAnnotationId: string | null
}

export default function PDFViewerReadOnlyCanvas({ fileUrl, annotations, focusAnnotationId }: Props) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focusAnnotationId) return
    const ann = annotations.find(a => a.id === focusAnnotationId)
    const page = (ann?.anchor as any)?.page
    if (typeof page === 'number') setCurrentPage(page)
  }, [focusAnnotationId, annotations])

  const pageWidth = Math.min((containerRef.current?.clientWidth ?? 800) - 32, 900)

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
                return (
                  <div
                    key={`${ann.id}-${i}`}
                    className={[
                      'absolute rounded-sm pointer-events-none transition-all',
                      isFocused
                        ? 'bg-amber-300/60 ring-2 ring-amber-500/60'
                        : ann.tag
                          ? (HIGHLIGHT_BG[ann.tag] ?? HIGHLIGHT_BG_DEFAULT)
                          : HIGHLIGHT_BG_DEFAULT,
                    ].join(' ')}
                    style={{
                      left:   rect.x1,
                      top:    rect.y1,
                      width:  Math.max(2, rect.x2 - rect.x1),
                      height: Math.max(3, rect.y2 - rect.y1),
                    }}
                  />
                )
              }
            )
          )}
      </div>
    </div>
  )
}
