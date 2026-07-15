'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadDocument, assignRubrics, saveDraftDocument, submitTorusLink } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS, CC_LICENSE_LABELS, CC_LICENSE_DESCRIPTIONS } from '@/types'
import type { ExpertDomain, CreativeCommonsLicense } from '@/types'
import { Select } from '@/components/ui/Select'
import { SelectionCard } from '@/components/ui/SelectionCard'
import { isKnownOerUrl, isTorusUrl } from '@/lib/oer-platform'

type SourceTab = 'pdf' | 'url' | 'torus'

interface RubricOption {
  id: string
  title: string
  description: string | null
}

interface Props {
  rubrics: RubricOption[]
  customSubjectMatters: string[]
  authorInstitution: string | null
  asCoordinator?: boolean
  onCancel: () => void
  onUploadComplete?: (docId: string, isDraft: boolean) => void
}

// All predefined keys except "other", which we handle as a special sentinel
const PREDEFINED_ENTRIES = (Object.entries(EXPERT_DOMAIN_LABELS) as [ExpertDomain, string][])
  .filter(([key]) => key !== 'other')

const OTHER_SENTINEL = 'other'

const inputBase =
  'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 ' +
  'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 ' +
  'focus:border-[#1e3a5f] transition-colors bg-white disabled:bg-slate-50'

