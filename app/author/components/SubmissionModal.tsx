'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadDocument, assignRubrics } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS, CC_LICENSE_LABELS, CC_LICENSE_DESCRIPTIONS } from '@/types'
import type { ExpertDomain, CreativeCommonsLicense } from '@/types'
import { Modal, ModalContent } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { SelectionCard } from '@/components/ui/SelectionCard'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { isKnownOerUrl } from '@/lib/oer-platform'

type SourceTab = 'pdf' | 'openstax'

const STEPS = ['Resource', 'Rubrics', 'License', 'Review']

const PREDEFINED_ENTRIES = (Object.entries(EXPERT_DOMAIN_LABELS) as [ExpertDomain, string][])
  .filter(([key]) => key !== 'other')

const OTHER_SENTINEL = 'other'

interface RubricOption {
  id: string
  title: string
  description: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  rubrics: RubricOption[]
  customSubjectMatters: string[]
  displayName: string
  authorInstitution: string | null
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function SubmissionModal({
  isOpen,
  onClose,
  rubrics,
  customSubjectMatters,
  displayName,
  authorInstitution,
}: Props) {
  // Navigation state
  const [step, setStep] = useState(1)
  const [touched, setTouched] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Form state — preserve all existing variable names from UploadDocumentForm
  const [sourceTab, setSourceTab] = useState<SourceTab>('pdf')
  const [title, setTitle] = useState('')
  const [authors, setAuthors] = useState(displayName)
  const [subjectMatter, setSubjectMatter] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [ccLicense, setCcLicense] = useState<CreativeCommonsLicense | ''>('')
  const [thirdPartyDisclosure, setThirdPartyDisclosure] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [openstaxUrl, setOpenstaxUrl] = useState('')
  const [additionalPageUrls, setAdditionalPageUrls] = useState<string[]>([])
  const [submissionScope, setSubmissionScope] = useState<Set<'organization' | 'public'>>(
    () => new Set(authorInstitution ? ['organization'] : ['public'])
  )
  const [selectedRubrics, setSelectedRubrics] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [rubricError, setRubricError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const isOther = subjectMatter === OTHER_SENTINEL
  const finalSubjectMatter = isOther ? customSubject.trim() : subjectMatter

  function touch() {
    if (!touched) setTouched(true)
  }

  function addPageUrl() { setAdditionalPageUrls(prev => [...prev, '']) }
  function removePageUrl(index: number) { setAdditionalPageUrls(prev => prev.filter((_, i) => i !== index)) }
  function updatePageUrl(index: number, value: string) { setAdditionalPageUrls(prev => prev.map((u, i) => i === index ? value : u)) }
  function toggleScope(scope: 'organization' | 'public') {
    setSubmissionScope(prev => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  function resetAll() {
    setStep(1)
    setTouched(false)
    setSourceTab('pdf')
    setTitle('')
    setAuthors(displayName)
    setSubjectMatter('')
    setCustomSubject('')
    setCcLicense('')
    setThirdPartyDisclosure('')
    setFile(null)
    setOpenstaxUrl('')
    setAdditionalPageUrls([])
    setSubmissionScope(new Set(authorInstitution ? ['organization'] : ['public']))
    setSelectedRubrics(new Set())
    setError(null)
    setRubricError(null)
    setLoading(false)
  }

  function handleCloseAttempt() {
    if (touched) {
      setShowConfirmDialog(true)
    } else {
      onClose()
    }
  }

  // TODO: implement draft persistence to Supabase
  // Should write partial submission state to a drafts table
  // and return the user to the author dashboard Drafts tab
  const handleSaveAsDraft = () => {
    console.warn('onSaveAsDraft not yet implemented')
    resetAll()
    onClose()
  }

  function toggleRubric(id: string) {
    touch()
    setSelectedRubrics(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 6) {
        next.add(id)
      }
      return next
    })
  }

  // ── Step validation ───────────────────────────────────────────────────────

  function handleContinueStep1() {
    if (!title.trim())                    { setError('Resource title is required.'); return }
    if (!authors.trim())                  { setError('Author(s) is required.'); return }
    if (!subjectMatter)                   { setError('Subject area is required.'); return }
    if (isOther && !customSubject.trim()) { setError('Please enter a subject area.'); return }
    if (sourceTab === 'pdf') {
      if (!file)                                     { setError('Please select a PDF file.'); return }
      if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are supported.'); return }
    } else {
      if (!openstaxUrl.trim()) { setError('Please enter an OER URL.'); return }
      if (!isKnownOerUrl(openstaxUrl.trim())) {
        setError('URL must be from a supported OER platform (OpenStax, Pressbooks, OER Commons, LibreTexts, MERLOT, Open Textbook Library, or Siyavula).')
        return
      }
      for (const pageUrl of additionalPageUrls) {
        if (!pageUrl.trim()) { setError('Remove empty page URL fields or fill them in.'); return }
        if (!isKnownOerUrl(pageUrl.trim())) {
          setError(`Additional page URL must be from a supported OER platform: ${pageUrl.trim()}`)
          return
        }
      }
    }
    if (authorInstitution && submissionScope.size === 0) {
      setError('Please select at least one submission destination.')
      return
    }
    setError(null)
    setStep(2)
  }

  function handleContinueStep2() {
    if (selectedRubrics.size === 0) {
      setRubricError('Please select at least one rubric to continue.')
      return
    }
    setRubricError(null)
    setStep(3)
  }

  function handleContinueStep3() {
    if (!ccLicense) { setError('Please select a Creative Commons license.'); return }
    setError(null)
    setStep(4)
  }

  function goBack() {
    setError(null)
    setRubricError(null)
    setStep(s => s - 1)
  }

  // ── Submission — logic preserved exactly from UploadDocumentForm ──────────

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      if (sourceTab === 'pdf') {
        const doc = await uploadDocument(
          supabase, file!, title.trim(), 'pdf', authors.trim(), finalSubjectMatter,
          ccLicense as CreativeCommonsLicense, thirdPartyDisclosure.trim() || null,
        )
        if (selectedRubrics.size > 0) {
          await assignRubrics(supabase, doc.id, Array.from(selectedRubrics))
        }
      } else {
        const res = await fetch('/api/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: openstaxUrl.trim(),
            title: title.trim(),
            authors: authors.trim(),
            subjectMatter: finalSubjectMatter,
            ccLicense,
            thirdPartyDisclosure: thirdPartyDisclosure.trim() || undefined,
            rubricIds: Array.from(selectedRubrics),
            submissionScope: Array.from(submissionScope),
            additionalPageUrls: additionalPageUrls.filter(u => u.trim()).map(u => u.trim()),
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Failed to fetch OpenStax content.')
        }
      }
      router.refresh()
      resetAll()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step panels ───────────────────────────────────────────────────────────

  const step1Content = (
    <div className="space-y-6">
      <Input
        label="Resource Title"
        placeholder="e.g. Quantum Mechanics: An Open Resource"
        value={title}
        onChange={e => { setTitle(e.target.value); touch() }}
        disabled={loading}
      />

      <Input
        label="Author(s)"
        placeholder="e.g. Jane Smith, John Doe"
        value={authors}
        onChange={e => { setAuthors(e.target.value); touch() }}
        disabled={loading}
        helperText="Separate multiple authors with commas"
      />

      <Select
        label="Subject Area"
        value={subjectMatter}
        onChange={e => {
          setSubjectMatter(e.target.value)
          if (e.target.value !== OTHER_SENTINEL) setCustomSubject('')
          touch()
        }}
        disabled={loading}
      >
        <option value="">Select a subject area…</option>
        <optgroup label="Standard domains">
          {PREDEFINED_ENTRIES.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </optgroup>
        {customSubjectMatters.length > 0 && (
          <optgroup label="Community-added">
            {customSubjectMatters.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </optgroup>
        )}
        <option value={OTHER_SENTINEL}>Other (specify below)…</option>
      </Select>

      {isOther && (
        <Input
          placeholder="Enter a subject area"
          value={customSubject}
          onChange={e => { setCustomSubject(e.target.value); touch() }}
          disabled={loading}
          autoFocus
        />
      )}

      {/* Resource Type */}
      <div>
        <p className="text-label-md font-label font-semibold uppercase tracking-wide text-text-secondary mb-4">
          Resource Type
        </p>
        <div className="grid grid-cols-2 gap-3">
          <SelectionCard
            selectionMode="radio"
            isSelected={sourceTab === 'openstax'}
            onChange={() => { setSourceTab('openstax'); touch() }}
            disabled={loading}
            title="OpenStax URL"
            size="compact"
            icon={
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.828 10.172a4 4 0 010 5.656l-1.415 1.414a4 4 0 01-5.656-5.656l1.415-1.414M6.172 9.828a4 4 0 010-5.656l1.415-1.414a4 4 0 015.656 5.656L11.83 9.828" />
              </svg>
            }
          />
          <SelectionCard
            selectionMode="radio"
            isSelected={sourceTab === 'pdf'}
            onChange={() => { setSourceTab('pdf'); touch() }}
            disabled={loading}
            title="PDF Upload"
            size="compact"
            icon={
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                <path d="M8 11h4M10 9v4" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Conditional source input */}
      {sourceTab === 'openstax' ? (
        <div className="space-y-3">
          <Input
            label="Resource URL"
            placeholder="https://openstax.org/your-resource"
            value={openstaxUrl}
            onChange={e => { setOpenstaxUrl(e.target.value); touch() }}
            disabled={loading}
          />

          {/* Additional pages */}
          <div>
            <p className="text-label-md font-label font-semibold uppercase tracking-wide text-text-secondary mb-2">
              Additional pages
            </p>
            {additionalPageUrls.length > 0 && (
              <div className="space-y-2 mb-2">
                {additionalPageUrls.map((pageUrl, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="url"
                      placeholder={`https://openstax.org/books/…/pages/3-${index + 2}`}
                      value={pageUrl}
                      onChange={e => { updatePageUrl(index, e.target.value); touch() }}
                      disabled={loading}
                      className={cx(
                        'flex-1 rounded-lg border border-[var(--color-border)] px-3.5 py-2.5 text-sm text-text-primary',
                        'placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus)]',
                        'focus:border-[var(--color-interactive)] transition-colors bg-[var(--color-surface-card)]',
                        'disabled:bg-[var(--color-surface-container)]',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => removePageUrl(index)}
                      disabled={loading}
                      className="shrink-0 p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors disabled:opacity-50"
                      aria-label="Remove page"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => { addPageUrl(); touch() }}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-interactive)] hover:text-[var(--color-interactive-hover)] disabled:opacity-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add page URL
            </button>
            {additionalPageUrls.length > 0 && (
              <p className="mt-1 text-xs text-text-muted">
                Reviewers will see all {additionalPageUrls.length + 1} pages linked to this submission.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-label-md font-label font-semibold uppercase tracking-wide text-text-secondary mb-4">
            PDF File
          </p>
          <div
            onClick={() => fileRef.current?.click()}
            className={cx(
              'flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-4 cursor-pointer transition-colors',
              file
                ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-container)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
            )}
          >
            <svg className="h-5 w-5 text-text-secondary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="text-body-sm text-text-secondary truncate">
              {file ? file.name : 'Click to select a PDF file'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => { setFile(e.target.files?.[0] ?? null); touch() }}
              disabled={loading}
            />
          </div>
        </div>
      )}

      <Textarea
        label="Third-Party Content Disclosure"
        optional
        placeholder="Describe any third-party content included in this OER (e.g. images, excerpts) and confirm you have rights to use it"
        value={thirdPartyDisclosure}
        onChange={e => { setThirdPartyDisclosure(e.target.value); touch() }}
        disabled={loading}
        rows={3}
        resize="none"
      />

      {/* Submission destination — only shown for org members */}
      {authorInstitution && (
        <div>
          <p className="text-label-md font-label font-semibold uppercase tracking-wide text-text-secondary mb-1">
            Submit for review to <span className="text-[var(--color-error)]">*</span>
          </p>
          <p className="text-body-sm text-text-muted mb-3">Choose where reviewers can see this document. You may select both.</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'organization' as const, label: 'My organization', description: `Held for coordinator approval at ${authorInstitution}` },
              { value: 'public' as const, label: 'Public pool', description: 'Visible to all eligible reviewers' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { toggleScope(opt.value); touch() }}
                disabled={loading}
                className={cx(
                  'flex flex-col items-start rounded-lg border-2 px-4 py-3 text-left transition-all duration-150',
                  submissionScope.has(opt.value)
                    ? 'border-[var(--color-interactive)] bg-[var(--color-interactive-subtle)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-card)] hover:border-[var(--color-border-strong)]',
                )}
              >
                <span className={cx(
                  'text-sm font-semibold',
                  submissionScope.has(opt.value) ? 'text-[var(--color-interactive)]' : 'text-text-primary',
                )}>
                  {opt.label}
                </span>
                <span className="mt-0.5 text-xs text-text-muted">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-body-sm text-[var(--color-error)] bg-[var(--color-error-container)] rounded-lg px-3.5 py-2.5">
          {error}
        </p>
      )}
    </div>
  )

  const step2Content = (
    <div className="space-y-4">
      <p className="text-body-sm text-text-secondary">
        Select the rubrics reviewers should apply to this resource. Choose between 1 and 6.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {rubrics.map(r => {
          const maxReached = selectedRubrics.size >= 6 && !selectedRubrics.has(r.id)
          return (
            <SelectionCard
              key={r.id}
              selectionMode="checkbox"
              isSelected={selectedRubrics.has(r.id)}
              onChange={() => toggleRubric(r.id)}
              disabled={loading || maxReached}
              title={r.title}
              description={r.description ?? undefined}
            />
          )
        })}
      </div>
      {rubricError && (
        <p className="text-body-sm text-[var(--color-error)]">{rubricError}</p>
      )}
    </div>
  )

  const step3Content = (
    <div>
      <p className="text-body-sm text-text-secondary mb-5">
        Choose the Creative Commons license that applies to this resource.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(Object.entries(CC_LICENSE_LABELS) as [CreativeCommonsLicense, string][]).map(([key, label]) => (
          <SelectionCard
            key={key}
            selectionMode="radio"
            isSelected={ccLicense === key}
            onChange={() => { setCcLicense(key); touch() }}
            disabled={loading}
            title={label}
            description={CC_LICENSE_DESCRIPTIONS[key]}
          />
        ))}
      </div>
      {error && (
        <p className="mt-4 text-body-sm text-[var(--color-error)] bg-[var(--color-error-container)] rounded-lg px-3.5 py-2.5">
          {error}
        </p>
      )}
    </div>
  )

  const selectedRubricNames = rubrics
    .filter(r => selectedRubrics.has(r.id))
    .map(r => r.title)

  const reviewRows = [
    { label: 'Title',         value: title || '—' },
    { label: 'Author(s)',     value: authors || '—' },
    { label: 'Subject Area',  value: isOther ? (customSubject || '—') : ((EXPERT_DOMAIN_LABELS[subjectMatter as ExpertDomain] ?? subjectMatter) || '—') },
    { label: 'Resource Type', value: sourceTab === 'pdf' ? `PDF — ${file?.name ?? ''}` : `OpenStax URL — ${openstaxUrl}` },
    { label: 'Rubrics',       value: selectedRubricNames.join(', ') || '—' },
    { label: 'License',       value: ccLicense ? CC_LICENSE_LABELS[ccLicense as CreativeCommonsLicense] : '—' },
    ...(thirdPartyDisclosure ? [{ label: 'Third-Party Disclosure', value: thirdPartyDisclosure }] : []),
  ]

  const step4Content = (
    <div className="space-y-5">
      <p className="text-body-sm text-text-secondary">
        Review your submission before sending it for certification.
      </p>
      <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {reviewRows.map(({ label, value }) => (
          <div key={label} className="px-4 py-3 flex gap-4">
            <span className="text-body-sm font-medium text-text-secondary shrink-0 w-44">{label}</span>
            <span className="text-body-sm text-text-primary break-words min-w-0">{value}</span>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-body-sm text-[var(--color-error)] bg-[var(--color-error-container)] rounded-lg px-3.5 py-2.5">
          {error}
        </p>
      )}
    </div>
  )

  // ── Footer ────────────────────────────────────────────────────────────────

  const footer = (
    <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-card)]">
      <div className="flex items-center gap-3">
        {step === 1 ? (
          <Button variant="secondary" size="md" onClick={handleCloseAttempt} disabled={loading}>
            Cancel
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="md" onClick={goBack} disabled={loading}>
              ← Back
            </Button>
            <Button variant="text" size="md" onClick={handleSaveAsDraft} disabled={loading}>
              Save & Exit
            </Button>
          </>
        )}
      </div>
      <div>
        {step < 4 ? (
          <Button
            variant="primary"
            size="md"
            disabled={loading}
            onClick={() => {
              if (step === 1) handleContinueStep1()
              else if (step === 2) handleContinueStep2()
              else if (step === 3) handleContinueStep3()
            }}
          >
            Continue →
          </Button>
        ) : (
          <Button variant="primary" size="md" loading={loading} onClick={handleSubmit}>
            Submit for Review
          </Button>
        )}
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Modal open={isOpen} onClose={handleCloseAttempt}>
        <ModalContent className="max-w-2xl">
          <div className="flex flex-col h-full">

            {/* Header */}
            <div className="shrink-0 px-6 pt-6 pb-5 border-b border-[var(--color-border)]">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-label-sm font-label font-semibold uppercase tracking-widest text-text-secondary mb-1">
                    Submit for Certification
                  </p>
                  <h2 className="font-heading text-title-lg text-text-primary leading-snug">
                    New Resource Submission
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleCloseAttempt}
                  className="shrink-0 rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors duration-150"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
                </button>
              </div>
              <StepIndicator steps={STEPS} currentStep={step} />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {step === 1 && step1Content}
              {step === 2 && step2Content}
              {step === 3 && step3Content}
              {step === 4 && step4Content}
            </div>

            {footer}

          </div>
        </ModalContent>
      </Modal>

      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title="Exit submission?"
        message="Do you want to save your progress before exiting?"
        confirmLabel="Save as draft"
        discardLabel="Discard"
        onConfirm={() => {
          setShowConfirmDialog(false)
          handleSaveAsDraft()
        }}
        onDiscard={() => {
          setShowConfirmDialog(false)
          resetAll()
          onClose()
        }}
      />
    </>
  )
}
