'use client'

// Lazy-load react-pdf so it never runs during SSR (pdf.js needs DOMMatrix).

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type PDFViewerCanvas from './PDFViewerCanvas'

export type { TextSelection, AnnotationConfirmPayload } from './PDFViewerCanvas'

const PDFViewerCanvasDynamic = dynamic(() => import('./PDFViewerCanvas'), {
  ssr: false,
  loading: () => <PDFViewerPlaceholder />,
})

type PDFViewerProps = ComponentProps<typeof PDFViewerCanvas>

export function PDFViewer(props: PDFViewerProps) {
  return <PDFViewerCanvasDynamic {...props} />
}

function PDFViewerPlaceholder() {
  return (
    <div className="h-full flex flex-col bg-slate-100">
      <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-slate-200">
        <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="flex-1 flex justify-center items-start py-6 px-4">
        <div className="w-[700px] h-[900px] bg-white rounded shadow-lg animate-pulse flex flex-col gap-4 p-10">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="h-3 bg-slate-200 rounded"
              style={{ width: `${65 + (i % 4) * 8}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
