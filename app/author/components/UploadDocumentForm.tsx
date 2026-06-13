'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadDocument, assignRubrics, saveDraftDocument } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS, CC_LICENSE_LABELS, CC_LICENSE_DESCRIPTIONS } from '@/types'
import type { ExpertDomain, CreativeCommonsLicense } from '@/types'
import { Select } from '@/components/ui/Select'
import { SelectionCard } from '@/components/ui/SelectionCard'
import { isKnownOerUrl } from '@/lib/oer-platform'

type SourceTab = 'pdf' | 'url'

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
  const [selectedRubrics, setSelectedRubrics] = useState<Set<string>>(new Set())
  // Scope: authors with an org default to org-only; no-org authors only get public
  const [submissionScope, setSubmissionScope] = useState<Set<'organization' | 'public'>>(
    () => new Set(authorInstitution ? ['organization'] : ['public'])
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

  function toggleScope(scope: 'organization' | 'public') {
    setSubmissionScope(prev => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  async function handleUpload(isDraft: boolean) {
    setError(null)

    if (!isDraft) {
      if (!title.trim()) { setError('Title is required.'); return }
      if (!authors.trim()) { setError('Author(s) is required.'); return }
      if (!subjectMatter) { setError('Subject matter is required.'); return }
      if (isOther && !customSubject.trim()) { setError('Please enter a subject area.'); return }
      if (!ccLicense) { setError('Creative Commons license is required.'); return }
      if (authorInstitution && submissionScope.size === 0) { setError('Please select at least one submission destination.'); return }
      if (sourceTab === 'pdf') {
        if (!file) { setError('Please select a PDF file.'); return }
        if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are supported.'); return }
      } else {
        if (!oerUrl.trim()) { setError('Please enter an OER URL.'); return }
        if (!isKnownOerUrl(oerUrl.trim())) {
          setError('URL must be from a supported OER platform (OpenStax, Pressbooks, OER Commons, LibreTexts, MERLOT, Open Textbook Library, or Siyavula).')
          return
        }
      }
    }

    const effectiveTitle = title.trim() || 'Untitled Draft'
    const effectiveAuthors = authors.trim() || ''
    const effectiveSubjectMatter = finalSubjectMatter || 'other'
    const effectiveLicense = (ccLicense || 'cc_by') as import('@/types').CreativeCommonsLicense
    const scopeArray = Array.from(submissionScope)
    setLoading(true)
    try {
      let docId: string

      const hasFile = sourceTab === 'pdf' && !!file
      const hasUrl = sourceTab === 'url' && !!oerUrl.trim() && isKnownOerUrl(oerUrl.trim())

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
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Failed to fetch OER content.')
        }
        const data = await res.json()
        docId = data.documentId
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

  const tabBase = 'flex-1 py-2 text-sm font-medium rounded-md transition-colors'
  const tabActive = 'bg-white text-[#1e3a5f] shadow-sm'
  const tabInactive = 'text-slate-500 hover:text-slate-700'

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
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 mb-3">
          <button
            type="button"
            onClick={() => setSourceTab('pdf')}
            disabled={loading}
            className={`${tabBase} ${sourceTab === 'pdf' ? tabActive : tabInactive}`}
          >
            Upload PDF
          </button>
          <button
            type="button"
            onClick={() => setSourceTab('url')}
            disabled={loading}
            className={`${tabBase} ${sourceTab === 'url' ? tabActive : tabInactive}`}
          >
            Link OER URL
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
        ) : (
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
              Supported platforms: OpenStax, Pressbooks, OER Commons, LibreTexts, MERLOT, Open Textbook Library, Siyavula.
            </p>
          </div>
        )}
      </div>

      {/* Submission destination — only shown for org members */}
      {authorInstitution && (
        <div>
          <p className="block text-sm font-medium text-slate-700 mb-1">
            Submit for review to <span className="text-red-500">*</span>
          </p>
          <p className="text-xs text-slate-500 mb-3">Choose where reviewers can see this document. You may select both.</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'organization' as const, label: 'My organization', description: `Held for coordinator approval at ${authorInstitution}` },
              { value: 'public' as const, label: 'Public pool', description: 'Visible to all eligible reviewers' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleScope(opt.value)}
                disabled={loading}
                className={[
                  'flex flex-col items-start rounded-lg border-2 px-4 py-3 text-left transition-all duration-150',
                  submissionScope.has(opt.value)
                    ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                ].join(' ')}
              >
                <span className={[
                  'text-sm font-semibold',
                  submissionScope.has(opt.value) ? 'text-[#1e3a5f]' : 'text-slate-700',
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
              {sourceTab === 'url' ? 'Fetching snapshot…' : 'Uploading…'}
            </>
          ) : sourceTab === 'url' ? 'Link OER Content' : 'Submit for Review'}
        </button>
      </div>
    </form>
  )
}
