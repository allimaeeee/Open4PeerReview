'use client'

import { useState } from 'react'
import { AssignReviewersStep } from './AssignReviewersStep'

interface RubricRow {
  id: string
  title: string
}

interface DraftDoc {
  id: string
  title: string
  file_type: string | null
  created_at: string
  document_rubrics: { rubric: RubricRow | null }[]
}

interface OrgReviewer {
  id: string
  display_name: string | null
  email: string
}

const FILE_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF', html: 'HTML', image: 'Image', audio: 'Audio',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props {
  doc: DraftDoc
  orgReviewers: OrgReviewer[]
}

export function CoordinatorDraftCard({ doc, orgReviewers }: Props) {
  const [showAssign, setShowAssign] = useState(false)
  const rubrics = doc.document_rubrics.map(dr => dr.rubric).filter(Boolean) as RubricRow[]

  if (showAssign) {
    return (
      <AssignReviewersStep
        documentId={doc.id}
        orgReviewers={orgReviewers}
        onDone={() => setShowAssign(false)}
      />
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-900">{doc.title}</h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {FILE_TYPE_LABEL[doc.file_type ?? ''] ?? doc.file_type}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              Draft
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{formatDate(doc.created_at)}</p>
          {rubrics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {rubrics.map(r => (
                <span key={r.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {r.title}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowAssign(true)}
          className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm transition-colors"
        >
          Assign & Publish
        </button>
      </div>
    </div>
  )
}
