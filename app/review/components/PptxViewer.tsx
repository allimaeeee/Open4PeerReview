'use client'

// Dynamic wrapper so PptxViewerCanvas (which uses browser APIs — DOMParser, JSZip)
// is never executed during SSR.

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type PptxViewerCanvas from './PptxViewerCanvas'

export type { AnnotationConfirmPayload, SavedAnnotation } from './PptxViewerCanvas'

const PptxViewerCanvasDynamic = dynamic(() => import('./PptxViewerCanvas'), {
  ssr: false,
  loading: () => <PptxViewerPlaceholder />,
})

type PptxViewerProps = ComponentProps<typeof PptxViewerCanvas>

export function PptxViewer(props: PptxViewerProps) {
  return <PptxViewerCanvasDynamic {...props} />
}

function PptxViewerPlaceholder() {
  return (
    <div className="h-full flex flex-col bg-slate-100">
      <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-slate-200">
        <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="flex-1 flex justify-center items-start py-6 px-4">
        <div className="w-full max-w-[900px] min-h-[400px] bg-white rounded shadow-lg animate-pulse flex flex-col gap-4 p-10">
          <div className="h-4 bg-slate-200 rounded w-1/4" />
          <div className="h-6 bg-slate-200 rounded w-2/3" />
          <div className="mt-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-3 bg-slate-200 rounded" style={{ width: `${60 + (i % 5) * 7}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
