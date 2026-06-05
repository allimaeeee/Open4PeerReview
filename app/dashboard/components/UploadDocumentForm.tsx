'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadDocument, assignRubrics } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS } from '@/types'
import type { ExpertDomain } from '@/types'

interface RubricOption {
  id: string
  title: string
  description: string | null
}

interface Props {
  rubrics: RubricOption[]
  customSubjectMatters: string[]
  onCancel: () => void
}

// All predefined keys except "other", which we handle as a special sentinel
const PREDEFINED_ENTRIES = (Object.entries(EXPERT_DOMAIN_LABELS) as [ExpertDomain, string][])
  .filter(([key]) => key !== 'other')

const OTHER_SENTINEL = 'other'

const inputBase =
  'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 ' +
  'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 ' +
  'focus:border-[#1e3a5f] transition-colors bg-white disabled:bg-slate-50'

export function UploadDocumentForm({ rubrics, customSubjectMatters, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [authors, setAuthors] = useState('')
  const [subjectMatter, setSubjectMatter] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [selectedRubrics, setSelectedRubrics] = useState<Set<string>>(new Set())
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) { setError('Title is required.'); return }
    if (!authors.trim()) { setError('Author(s) is required.'); return }
    if (!subjectMatter) { setError('Subject matter is required.'); return }
    if (isOther && !customSubject.trim()) { setError('Please enter a subject area.'); return }
    if (!file) { setError('Please select a PDF file.'); return }
    if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are supported.'); return }

    setLoading(true)
    try {
      const doc = await uploadDocument(supabase, file, title.trim(), 'pdf', authors.trim(), finalSubjectMatter)
      if (selectedRubrics.size > 0) {
        await assignRubrics(supabase, doc.id, Array.from(selectedRubrics))
      }
      router.refresh()
      onCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
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
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Subject Matter <span className="text-red-500">*</span>
        </label>
        <select
          value={subjectMatter}
          onChange={e => {
            setSubjectMatter(e.target.value)
            if (e.target.value !== OTHER_SENTINEL) setCustomSubject('')
          }}
          disabled={loading}
          className={inputBase}
        >
          <option value="">Select a subject area…</option>

          {/* Predefined domains */}
          <optgroup label="Standard domains">
            {PREDEFINED_ENTRIES.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </optgroup>

          {/* Previously entered custom subjects */}
          {customSubjectMatters.length > 0 && (
            <optgroup label="Community-added">
              {customSubjectMatters.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </optgroup>
          )}

          <option value={OTHER_SENTINEL}>Other (specify below)…</option>
        </select>

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

      {/* PDF file */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          PDF File <span className="text-red-500">*</span>
        </label>
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
      </div>

      {/* Rubric selection */}
      {rubrics.length > 0 && (
        <div>
          <p className="block text-sm font-medium text-slate-700 mb-1">Rubrics for review</p>
          <p className="text-xs text-slate-500 mb-3">Select the rubrics reviewers should use for this document.</p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {rubrics.map(r => (
              <label
                key={r.id}
                className={[
                  'flex items-start gap-3 rounded-lg border-2 px-3.5 py-2.5 cursor-pointer transition-all',
                  selectedRubrics.has(r.id)
                    ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                    : 'border-slate-200 hover:border-slate-300',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#1e3a5f]"
                  checked={selectedRubrics.has(r.id)}
                  onChange={() => toggleRubric(r.id)}
                  disabled={loading}
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
          onClick={onCancel}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
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
              Uploading…
            </>
          ) : 'Upload Document'}
        </button>
      </div>
    </form>
  )
}
