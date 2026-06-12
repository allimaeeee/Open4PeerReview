'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EXPERT_DOMAIN_LABELS, PROFESSION_LABELS } from '@/types'

const PROFESSION_OPTIONS = Object.entries(PROFESSION_LABELS).map(([value, label]) => ({ value, label }))
const DISCIPLINE_OPTIONS = Object.entries(EXPERT_DOMAIN_LABELS).map(([value, label]) => ({ value, label }))

const REVIEWER_TYPE_OPTIONS = [
  { value: 'academic_peer', label: 'Academic Peer', description: 'Researcher or faculty evaluating scholarly content' },
  { value: 'industry_expert', label: 'Industry Expert', description: 'Practitioner with domain expertise outside academia' },
] as const

const inputBase =
  'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 ' +
  'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 ' +
  'focus:border-[#1e3a5f] transition-colors bg-white disabled:bg-slate-50 disabled:cursor-not-allowed'

interface Props {
  userId: string
  email: string
  defaultDisplayName: string
  defaultInstitution: string
  defaultDiscipline: string
  defaultProfession: string
  defaultRoles: ('author' | 'reviewer')[]
  defaultReviewerType: string
  defaultExpertiseTags: string[]
  defaultRubricSpecializations: string[]
  defaultOerScope: ('public' | 'organization')[]
  institutions: string[]
  rubrics: { id: string; title: string }[]
}