export function UploadDocumentForm({ rubrics, customSubjectMatters, authorInstitution, asCoordinator = false, onCancel, onUploadComplete }: Props) {
  const [sourceTab, setSourceTab] = useState<SourceTab>('pdf')
  const [title, setTitle] = useState('')
  const [authors, setAuthors] = useState('')
  const [subjectMatter, setSubjectMatter] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [ccLicense, setCcLicense] = useState<CreativeCommonsLicense | ''>('')
  const [thirdPartyDisclosure, setThirdPartyDisclosure] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [oerUrl, setOerUrl] = useState('')
  const [additionalPageUrls, setAdditionalPageUrls] = useState<string[]>([])
  const [torusUrl, setTorusUrl] = useState('')
  const [torusCourseAccessCode, setTorusCourseAccessCode] = useState('')
  const [selectedRubrics, setSelectedRubrics] = useState<Set<string>>(new Set())
  // Scope: single-select; org members default to org, no-org authors default to public
  const [submissionScope, setSubmissionScope] = useState<'organization' | 'public'>(
    authorInstitution ? 'organization' : 'public'
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const isOther = subjectMatter === OTHER_SENTINEL
  const finalSubjectMatter = isOther ? customSubject.trim() : subjectMatter

  function toggleRubric(id: string) {
    setSelectedRubrics(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addPageUrl() {
    setAdditionalPageUrls(prev => [...prev, ''])
  }

  function removePageUrl(index: number) {
    setAdditionalPageUrls(prev => prev.filter((_, i) => i !== index))
  }

  function updatePageUrl(index: number, value: string) {
    setAdditionalPageUrls(prev => prev.map((u, i) => i === index ? value : u))
  }

  async function handleUpload(isDraft: boolean) {
    setError(null)

    if (!isDraft) {
      if (!title.trim()) { setError('Title is required.'); return }
      if (!authors.trim()) { setError('Author(s) is required.'); return }
      if (!subjectMatter) { setError('Subject matter is required.'); return }
      if (isOther && !customSubject.trim()) { setError('Please enter a subject area.'); return }
      if (!ccLicense) { setError('Creative Commons license is required.'); return }
      if (authorInstitution && !submissionScope) { setError('Please select a submission destination.'); return }
      if (sourceTab === 'pdf') {
        if (!file) { setError('Please select a PDF file.'); return }
        if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are supported.'); return }
      } else if (sourceTab === 'url') {
        if (!oerUrl.trim()) { setError('Please enter an OER URL.'); return }
        if (!isKnownOerUrl(oerUrl.trim())) {
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
      } else {
        if (!torusUrl.trim()) { setError('Please enter an OLI Torus URL.'); return }
        if (!isTorusUrl(torusUrl.trim())) {
          setError('URL must be from OLI Torus (proton.oli.cmu.edu).')
          return
        }
      }
    }

    const effectiveTitle = title.trim() || 'Untitled Draft'
    const effectiveAuthors = authors.trim() || ''
    const effectiveSubjectMatter = finalSubjectMatter || 'other'
    const effectiveLicense = (ccLicense || 'cc_by') as import('@/types').CreativeCommonsLicense
    const scopeArray = [submissionScope]
    setLoading(true)
    try {
      let docId: string

      const hasFile = sourceTab === 'pdf' && !!file
      const hasUrl = sourceTab === 'url' && !!oerUrl.trim() && isKnownOerUrl(oerUrl.trim())
      const hasTorus = sourceTab === 'torus' && !!torusUrl.trim() && isTorusUrl(torusUrl.trim())

      if (hasFile) {
        const doc = await uploadDocument(
          supabase, file!, effectiveTitle, 'pdf', effectiveAuthors, effectiveSubjectMatter,
          effectiveLicense, thirdPartyDisclosure.trim() || null, scopeArray, isDraft, asCoordinator,
        )
        if (selectedRubrics.size > 0) {
          await assignRubrics(supabase, doc.id, Array.from(selectedRubrics))
        }
        docId = doc.id
      } else if (hasUrl) {
        const res = await fetch('/api/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: oerUrl.trim(),
            title: effectiveTitle,
            authors: effectiveAuthors,
            subjectMatter: effectiveSubjectMatter,
            ccLicense: effectiveLicense,
            thirdPartyDisclosure: thirdPartyDisclosure.trim() || undefined,
            rubricIds: Array.from(selectedRubrics),
            submissionScope: scopeArray,
            isDraft,
            coordinatorUpload: asCoordinator,
            additionalPageUrls: additionalPageUrls.filter(u => u.trim()).map(u => u.trim()),
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Failed to fetch OER content.')
        }
        const data = await res.json()
        docId = data.documentId
      } else if (hasTorus) {
        const doc = await submitTorusLink(supabase, {
          url: torusUrl.trim(),
          title: effectiveTitle,
          authors: effectiveAuthors,
          subjectMatter: effectiveSubjectMatter,
          ccLicense: effectiveLicense,
          thirdPartyDisclosure: thirdPartyDisclosure.trim() || null,
          courseAccessCode: torusCourseAccessCode.trim() || null,
          rubricIds: Array.from(selectedRubrics),
          submissionScope: scopeArray,
          isDraft,
          coordinatorUpload: asCoordinator,
        })
        docId = doc.id
      } else {
        // No content source — metadata-only draft
        const doc = await saveDraftDocument(supabase, {
          title: effectiveTitle,
          authors: effectiveAuthors,
          subjectMatter: effectiveSubjectMatter,
          creativeCommonsLicense: effectiveLicense,
          thirdPartyContentDisclosure: thirdPartyDisclosure.trim() || null,
          submissionScope: scopeArray,
          coordinatorUpload: asCoordinator,
        })
        docId = doc.id
      }

      if (onUploadComplete) {
        onUploadComplete(docId, isDraft)
      } else {
        router.refresh()
        onCancel()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    handleUpload(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="OER title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={loading}
          className={inputBase}
        />
      </div>

      {/* Author(s) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Author(s) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Jane Smith, John Doe"
          value={authors}
          onChange={e => setAuthors(e.target.value)}
          disabled={loading}
          className={inputBase}
        />
        <p className="mt-1 text-xs text-slate-400">Separate multiple authors with commas.</p>
      </div>

      {/* Subject matter */}
      <div>
        <Select
          label="Subject matter"
          required
          value={subjectMatter}
          onChange={e => {
            setSubjectMatter(e.target.value)
            if (e.target.value !== OTHER_SENTINEL) setCustomSubject('')
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
          <input
            type="text"
            placeholder="Enter a subject area"
            value={customSubject}
            onChange={e => setCustomSubject(e.target.value)}
            disabled={loading}
            className={`${inputBase} mt-2`}
            autoFocus
          />
        )}
      </div>

      {/* Creative Commons License */}
      <div>
        <Select
          label="Creative Commons license"
          required
          value={ccLicense}
          onChange={e => setCcLicense(e.target.value as CreativeCommonsLicense | '')}
          disabled={loading}
        >
          <option value="">Select a license…</option>
          {(Object.entries(CC_LICENSE_LABELS) as [CreativeCommonsLicense, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>
        {ccLicense && (
          <p className="mt-1 text-xs text-slate-400">{CC_LICENSE_DESCRIPTIONS[ccLicense]}</p>
        )}
      </div>

      {/* Third-party content disclosure */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Third-Party Content Disclosure
          <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          placeholder="Describe any third-party content included in this OER (e.g. images, excerpts) and confirm you have rights to use it."
          value={thirdPartyDisclosure}
          onChange={e => setThirdPartyDisclosure(e.target.value)}
          disabled={loading}
          rows={3}
          className={`${inputBase} resize-none`}
        />
      </div>

      {/* Source type toggle */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Content Source <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <button
            type="button"
            onClick={() => setSourceTab('url')}
            disabled={loading}
            className={[
              'flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all duration-150',
              sourceTab === 'url'
                ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ].join(' ')}
          >
            <svg
              className={['h-5 w-5 shrink-0', sourceTab === 'url' ? 'text-[#1e3a5f]' : 'text-slate-400'].join(' ')}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className={['flex-1 text-sm font-semibold', sourceTab === 'url' ? 'text-[#1e3a5f]' : 'text-slate-700'].join(' ')}>
              OER URL
            </span>
            <div className={['h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0', sourceTab === 'url' ? 'border-[#1e3a5f]' : 'border-slate-300'].join(' ')}>
              {sourceTab === 'url' && <div className="h-2 w-2 rounded-full bg-[#1e3a5f]" />}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSourceTab('pdf')}
            disabled={loading}
            className={[
              'flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all duration-150',
              sourceTab === 'pdf'
                ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ].join(' ')}
          >
            <svg
              className={['h-5 w-5 shrink-0', sourceTab === 'pdf' ? 'text-[#1e3a5f]' : 'text-slate-400'].join(' ')}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className={['flex-1 text-sm font-semibold', sourceTab === 'pdf' ? 'text-[#1e3a5f]' : 'text-slate-700'].join(' ')}>
              PDF Upload
            </span>
            <div className={['h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0', sourceTab === 'pdf' ? 'border-[#1e3a5f]' : 'border-slate-300'].join(' ')}>
              {sourceTab === 'pdf' && <div className="h-2 w-2 rounded-full bg-[#1e3a5f]" />}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSourceTab('torus')}
            disabled={loading}
            className={[
              'flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all duration-150',
              sourceTab === 'torus'
                ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ].join(' ')}
          >
            <svg
              className={['h-5 w-5 shrink-0', sourceTab === 'torus' ? 'text-[#1e3a5f]' : 'text-slate-400'].join(' ')}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className={['flex-1 text-sm font-semibold', sourceTab === 'torus' ? 'text-[#1e3a5f]' : 'text-slate-700'].join(' ')}>
              OLI Torus
            </span>
            <div className={['h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0', sourceTab === 'torus' ? 'border-[#1e3a5f]' : 'border-slate-300'].join(' ')}>
              {sourceTab === 'torus' && <div className="h-2 w-2 rounded-full bg-[#1e3a5f]" />}
            </div>
          </button>
        </div>

        {sourceTab === 'pdf' ? (
          <div
            onClick={() => fileRef.current?.click()}
            className={[
              'flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-4 cursor-pointer transition-colors',
              file ? 'border-[#1e3a5f]/40 bg-[#1e3a5f]/5' : 'border-slate-200 hover:border-slate-300',
            ].join(' ')}
          >
            <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="text-sm text-slate-600 truncate">
              {file ? file.name : 'Click to select a PDF file'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              disabled={loading}
            />
          </div>
        ) : sourceTab === 'torus' ? (
          <div className="space-y-3">
            <div>
              <input
                type="url"
                placeholder="https://proton.oli.cmu.edu/..."
                value={torusUrl}
                onChange={e => setTorusUrl(e.target.value)}
                disabled={loading}
                className={inputBase}
              />
              <p className="mt-1 text-xs text-slate-400">
                Paste the URL to your OLI Torus course section.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Course access code
                <span className="ml-1.5 font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. ABC-123"
                value={torusCourseAccessCode}
                onChange={e => setTorusCourseAccessCode(e.target.value)}
                disabled={loading}
                className={inputBase}
              />
              <p className="mt-1 text-xs text-slate-400">
                If your course requires an access code, reviewers will need it to view the content.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <input
                type="url"
                placeholder="https://openstax.org/books/… or other OER platform URL"
                value={oerUrl}
                onChange={e => setOerUrl(e.target.value)}
                disabled={loading}
                className={inputBase}
              />
              <p className="mt-1 text-xs text-slate-400">
                Supported: OpenStax, Pressbooks, OER Commons, LibreTexts, MERLOT, Open Textbook Library, Siyavula.
              </p>
            </div>

            {/* Additional pages */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1.5">Additional pages</p>
              {additionalPageUrls.length > 0 && (
                <div className="space-y-2 mb-2">
                  {additionalPageUrls.map((pageUrl, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="url"
                        placeholder="https://openstax.org/books/.../pages/..."
                        value={pageUrl}
                        onChange={e => updatePageUrl(index, e.target.value)}
                        disabled={loading}
                        className={`${inputBase} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => removePageUrl(index)}
                        disabled={loading}
                        className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
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
                onClick={addPageUrl}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-medium text-[#1e3a5f] hover:text-[#162d4a] disabled:opacity-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add page URL
              </button>
              {additionalPageUrls.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  Reviewers will see all {additionalPageUrls.length + 1} page{additionalPageUrls.length + 1 !== 1 ? 's' : ''} linked to this submission.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Submission destination — only shown for org members */}
      {authorInstitution && (
        <div>
          <p className="block text-sm font-medium text-slate-700 mb-1">
            Submit for review to <span className="text-red-500">*</span>
          </p>
          <p className="text-xs text-slate-500 mb-3">Choose where your submission will be sent.</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'organization' as const, label: 'My organization', description: `Held for coordinator approval at ${authorInstitution}` },
              { value: 'public' as const, label: 'Public pool', description: 'Visible to all eligible reviewers' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSubmissionScope(opt.value)}
                disabled={loading}
                className={[
                  'flex flex-col items-start rounded-lg border-2 px-4 py-3 text-left transition-all duration-150',
                  submissionScope === opt.value
                    ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                ].join(' ')}
              >
                <span className={[
                  'text-sm font-semibold',
                  submissionScope === opt.value ? 'text-[#1e3a5f]' : 'text-slate-700',
                ].join(' ')}>
                  {opt.label}
                </span>
                <span className="mt-0.5 text-xs text-slate-500">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rubric selection */}
      {rubrics.length > 0 && (
        <div>
          <p className="block text-sm font-medium text-slate-700 mb-1">Rubrics for review</p>
          <p className="text-xs text-slate-500 mb-3">Select the rubrics reviewers should use for this document.</p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {rubrics.map(r => (
              <SelectionCard
                key={r.id}
                selectionMode="checkbox"
                isSelected={selectedRubrics.has(r.id)}
                onChange={() => toggleRubric(r.id)}
                disabled={loading}
                title={r.title}
                description={r.description ?? undefined}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="py-2.5 px-4 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => handleUpload(true)}
          disabled={loading}
          className="py-2.5 px-4 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          type="submit"
          disabled={loading}
          className={[
            'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 inline-flex items-center justify-center gap-2',
            loading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm',
          ].join(' ')}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {sourceTab === 'url' ? 'Fetching snapshot…' : sourceTab === 'torus' ? 'Linking course…' : 'Uploading…'}
            </>
          ) : sourceTab === 'url' ? 'Link OER Content' : sourceTab === 'torus' ? 'Link Torus Course' : 'Submit for Review'}
        </button>
      </div>
    </form>
  )
}
