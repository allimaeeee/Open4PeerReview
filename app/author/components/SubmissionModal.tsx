'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadDocument, assignRubrics, submitTorusLink } from '@/lib/supabase/queries'
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
import { isKnownOerUrl, isTorusUrl } from '@/lib/oer-platform'

type SourceTab = 'pdf' | 'openstax' | 'torus'

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
  authorInstitution?: string | null
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
  const [torusUrl, setTorusUrl] = useState('')
  const [torusCourseAccessCode, setTorusCourseAccessCode] = useState('')
  const [submissionScope, setSubmissionScope] = useState<'organization' | 'public'>('organization')
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
    setTorusUrl('')
    setTorusCourseAccessCode('')
    setSubmissionScope('organization')
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
    } else if (sourceTab === 'torus') {
      if (!torusUrl.trim()) { setError('Please enter an OLI Torus URL.'); return }
      if (!isTorusUrl(torusUrl.trim())) {
        setError('URL must be from OLI Torus (torus.oli.cmu.edu).')
        return
      }
    } else {
      if (!openstaxUrl.trim()) { setError('Please enter an OER URL.'); return }
      if (!isKnownOerUrl(openstaxUrl.trim())) {
        setError('URL must be from a supported OER platform (OpenStax, Pressbooks, OER Commons, LibreTexts, MERLOT, Open Textbook Library, or Siyavula).')
        return
      }
      for (const pageUrl of additionalPageUrls) {
        if (!pageUrl.trim()) { setError('Remove empty page URL fields or fill them in.'); return }
        try {
          const parsed = new URL(pageUrl.trim())
          if (parsed.hostname !== 'openstax.org' && !parsed.hostname.endsWith('.openstax.org')) {
            setError('Additional page URLs must be on openstax.org.'); return
          }
        } catch {
          setError('Please enter a valid URL for each additional page.'); return
        }
      }
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
          [submissionScope],
        )
        if (selectedRubrics.size > 0) {
          await assignRubrics(supabase, doc.id, Array.from(selectedRubrics))
        }
      } else if (sourceTab === 'torus') {
        await submitTorusLink(supabase, {
          url: torusUrl.trim(),
          title: title.trim(),
          authors: authors.trim(),
          subjectMatter: finalSubjectMatter,
          ccLicense: ccLicense as CreativeCommonsLicense,
          thirdPartyDisclosure: thirdPartyDisclosure.trim() || null,
          courseAccessCode: torusCourseAccessCode.trim() || null,
          rubricIds: Array.from(selectedRubrics),
          submissionScope: [submissionScope],
          isDraft: false,
          coordinatorUpload: false,
        })
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
            submissionScope: [submissionScope],
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
        <div className="grid grid-cols-3 gap-3">
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
          <SelectionCard
            selectionMode="radio"
            isSelected={sourceTab === 'torus'}
            onChange={() => { setSourceTab('torus'); touch() }}
            disabled={loading}
            title="OLI Torus"
            size="compact"
            icon={
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Conditional source input */}
      {sourceTab === 'torus' ? (
        <div className="space-y-4">
          <Input
            label="Torus Course URL"
            placeholder="https://torus.oli.cmu.edu/..."
            value={torusUrl}
            onChange={e => { setTorusUrl(e.target.value); touch() }}
            disabled={loading}
            helperText="Paste the URL to your OLI Torus course section."
          />
          <Input
            label="Course Access Code"
            optional
            placeholder="e.g. ABC-123"
            value={torusCourseAccessCode}
            onChange={e => { setTorusCourseAccessCode(e.target.value); touch() }}
            disabled={loading}
            helperText="If your course requires an access code, reviewers will need it to view the content."
          />
        </div>
      ) : sourceTab === 'openstax' ? (
        <div className="space-y-3">
          <Input
            label="Resource URL"
            placeholder="https://openstax.org/your-resource"
            value={openstaxUrl}
            onChange={e => { setOpenstaxUrl(e.target.value); touch() }}
            disabled={loading}
          />
          {additionalPageUrls.map((pageUrl, i) => (
            <div key={i} className="flex items-end gap-2">
              <Input
                containerClassName="flex-1"
                type="url"
                placeholder="https://openstax.org/books/.../pages/..."
                value={pageUrl}
                onChange={e => { updatePageUrl(i, e.target.value); touch() }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => removePageUrl(i)}
                disabled={loading}
                className="shrink-0 p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-[var(--color-surface-container)] transition-colors disabled:opacity-50"
                aria-label="Remove page"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <Button variant="text" size="sm" onClick={addPageUrl} disabled={loading}>
            + Add Page URL
          </Button>
          {additionalPageUrls.length > 0 && (
            <p className="text-body-sm text-text-secondary">
              Reviewers will see all {additionalPageUrls.length + 1} page{additionalPageUrls.length + 1 !== 1 ? 's' : ''} linked to this submission.
            </p>
          )}
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

      {/* Submit for Review To */}
      <div>
        <p className="text-label-md font-label font-semibold uppercase tracking-wide text-text-secondary mb-4">
          Submit for Review To
        </p>
        <div className="grid grid-cols-2 gap-3">
          <SelectionCard
            selectionMode="radio"
            isSelected={submissionScope === 'organization'}
            onChange={() => { setSubmissionScope('organization'); touch() }}
            disabled={loading}
            title="My Organization"
            description={authorInstitution ? `Held for coordinator approval at ${authorInstitution}` : 'Held for coordinator approval'}
          />
          <SelectionCard
            selectionMode="radio"
            isSelected={submissionScope === 'public'}
            onChange={() => { setSubmissionScope('public'); touch() }}
            disabled={loading}
            title="Public Pool"
            description="Visible to all eligible reviewers"
          />
        </div>
      </div>

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
    { label: 'Resource Type', value: sourceTab === 'pdf' ? `PDF — ${file?.name ?? ''}` : sourceTab === 'torus' ? `OLI Torus — ${torusUrl}` : `OpenStax URL — ${openstaxUrl}` },
    ...(sourceTab === 'torus' && torusCourseAccessCode.trim()
      ? [{ label: 'Access Code', value: torusCourseAccessCode.trim() }]
      : []),
    ...(sourceTab === 'openstax' && additionalPageUrls.filter(u => u.trim()).length > 0
      ? [{ label: 'Additional Pages', value: `${additionalPageUrls.filter(u => u.trim()).length} additional page(s)` }]
      : []),
    { label: 'Submit to',     value: submissionScope === 'organization' ? 'My Organization' : 'Public Pool' },
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