export function OnboardingForm({
  userId,
  email,
  defaultDisplayName,
  defaultInstitution,
  defaultDiscipline,
  defaultProfession,
  defaultRoles,
  defaultReviewerType,
  defaultExpertiseTags,
  defaultRubricSpecializations,
  defaultOerScope,
  institutions,
  rubrics,
}: Props) {
  const isKnownDiscipline = DISCIPLINE_OPTIONS.some(d => d.value === defaultDiscipline)
  const isKnownProfession = PROFESSION_OPTIONS.some(p => p.value === defaultProfession)

  const [displayName, setDisplayName]         = useState(defaultDisplayName)
  const [institution, setInstitution]         = useState(defaultInstitution)
  const [discipline, setDiscipline]           = useState(isKnownDiscipline ? defaultDiscipline : (defaultDiscipline ? 'other' : ''))
  const [disciplineOther, setDisciplineOther] = useState(isKnownDiscipline ? '' : defaultDiscipline)
  const [profession, setProfession]           = useState(isKnownProfession ? defaultProfession : (defaultProfession ? 'other' : ''))
  const [professionOther, setProfessionOther] = useState(isKnownProfession ? '' : defaultProfession)
  const [roles, setRoles]                     = useState<Set<'author' | 'reviewer'>>(new Set(defaultRoles))
  const [reviewerType, setReviewerType]       = useState(defaultReviewerType)
  const [expertiseTags, setExpertiseTags]     = useState<Set<string>>(new Set(defaultExpertiseTags))
  const [tagInput, setTagInput]               = useState('')
  const [rubricSpecs, setRubricSpecs]         = useState<Set<string>>(new Set(defaultRubricSpecializations))
  const [oerScope, setOerScope]               = useState<Set<'public' | 'organization'>>(new Set(defaultOerScope))
  const [errors, setErrors]                   = useState<Record<string, string>>({})
  const [serverError, setServerError]         = useState<string | null>(null)
  const [loading, setLoading]                 = useState(false)

  const router = useRouter()
  const supabase = createClient()
  const isReviewer = roles.has('reviewer')

  function clearError(key: string) {
    setErrors(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  function toggleRole(role: 'author' | 'reviewer') {
    setRoles(prev => {
      const next = new Set(prev)
      if (next.has(role)) next.delete(role)
      else next.add(role)
      return next
    })
    clearError('roles')
  }

  function toggleExpertiseTag(tag: string) {
    setExpertiseTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function addCustomTag() {
    const tag = tagInput.trim()
    if (!tag) return
    setExpertiseTags(prev => new Set(prev).add(tag))
    setTagInput('')
  }

  function removeTag(tag: string) {
    setExpertiseTags(prev => {
      const next = new Set(prev)
      next.delete(tag)
      return next
    })
  }

  function toggleOerScope(scope: 'public' | 'organization') {
    setOerScope(prev => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  function toggleRubric(id: string) {
    setRubricSpecs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    clearError('rubricSpecs')
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!displayName.trim())    errs.displayName     = 'Display name is required'
    if (!discipline)            errs.discipline      = 'Please select a discipline'
    if (discipline === 'other' && !disciplineOther.trim())
                                errs.disciplineOther = 'Please specify your discipline'
    if (!profession)            errs.profession      = 'Please select a profession'
    if (profession === 'other' && !professionOther.trim())
                                errs.professionOther = 'Please specify your profession'
    if (roles.size === 0)       errs.roles           = 'Please select at least one role'
    if (isReviewer) {
      if (!reviewerType)        errs.reviewerType    = 'Please select your reviewer type'
      if (rubricSpecs.size === 0) errs.rubricSpecs   = 'Please select at least one rubric'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setServerError(null)

    const finalDiscipline = discipline === 'other' ? disciplineOther.trim() : discipline
    const finalProfession = profession === 'other' ? professionOther.trim() : profession
    const institutionName = institution.trim()

    if (institutionName) {
      await supabase
        .from('institutions')
        .upsert({ name: institutionName }, { onConflict: 'name', ignoreDuplicates: true })
    }

    const { error } = await supabase.from('users').upsert(
      {
        id:                       userId,
        email,
        display_name:             displayName.trim(),
        institution:              institutionName || null,
        primary_discipline:       finalDiscipline,
        profession:               finalProfession,
        roles:                    Array.from(roles),
        reviewer_type:            isReviewer ? reviewerType : null,
        expertise_tags:           isReviewer ? Array.from(expertiseTags) : [],
        rubric_specializations:   isReviewer ? Array.from(rubricSpecs) : [],
        oer_scope:                isReviewer && institution.trim() ? Array.from(oerScope) : [],
        onboarding_completed:     true,
      },
      { onConflict: 'id' }
    )

    setLoading(false)

    if (error) {
      setServerError(error.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  // Custom tags are those not in the predefined discipline list
  const predefinedTagValues = new Set(DISCIPLINE_OPTIONS.map(d => d.value))
  const customTags = Array.from(expertiseTags).filter(t => !predefinedTagValues.has(t))

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Welcome!</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Tell us a bit about yourself to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Display name */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-1.5">
              Display name <span className="text-red-500">*</span>
            </label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); clearError('displayName') }}
              disabled={loading}
              className={inputBase}
            />
            {errors.displayName && <p className="mt-1 text-xs text-red-600">{errors.displayName}</p>}
          </div>

          {/* Institution */}
          <div>
            <label htmlFor="institution" className="block text-sm font-medium text-slate-700 mb-1.5">
              Institution
              <span className="ml-1.5 text-xs font-normal text-slate-400">optional</span>
            </label>
            <input
              id="institution"
              type="text"
              list="institutions-list"
              autoComplete="organization"
              placeholder="Your university or organization"
              value={institution}
              onChange={e => setInstitution(e.target.value)}
              disabled={loading}
              className={inputBase}
            />
            <datalist id="institutions-list">
              {institutions.map(name => <option key={name} value={name} />)}
            </datalist>
          </div>

          {/* Primary discipline */}
          <div>
            <label htmlFor="discipline" className="block text-sm font-medium text-slate-700 mb-1.5">
              Primary discipline <span className="text-red-500">*</span>
            </label>
            <select
              id="discipline"
              value={discipline}
              onChange={e => { setDiscipline(e.target.value); clearError('discipline'); clearError('disciplineOther') }}
              disabled={loading}
              className={inputBase}
            >
              <option value="">Select a discipline…</option>
              {DISCIPLINE_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            {errors.discipline && <p className="mt-1 text-xs text-red-600">{errors.discipline}</p>}
            {discipline === 'other' && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Please specify your discipline"
                  value={disciplineOther}
                  onChange={e => { setDisciplineOther(e.target.value); clearError('disciplineOther') }}
                  disabled={loading}
                  className={inputBase}
                />
                {errors.disciplineOther && <p className="mt-1 text-xs text-red-600">{errors.disciplineOther}</p>}
              </div>
            )}
          </div>

          {/* Profession */}
          <div>
            <label htmlFor="profession" className="block text-sm font-medium text-slate-700 mb-1.5">
              Profession <span className="text-red-500">*</span>
            </label>
            <select
              id="profession"
              value={profession}
              onChange={e => { setProfession(e.target.value); clearError('profession'); clearError('professionOther') }}
              disabled={loading}
              className={inputBase}
            >
              <option value="">Select your profession…</option>
              {PROFESSION_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {errors.profession && <p className="mt-1 text-xs text-red-600">{errors.profession}</p>}
            {profession === 'other' && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Please describe your profession"
                  value={professionOther}
                  onChange={e => { setProfessionOther(e.target.value); clearError('professionOther') }}
                  disabled={loading}
                  className={inputBase}
                />
                {errors.professionOther && <p className="mt-1 text-xs text-red-600">{errors.professionOther}</p>}
              </div>
            )}
          </div>

          {/* Role */}
          <div>
            <p className="block text-sm font-medium text-slate-700 mb-1">
              Role <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-slate-500 mb-3">Select all that apply. You must choose at least one.</p>
            <div className="grid grid-cols-2 gap-3">
              {(['author', 'reviewer'] as const).map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  disabled={loading}
                  className={[
                    'flex flex-col items-start rounded-lg border-2 px-4 py-3 text-left transition-all duration-150',
                    roles.has(role)
                      ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  ].join(' ')}
                >
                  <span className={[
                    'text-sm font-semibold capitalize',
                    roles.has(role) ? 'text-[#1e3a5f]' : 'text-slate-700',
                  ].join(' ')}>
                    {role === 'author' ? 'Author' : 'Reviewer'}
                  </span>
                  <span className="mt-0.5 text-xs text-slate-500">
                    {role === 'author'
                      ? 'Submit work for peer review'
                      : 'Review and evaluate submissions'}
                  </span>
                </button>
              ))}
            </div>
            {errors.roles && <p className="mt-1.5 text-xs text-red-600">{errors.roles}</p>}
          </div>

          {/* ── Reviewer-specific fields ── */}
          {isReviewer && (
            <div className="space-y-5 rounded-xl border border-[#1e3a5f]/20 bg-[#1e3a5f]/[0.03] px-5 py-5">

              {/* Reviewer type */}
              <div>
                <p className="block text-sm font-medium text-slate-700 mb-1">
                  Reviewer type <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {REVIEWER_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setReviewerType(opt.value); clearError('reviewerType') }}
                      disabled={loading}
                      className={[
                        'flex flex-col items-start rounded-lg border-2 px-4 py-3 text-left transition-all duration-150',
                        reviewerType === opt.value
                          ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                          : 'border-slate-200 bg-white hover:border-slate-300',
                      ].join(' ')}
                    >
                      <span className={[
                        'text-sm font-semibold',
                        reviewerType === opt.value ? 'text-[#1e3a5f]' : 'text-slate-700',
                      ].join(' ')}>
                        {opt.label}
                      </span>
                      <span className="mt-0.5 text-xs text-slate-500">{opt.description}</span>
                    </button>
                  ))}
                </div>
                {errors.reviewerType && <p className="mt-1.5 text-xs text-red-600">{errors.reviewerType}</p>}
              </div>

              {/* Expertise tags */}
              <div>
                <p className="block text-sm font-medium text-slate-700 mb-1">
                  Expertise tags
                  <span className="ml-1.5 text-xs font-normal text-slate-400">optional</span>
                </p>
                <p className="text-xs text-slate-500 mb-3">Select disciplines you can review, or add your own.</p>
                <div className="flex flex-wrap gap-2">
                  {DISCIPLINE_OPTIONS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleExpertiseTag(d.value)}
                      disabled={loading}
                      className={[
                        'rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150',
                        expertiseTags.has(d.value)
                          ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                      ].join(' ')}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {/* Custom tags */}
                {customTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-[#1e3a5f] bg-[#1e3a5f] px-3 py-1 text-xs font-medium text-white"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          disabled={loading}
                          className="ml-0.5 text-white/70 hover:text-white"
                          aria-label={`Remove ${tag}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    placeholder="Add a custom tag…"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
                    disabled={loading}
                    className={inputBase}
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    disabled={loading || !tagInput.trim()}
                    className="shrink-0 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Rubric specialization */}
              <div>
                <p className="block text-sm font-medium text-slate-700 mb-1">
                  Rubric specialization <span className="text-red-500">*</span>
                </p>
                <p className="text-xs text-slate-500 mb-3">Choose at least one rubric you are qualified to apply.</p>
                <div className="space-y-2">
                  {rubrics.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRubric(r.id)}
                      disabled={loading}
                      className={[
                        'w-full flex items-center gap-3 rounded-lg border-2 px-4 py-2.5 text-left transition-all duration-150',
                        rubricSpecs.has(r.id)
                          ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                          : 'border-slate-200 bg-white hover:border-slate-300',
                      ].join(' ')}
                    >
                      <span className={[
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                        rubricSpecs.has(r.id)
                          ? 'border-[#1e3a5f] bg-[#1e3a5f]'
                          : 'border-slate-300 bg-white',
                      ].join(' ')}>
                        {rubricSpecs.has(r.id) && (
                          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className={[
                        'text-sm font-medium',
                        rubricSpecs.has(r.id) ? 'text-[#1e3a5f]' : 'text-slate-700',
                      ].join(' ')}>
                        {r.title}
                      </span>
                    </button>
                  ))}
                </div>
                {errors.rubricSpecs && <p className="mt-1.5 text-xs text-red-600">{errors.rubricSpecs}</p>}
              </div>

              {/* OER scope — only when institution is set */}
              {institution.trim() && (
                <div>
                  <p className="block text-sm font-medium text-slate-700 mb-1">
                    OER sources
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    Which open educational resources would you like to receive for review?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 'organization', label: 'My organization', description: `OER submitted by ${institution.trim()}` },
                      { value: 'public',       label: 'Public OER',      description: 'Open submissions from any author' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleOerScope(opt.value)}
                        disabled={loading}
                        className={[
                          'flex flex-col items-start rounded-lg border-2 px-4 py-3 text-left transition-all duration-150',
                          oerScope.has(opt.value)
                            ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                            : 'border-slate-200 bg-white hover:border-slate-300',
                        ].join(' ')}
                      >
                        <span className={[
                          'text-sm font-semibold',
                          oerScope.has(opt.value) ? 'text-[#1e3a5f]' : 'text-slate-700',
                        ].join(' ')}>
                          {opt.label}
                        </span>
                        <span className="mt-0.5 text-xs text-slate-500">{opt.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={[
              'w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 mt-2',
              'inline-flex items-center justify-center gap-2',
              loading
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm hover:shadow-md active:scale-[0.99]',
            ].join(' ')}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              'Get started'
            )}
          </button>

        </form>
      </div>
    </main>
  )
}
