'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EXPERT_DOMAIN_LABELS, PROFESSION_LABELS } from '@/types'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { ChipGroup } from '@/components/ui/ChipGroup'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Select } from '@/components/ui/Select'
import { SelectionCard } from '@/components/ui/SelectionCard'

const PROFESSION_OPTIONS = Object.entries(PROFESSION_LABELS).map(([value, label]) => ({ value, label }))
const DISCIPLINE_OPTIONS = Object.entries(EXPERT_DOMAIN_LABELS).map(([value, label]) => ({ value, label }))

const REVIEWER_TYPE_OPTIONS = [
  { value: 'academic_peer', label: 'Academic Peer', description: 'Researcher or faculty evaluating scholarly content' },
  { value: 'industry_expert', label: 'Industry Expert', description: 'Practitioner with domain expertise outside academia' },
] as const

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
    if (!displayName.trim())    errs.displayName     = 'Display name is required.'
    if (!discipline)            errs.discipline      = 'Please select a discipline.'
    if (discipline === 'other' && !disciplineOther.trim())
                                errs.disciplineOther = 'Please specify your discipline.'
    if (!profession)            errs.profession      = 'Please select a profession.'
    if (profession === 'other' && !professionOther.trim())
                                errs.professionOther = 'Please specify your profession.'
    if (roles.size === 0)       errs.roles           = 'Please select at least one role.'
    if (isReviewer) {
      if (!reviewerType)        errs.reviewerType    = 'Please select your reviewer type.'
      if (rubricSpecs.size === 0) errs.rubricSpecs   = 'Please select at least one rubric.'
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
      <Card variant="elevated" className="w-full max-w-lg p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Welcome!</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Tell us a bit about yourself to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Display name */}
          <Input
            id="displayName"
            type="text"
            label="Display name"
            required
            autoComplete="name"
            placeholder="Your name"
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); clearError('displayName') }}
            disabled={loading}
            error={errors.displayName}
          />

          {/* Institution */}
          <div>
            <Input
              id="institution"
              type="text"
              label="Institution"
              list="institutions-list"
              autoComplete="organization"
              placeholder="Your university or organization"
              value={institution}
              onChange={e => setInstitution(e.target.value)}
              disabled={loading}
            />
            <datalist id="institutions-list">
              {institutions.map(name => <option key={name} value={name} />)}
            </datalist>
          </div>

          {/* Primary discipline */}
          <div>
            <Select
              id="discipline"
              label="Primary discipline"
              required
              value={discipline}
              onChange={e => { setDiscipline(e.target.value); clearError('discipline'); clearError('disciplineOther') }}
              disabled={loading}
              error={errors.discipline}
            >
              <option value="">Select a discipline…</option>
              {DISCIPLINE_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </Select>
            {discipline === 'other' && (
              <Input
                type="text"
                placeholder="Please specify your discipline"
                value={disciplineOther}
                onChange={e => { setDisciplineOther(e.target.value); clearError('disciplineOther') }}
                disabled={loading}
                error={errors.disciplineOther}
                className="mt-2"
              />
            )}
          </div>

          {/* Profession */}
          <div>
            <Select
              id="profession"
              label="Profession"
              required
              value={profession}
              onChange={e => { setProfession(e.target.value); clearError('profession'); clearError('professionOther') }}
              disabled={loading}
              error={errors.profession}
            >
              <option value="">Select your profession…</option>
              {PROFESSION_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
            {profession === 'other' && (
              <Input
                type="text"
                placeholder="Please describe your profession"
                value={professionOther}
                onChange={e => { setProfessionOther(e.target.value); clearError('professionOther') }}
                disabled={loading}
                error={errors.professionOther}
                className="mt-2"
              />
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
                <SelectionCard
                  key={role}
                  selectionMode="checkbox"
                  isSelected={roles.has(role)}
                  onChange={() => toggleRole(role)}
                  disabled={loading}
                  title={role === 'author' ? 'Author' : 'Reviewer'}
                  description={role === 'author' ? 'Submit work for peer review' : 'Review and evaluate submissions'}
                />
              ))}
            </div>
            {errors.roles && <Alert variant="error" message={errors.roles} className="mt-1.5" />}
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
                    <SelectionCard
                      key={opt.value}
                      selectionMode="radio"
                      isSelected={reviewerType === opt.value}
                      onChange={() => { setReviewerType(opt.value); clearError('reviewerType') }}
                      disabled={loading}
                      title={opt.label}
                      description={opt.description}
                    />
                  ))}
                </div>
                {errors.reviewerType && <Alert variant="error" message={errors.reviewerType} className="mt-1.5" />}
              </div>

              {/* Expertise tags */}
              <div>
                <p className="block text-sm font-medium text-slate-700 mb-1">
                  Expertise tags
                  <span className="ml-1.5 text-xs font-normal text-slate-400">optional</span>
                </p>
                <p className="text-xs text-slate-500 mb-3">Select disciplines you can review, or add your own.</p>
                <ChipGroup label="Discipline suggestions">
                  {DISCIPLINE_OPTIONS.map(d => (
                    expertiseTags.has(d.value) ? (
                      <Chip
                        key={d.value}
                        label={d.label}
                        variant="selected"
                        onRemove={() => toggleExpertiseTag(d.value)}
                        disabled={loading}
                      />
                    ) : (
                      <Chip
                        key={d.value}
                        label={d.label}
                        variant="suggestion"
                        onClick={() => toggleExpertiseTag(d.value)}
                        disabled={loading}
                      />
                    )
                  ))}
                </ChipGroup>

                {/* Custom tags */}
                {customTags.length > 0 && (
                  <ChipGroup label="Selected expertise tags" className="mt-2">
                    {customTags.map(tag => (
                      <Chip
                        key={tag}
                        label={tag}
                        variant="selected"
                        onRemove={() => removeTag(tag)}
                        disabled={loading}
                      />
                    ))}
                  </ChipGroup>
                )}

                <div className="flex gap-2 mt-3">
                  <div className="flex-1 min-w-0">
                    <Input
                      type="text"
                      placeholder="Add a custom tag…"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
                      disabled={loading}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={addCustomTag}
                    disabled={loading || !tagInput.trim()}
                    className="shrink-0"
                  >
                    Add
                  </Button>
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
                    <SelectionCard
                      key={r.id}
                      selectionMode="checkbox"
                      size="compact"
                      isSelected={rubricSpecs.has(r.id)}
                      onChange={() => toggleRubric(r.id)}
                      disabled={loading}
                      title={r.title}
                    />
                  ))}
                </div>
                {errors.rubricSpecs && <Alert variant="error" message={errors.rubricSpecs} className="mt-1.5" />}
              </div>

            </div>
          )}

          {serverError && <Alert variant="error" message={serverError} />}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            className="mt-2"
          >
            Get started
          </Button>

        </form>
      </Card>
    </main>
  )
}
