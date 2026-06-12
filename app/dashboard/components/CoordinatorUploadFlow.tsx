'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadDocumentForm } from './UploadDocumentForm'
import { AssignReviewersStep } from './AssignReviewersStep'

interface RubricOption {
  id: string
  title: string
  description: string | null
}

interface OrgReviewer {
  id: string
  display_name: string | null
  email: string
}

interface Props {
  rubrics: RubricOption[]
  customSubjectMatters: string[]
  institution: string
  orgReviewers: OrgReviewer[]
}

type Step = 'idle' | 'upload' | 'assign'

export function CoordinatorUploadFlow({ rubrics, customSubjectMatters, institution, orgReviewers }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null)
  const router = useRouter()

  function handleUploadComplete(docId: string, isDraft: boolean) {
    if (isDraft) {
      router.refresh()
      setStep('idle')
    } else {
      setUploadedDocId(docId)
      setStep('assign')
    }
  }

  function handleAssignDone() {
    setStep('idle')
    setUploadedDocId(null)
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('upload')}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-medium hover:bg-[#162d4a] transition-colors shadow-sm"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Upload Document
      </button>
    )
  }

  if (step === 'upload') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-5">Upload a Document</h3>
        <UploadDocumentForm
          rubrics={rubrics}
          customSubjectMatters={customSubjectMatters}
          authorInstitution={institution}
          asCoordinator={true}
          onCancel={() => setStep('idle')}
          onUploadComplete={handleUploadComplete}
        />
      </div>
    )
  }

  if (step === 'assign' && uploadedDocId) {
    return (
      <AssignReviewersStep
        documentId={uploadedDocId}
        orgReviewers={orgReviewers}
        onDone={handleAssignDone}
      />
    )
  }

  return null
}
