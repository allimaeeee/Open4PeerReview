'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UploadDocumentForm } from './UploadDocumentForm'
import { EXPERT_DOMAIN_LABELS } from '@/types'
import type { ExpertDomain } from '@/types'

interface RubricRow {
  id: string
  title: string
  description: string | null
}

interface DocumentRow {
  id: string
  title: string
  authors: string
  subject_matter: string
  file_type: string
  created_at: string
  document_rubrics: { rubric: { id: string; title: string } | null }[]
  reviews: { id: string; status: string; submitted_at: string | null }[]
}

interface Props {
  documents: DocumentRow[]
  rubrics: RubricRow[]
  customSubjectMatters: string[]
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

export function AuthorDashboardClient({ documents, rubrics, customSubjectMatters }: Props) {
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
          <UploadDocumentForm rubrics={rubrics} customSubjectMatters={customSubjectMatters} onCancel={() => setShowUpload(false)} />
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

            const reviewsInProgress = doc.reviews.filter(r => r.status === 'in_progress').length

            return (
              <div key={doc.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{doc.title}</h3>
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {FILE_TYPE_LABEL[doc.file_type] ?? doc.file_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Uploaded {formatDate(doc.created_at)}</p>

                    {doc.authors && (
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="font-medium">Authors:</span> {doc.authors}
                      </p>
                    )}
                    {doc.subject_matter && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-medium">Subject:</span>{' '}
                        {EXPERT_DOMAIN_LABELS[doc.subject_matter as ExpertDomain] ?? doc.subject_matter}
                      </p>
                    )}

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

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {/* Status badges */}
                    {reviewsTotal === 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        No reviews yet
                      </span>
                    ) : (
                      <>
                        {reviewsInProgress > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            {reviewsInProgress} under review
                          </span>
                        )}
                        {reviewsDone > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {reviewsDone} {reviewsDone === 1 ? 'review' : 'reviews'} submitted
                          </span>
                        )}
                      </>
                    )}

                    {/* View feedback */}
                    {reviewsDone > 0 && (
                      <Link
                        href={`/dashboard/feedback/${doc.id}`}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1e3a5f] text-white hover:bg-[#162d4a] transition-colors shadow-sm"
                      >
                        View Feedback
                      </Link>
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
