'use client'

import { useState } from 'react'
import { UploadDocumentForm } from './UploadDocumentForm'

interface RubricRow {
  id: string
  title: string
  description: string | null
}

interface DocumentRow {
  id: string
  title: string
  file_type: string
  created_at: string
  document_rubrics: { rubric: { id: string; title: string } | null }[]
  reviews: { id: string; status: string }[]
}

interface Props {
  documents: DocumentRow[]
  rubrics: RubricRow[]
}

const FILE_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  html: 'HTML',
  image: 'Image',
  audio: 'Audio',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AuthorDashboardClient({ documents, rubrics }: Props) {
  const [showUpload, setShowUpload] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My Documents</h2>
          <p className="text-sm text-slate-500 mt-0.5">Upload OER documents and assign rubrics for peer review.</p>
        </div>
        {!showUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-medium hover:bg-[#162d4a] transition-colors shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Document
          </button>
        )}
      </div>

      {showUpload && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-5">Upload a New Document</h3>
          <UploadDocumentForm rubrics={rubrics} onCancel={() => setShowUpload(false)} />
        </div>
      )}

      {documents.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-600">No documents yet</p>
          <p className="mt-1 text-xs text-slate-400">Upload your first document to get started.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            Upload Document
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => {
            const rubricList = doc.document_rubrics
              .map(dr => dr.rubric)
              .filter(Boolean) as { id: string; title: string }[]
            const reviewsDone = doc.reviews.filter(r => r.status === 'submitted').length
            const reviewsTotal = doc.reviews.length

            return (
              <div key={doc.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{doc.title}</h3>
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {FILE_TYPE_LABEL[doc.file_type] ?? doc.file_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Uploaded {formatDate(doc.created_at)}</p>

                    {rubricList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {rubricList.map(r => (
                          <span key={r.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            {r.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-slate-800">{reviewsDone}</p>
                    <p className="text-xs text-slate-400">
                      {reviewsDone === 1 ? 'review' : 'reviews'} completed
                    </p>
                    {reviewsTotal > reviewsDone && (
                      <p className="text-xs text-amber-600 mt-0.5">{reviewsTotal - reviewsDone} in progress</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
