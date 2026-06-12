'use client'

import { useState, useTransition, useRef } from 'react'
import { EXPERT_DOMAIN_LABELS, CC_LICENSE_LABELS, CC_LICENSE_DESCRIPTIONS } from '@/types'
import type { ExpertDomain, CreativeCommonsLicense } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { isKnownOerUrl } from '@/lib/oer-platform'
import { updateDraft, updateAndSubmitDraft, updateDraftPdf } from '../actions'

interface RubricOption {
  id: string
  title: string
  description?: string | null
}

interface Props {
  documentId: string
  initial: {
    title: string
    authors: string
    subjectMatter: string
    creativeCommonsLicense: string
    thirdPartyContentDisclosure: string | null
    submissionScope: string[]
    rubricIds: string[]
    fileType: string | null
  }
  rubrics: RubricOption[]
  authorInstitution: string | null
  hasContent: boolean
  onDone: () => void
}

const PREDEFINED_ENTRIES = (Object.entries(EXPERT_DOMAIN_LABELS) as [ExpertDomain, string][])
  .filter(([key]) => key !== 'other')

const OTHER_SENTINEL = 'other'

const inputBase =
  'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 ' +
  'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 ' +
  'focus:border-[#1e3a5f] transition-colors bg-white disabled:bg-slate-50'

const tabBase = 'flex-1 py-2 text-sm font-medium rounded-md transition-colors'
const tabActive = 'bg-white text-[#1e3a5f] shadow-sm'
const tabInactive = 'text-slate-500 hover:text-slate-700'

type SourceTab = 'pdf' | 'url'

export function EditDraftForm({ documentId, initial, rubrics, authorInstitution, hasContent, onDone }: Props) {
  const isPredefined = PREDEFINED_ENTRIES.some(([key]) => key === initial.subjectMatter)
  const [title, setTitle] = useState(initial.title)
  const [authors, setAuthors] = useState(initial.authors)
  const [subjectMatter, setSubjectMatter] = useState(isPredefined ? initial.subjectMatter : OTHER_SENTINEL)
  const [customSubject, setCustomSubject] = useState(isPredefined ? '' : initial.subjectMatter)
  const [ccLicense, setCcLicense] = useState(initial.creativeCommonsLicense as CreativeCommonsLicense | '')
  const [thirdPartyDisclosure, setThirdPartyDisclosure] = useState(initial.thirdPartyContentDisclosure ?? '')
  const [submissionScope, setSubmissionScope] = useState<Set<'organization' | 'public'>>(
    new Set(initial.submissionScope as ('organization' | 'public')[])
  )
  const [selectedRubrics, setSelectedRubrics] = useState<Set<string>>(new Set(initial.rubricIds))

  // Content replacement state
  const [showContentReplace, setShowContentReplace] = useState(!hasContent)
  const [sourceTab, setSourceTab] = useState<SourceTab>('pdf')
  const [file, setFile] = useState<File | null>(null)
  const [oerUrl, setOerUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()
  const isOther = subjectMatter === OTHER_SENTINEL

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

  function buildMetadataPayload() {
    const finalSubjectMatter = isOther ? customSubject.trim() : subjectMatter
    return {
      title: title.trim(),
      authors: authors.trim(),
      subjectMatter: finalSubjectMatter,
      creativeCommonsLicense: ccLicense,
      thirdPartyContentDisclosure: thirdPartyDisclosure.trim() || null,
      submissionScope: Array.from(submissionScope),
      rubricIds: Array.from(selectedRubrics),
    }
  }

  // Returns true on success, throws on error
  async function applyContentUpdate(): Promise<boolean> {
    if (!showContentReplace) return false
    if (sourceTab === 'pdf') {
      if (!file) return false
      if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Only PDF files are supported.')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const storagePath = `${user.id}/${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { upsert: false })
      if (uploadError) throw new Error('Failed to upload PDF. Please try again.')
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 60 * 60)
      if (urlError || !signedUrl) throw new Error('Failed to get file URL.')
      await updateDraftPdf(documentId, { storagePath, fileUrl: signedUrl.signedUrl })
      return true
    } else {
      if (!oerUrl.trim()) return false
      if (!isKnownOerUrl(oerUrl.trim())) {
        throw new Error('URL must be from a supported OER platform (OpenStax, Pressbooks, OER Commons, LibreTexts, MERLOT, Open Textbook Library, or Siyavula).')
      }
      const res = await fetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: oerUrl.trim(), documentId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to fetch OER content.')
      }
      return true
    }
  }

  function handleSaveDraft() {
    setError(null)
    startTransition(async () => {
      try {
        await applyContentUpdate()
        await updateDraft(documentId, buildMetadataPayload())
        onDone()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save draft.')
      }
    })
  }

  function handleSubmitForReview() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    if (!authors.trim()) { setError('Author(s) is required.'); return }
    if (!subjectMatter) { setError('Subject matter is required.'); return }
    if (isOther && !customSubject.trim()) { setError('Please enter a subject area.'); return }
    if (!ccLicense) { setError('Creative Commons license is required.'); return }
    if (authorInstitution && submissionScope.size === 0) { setError('Please select at least one submission destination.'); return }

    const willHaveContent = hasContent || (showContentReplace && (!!file || !!oerUrl.trim()))
    if (!willHaveContent) { setError('Please add a PDF or OER URL before submitting for review.'); return }

    if (showContentReplace && sourceTab === 'url' && oerUrl.trim() && !isKnownOerUrl(oerUrl.trim())) {
      setError('URL must be from a supported OER platform (OpenStax, Pressbooks, OER Commons, LibreTexts, MERLOT, Open Textbook Library, or Siyavula).')
      return
    }

    startTransition(async () => {
      try {
        await applyContentUpdate()
        await updateAndSubmitDraft(documentId, buildMetadataPayload())
        onDone()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit for review.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={isPending}
          className={inputBase}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Author(s) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={authors}
          onChange={e => setAuthors(e.target.value)}
          disabled={isPending}
          className={inputBase}
        />
        <p className="mt-1 text-xs text-slate-400">Separate multiple authors with commas.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Subject Matter <span className="text-red-500">*</span>
        </label>
        <select
          value={subjectMatter}
          onChange={e => {
            setSubjectMatter(e.target.value)
            if (e.target.value !== OTHER_SENTINEL) setCustomSubject('')
          }}
          disabled={isPending}
          className={inputBase}
        >
          <option value="">Select a subject area…</option>
          <optgroup label="Standard domains">
            {PREDEFINED_ENTRIES.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </optgroup>
          <option value={OTHER_SENTINEL}>Other (specify below)…</option>
        </select>
        {isOther && (
          <input
            type="text"
            placeholder="Enter a subject area"
            value={customSubject}
            onChange={e => setCustomSubject(e.target.value)}
            disabled={isPending}
            className={`${inputBase} mt-2`}
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Creative Commons License <span className="text-red-500">*</span>
        </label>
        <select
          value={ccLicense}
          onChange={e => setCcLicense(e.target.value as CreativeCommonsLicense | '')}
          disabled={isPending}
          className={inputBase}
        >
          <option value="">Select a license…</option>
          {(Object.entries(CC_LICENSE_LABELS) as [CreativeCommonsLicense, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        {ccLicense && (
          <p className="mt-1 text-xs text-slate-400">{CC_LICENSE_DESCRIPTIONS[ccLicense]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Third-Party Content Disclosure
          <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          value={thirdPartyDisclosure}
          onChange={e => setThirdPartyDisclosure(e.target.value)}
          disabled={isPending}
          rows={2}
          className={`${inputBase} resize-none`}
        />
      </div>

      {/* Content source */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Content Source {!hasContent && <span className="text-red-500">*</span>}
          </label>
          {hasContent && !showContentReplace && (
            <button
              type="button"
              onClick={() => setShowContentReplace(true)}
              disabled={isPending}
              className="text-xs text-[#1e3a5f] hover:underline disabled:opacity-50"
            >
              Replace
            </button>
          )}
          {hasContent && showContentReplace && (
            <button
              type="button"
              onClick={() => { setShowContentReplace(false); setFile(null); setOerUrl('') }}
              disabled={isPending}
              className="text-xs text-slate-500 hover:underline disabled:opacity-50"
            >
              Keep existing
            </button>
          )}
        </div>

        {hasContent && !showContentReplace ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2.5 bg-slate-50 text-sm text-slate-600">
            <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {initial.fileType === 'pdf' ? 'PDF uploaded' : initial.fileType === 'html' ? 'OER URL linked' : 'Content attached'}
          </div>
        ) : (
          <>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 mb-3">
              <button
                type="button"
                onClick={() => setSourceTab('pdf')}
                disabled={isPending}
                className={`${tabBase} ${sourceTab === 'pdf' ? tabActive : tabInactive}`}
              >
                Upload PDF
              </button>
              <button
                type="button"
                onClick={() => setSourceTab('url')}
                disabled={isPending}
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
                  disabled={isPending}
                />
              </div>
            ) : (
              <div>
                <input
                  type="url"
                  placeholder="https://openstax.org/books/… or other OER platform URL"
                  value={oerUrl}
                  onChange={e => setOerUrl(e.target.value)}
                  disabled={isPending}
                  className={inputBase}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Supported: OpenStax, Pressbooks, OER Commons, LibreTexts, MERLOT, Open Textbook Library, Siyavula.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {authorInstitution && (
        <div>
          <p className="block text-sm font-medium text-slate-700 mb-1">
            Submit for review to <span className="text-red-500">*</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'organization' as const, label: 'My organization', description: `Held for coordinator approval at ${authorInstitution}` },
              { value: 'public' as const, label: 'Public pool', description: 'Visible to all eligible reviewers' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleScope(opt.value)}
                disabled={isPending}
                className={[
                  'flex flex-col items-start rounded-lg border-2 px-4 py-3 text-left transition-all duration-150',
                  submissionScope.has(opt.value) ? 'border-[#1e3a5f] bg-[#1e3a5f]/5' : 'border-slate-200 bg-white hover:border-slate-300',
                ].join(' ')}
              >
                <span className={['text-sm font-semibold', submissionScope.has(opt.value) ? 'text-[#1e3a5f]' : 'text-slate-700'].join(' ')}>
                  {opt.label}
                </span>
                <span className="mt-0.5 text-xs text-slate-500">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {rubrics.length > 0 && (
        <div>
          <p className="block text-sm font-medium text-slate-700 mb-1">Rubrics for review</p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {rubrics.map(r => (
              <label
                key={r.id}
                className={[
                  'flex items-start gap-3 rounded-lg border-2 px-3.5 py-2.5 cursor-pointer transition-all',
                  selectedRubrics.has(r.id) ? 'border-[#1e3a5f] bg-[#1e3a5f]/5' : 'border-slate-200 hover:border-slate-300',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#1e3a5f]"
                  checked={selectedRubrics.has(r.id)}
                  onChange={() => toggleRubric(r.id)}
                  disabled={isPending}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">{r.title}</span>
                  {r.description && (
                    <span className="block text-xs text-slate-500 mt-0.5">{r.description}</span>
                  )}
                </span>
              </label>
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
          onClick={onDone}
          disabled={isPending}
          className="py-2 px-4 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isPending}
          className="py-2 px-4 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          type="button"
          onClick={handleSubmitForReview}
          disabled={isPending}
          className={[
            'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm',
            isPending ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]',
          ].join(' ')}
        >
          {isPending ? 'Submitting…' : 'Submit for Review'}
        </button>
      </div>
    </div>
  )
}
