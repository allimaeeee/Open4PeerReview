'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EXPERT_DOMAIN_LABELS, PROFESSION_LABELS } from '@/types'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { ChipGroup } from '@/components/ui/ChipGroup'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Select } from '@/components/ui/Select'
import { SelectionCard } from '@/components/ui/SelectionCard'
import { StepIndicator } from '@/components/ui/StepIndicator'

const PROFESSION_OPTIONS = Object.entries(PROFESSION_LABELS).map(([value, label]) => ({ value, label }))
const DISCIPLINE_OPTIONS = Object.entries(EXPERT_DOMAIN_LABELS).map(([value, label]) => ({ value, label }))

const RUBRIC_DESCRIPTIONS: Record<string, string> = {
  'Accessibility': 'Evaluate whether OER content is perceivable, operable, and usable by all learners, including those who rely on assistive technologies.',
  'Copy Editing': 'Review grammar, spelling, punctuation, formatting consistency, and clarity throughout the material.',
  'Copyright Review': 'Examine whether all content is properly licensed, attributed, and legally authorized for open reuse.',
  'Disciplinary Appropriateness': 'Assess whether the OER demonstrates scholarly rigor, factual accuracy, and currency within its academic field.',
  'eLearning': 'Evaluate the functionality, reliability, and pedagogical effectiveness of digital tools and technologies embedded in the OER.',
  'Universal Design for Learning (UDL)': 'Review whether the OER offers multiple pathways for engagement, representation, and expression to support diverse learners.',
}

interface Props {
  userId: string
  email: string
  defaultDisplayName: string
  defaultInstitution: string
  defaultDiscipline: string
  defaultProfession: string
  defaultRoles: ('author' | 'reviewer' | 'coordinator')[]
  defaultReviewerType: string
  defaultExpertiseTags: string[]
  defaultRubricSpecializations: string[]
  institutions: string[]
  rubrics: { id: string; title: string }[]
}

// â”€â”€ Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AuthorIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="w-5 h-5">
      <path d="M4 4a2 2 0 012-2h5.5L16 6.5V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 2v5h5M7 10h6M7 13h4"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ReviewerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="w-5 h-5">
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 12.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CoordinatorIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="w-5 h-5">
      <circle cx="10" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="3.5" cy="16" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16.5" cy="16" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 5v5M10 10L4 14.5M10 10l6 4.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function AcademicIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="w-5 h-5">
      <path d="M10 2L1.5 7 10 12l8.5-5L10 2z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5 9.5V14c0 1.933 2.239 3.5 5 3.5s5-1.567 5-3.5V9.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18.5 7v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IndustryIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="w-5 h-5">
      <rect x="1.5" y="7" width="17" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7V5a2 2 0 012-2h2a2 2 0 012 2v2"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M1.5 12h17" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// â”€â”€ Shared panel sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ReviewerEyebrow({ n }: { n: number }) {
  return (
    <p className="text-label-sm font-label uppercase tracking-widest text-text-muted mb-2">
      Reviewer Setup Â· {n} of 3
    </p>
  )
}

function PanelFooter({
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  loading = false,
}: {
  onBack?: () => void
  onContinue?: () => void
  continueLabel?: string
  continueDisabled?: boolean
  loading?: boolean
}) {
  return (
    <div className="flex justify-between items-center mt-8">
      {onBack ? (
        <Button type="button" variant="secondary" onClick={onBack} disabled={loading}>
          Back
        </Button>
      ) : (
        <span />
      )}
      {onContinue && (
        <Button
          type="button"
          variant="primary"
          onClick={onContinue}
          disabled={continueDisabled || loading}
          loading={loading}
        >
          {continueLabel}
        </Button>
      )}
    </div>
  )
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ State (preserved exactly) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [displayName, setDisplayName]         = useState(defaultDisplayName)
  const [institution, setInstitution]         = useState(defaultInstitution)
  const [discipline, setDiscipline]           = useState(isKnownDiscipline ? defaultDiscipline : (defaultDiscipline ? 'other' : ''))
  const [disciplineOther, setDisciplineOther] = useState(isKnownDiscipline ? '' : defaultDiscipline)
  const [profession, setProfession]           = useState(isKnownProfession ? defaultProfession : (defaultProfession ? 'other' : ''))
  const [professionOther, setProfessionOther] = useState(isKnownProfession ? '' : defaultProfession)
  const [roles, setRoles]                     = useState<Set<'author' | 'reviewer' | 'coordinator'>>(new Set(defaultRoles))
  const [reviewerType, setReviewerType]       = useState(defaultReviewerType)
  const [expertiseTags, setExpertiseTags]     = useState<Set<string>>(new Set(defaultExpertiseTags))
  const [tagInput, setTagInput]               = useState('')
  const [rubricSpecs, setRubricSpecs]         = useState<Set<string>>(new Set(defaultRubricSpecializations))
  const [errors, setErrors]                   = useState<Record<string, string>>({})
  const [serverError, setServerError]         = useState<string | null>(null)
  const [loading, setLoading]                 = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const mainStep = parseInt(searchParams.get('step') ?? '1', 10)
  const sub      = parseInt(searchParams.get('sub')  ?? '0', 10)
  const isReviewer = roles.has('reviewer')

  // â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function navigate(step: number, subStep?: number) {
    const params = new URLSearchParams()
    params.set('step', String(step))
    if (subStep !== undefined) params.set('sub', String(subStep))
    router.push(`/onboard?${params.toString()}`, { scroll: false })
  }

  // â”€â”€ Event handlers (preserved exactly) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function clearError(key: string) {
    setErrors(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  function toggleRole(role: 'author' | 'reviewer' | 'coordinator') {
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

  // â”€â”€ Validation (preserved exactly) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Submission (preserved sequence, triggered by button click) â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function submit() {
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

    navigate(4)
  }

  // â”€â”€ Derived values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const predefinedTagValues = new Set(DISCIPLINE_OPTIONS.map(d => d.value))
  const customTags = Array.from(expertiseTags).filter(t => !predefinedTagValues.has(t))

  const canContinuePanel2 =
    !!displayName.trim() &&
    !!discipline &&
    (discipline !== 'other' || !!disciplineOther.trim()) &&
    !!profession &&
    (profession !== 'other' || !!professionOther.trim())

  // â”€â”€ Panel renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderPanel() {

    // Panel 1 â€” Welcome
    if (mainStep === 1) return (
      <>
        <img src="/welcome-icon.svg" alt="" className="w-20 h-20 mb-4" />
        <h1 className="text-heading-sm font-semibold font-heading text-text-primary">Welcome to Open4PeerReview</h1>
        <p className="text-body-md text-text-muted mt-2">
          Open Educational Resources improve when experts and authors collaborate. Whether you create OERs or evaluate them â€” your contribution strengthens learning for everyone.
        </p>
        <p className="text-body-md text-text-muted mt-1">This takes about 3 minutes.</p>
        <PanelFooter
          onContinue={() => navigate(2)}
          continueLabel="Get started"
        />
      </>
    )

    // Panel 2 â€” Personal info
    if (mainStep === 2) return (
      <>
        <h1 className="text-heading-sm font-semibold font-heading text-text-primary">Tell us about yourself</h1>
        <p className="text-body-md text-text-muted mt-2">
          This helps match you with the right tasks and gives reviewers and authors helpful context.
        </p>

        <div className="space-y-5 mt-6">
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
              <option value="">Select a disciplineâ€¦</option>
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
              <option value="">Select your professionâ€¦</option>
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
        </div>

        <PanelFooter
          onBack={() => navigate(1)}
          onContinue={() => navigate(3)}
          continueDisabled={!canContinuePanel2}
          loading={loading}
        />
      </>
    )

    // Panel 3 â€” Role selection
    if (mainStep === 3 && sub === 0) return (
      <>
        <h1 className="text-heading-sm font-semibold font-heading text-text-primary">How do you participate in OER?</h1>
        <p className="text-body-md text-text-muted mt-2">
          Pick all that apply â€” many people both create and review. You can always add roles later from your profile settings.
        </p>

        <div className="space-y-3 mt-6">
          <SelectionCard
            selectionMode="checkbox"
            isSelected={roles.has('author')}
            onChange={() => toggleRole('author')}
            disabled={loading}
            icon={<AuthorIcon />}
            title="Author"
            description="You create Open Educational Resources and want structured expert feedback to improve your work and pursue certification."
          />
          <SelectionCard
            selectionMode="checkbox"
            isSelected={roles.has('reviewer')}
            onChange={() => toggleRole('reviewer')}
            disabled={loading}
            icon={<ReviewerIcon />}
            title="Reviewer"
            description="You're a subject-matter expert who evaluates OERs against professional rubrics and provides evidence-based feedback."
          />
          <SelectionCard
            selectionMode="checkbox"
            isSelected={roles.has('coordinator')}
            onChange={() => toggleRole('coordinator')}
            icon={<CoordinatorIcon />}
            title="Coordinator"
            description="You oversee review pipelines, match reviewers to resources, and ensure feedback quality before it reaches authors."
          />
        </div>

        {errors.roles && <Alert variant="error" message={errors.roles} className="mt-3" />}
        {serverError && <Alert variant="error" message={serverError} className="mt-3" />}

        <PanelFooter
          onBack={() => navigate(2)}
          onContinue={async () => {
            if (roles.has('reviewer')) {
              navigate(3, 1)
            } else {
              await submit()
            }
          }}
          continueDisabled={roles.size === 0}
          loading={loading}
        />
      </>
    )

    // Panel 3.1 â€” Reviewer type
    if (mainStep === 3 && sub === 1) return (
      <>
        <ReviewerEyebrow n={1} />
        <h1 className="text-heading-sm font-semibold font-heading text-text-primary">What kind of reviewer are you?</h1>
        <p className="text-body-md text-text-muted mt-2">
          This is shown alongside your feedback so authors understand your perspective. It doesn't limit which rubrics you can apply.
        </p>

        <div className="space-y-3 mt-6">
          <SelectionCard
            selectionMode="radio"
            isSelected={reviewerType === 'academic_peer'}
            onChange={() => { setReviewerType('academic_peer'); clearError('reviewerType') }}
            disabled={loading}
            icon={<AcademicIcon />}
            title="Academic Peer"
            description="You're faculty, a researcher, or an academic expert evaluating OERs for scholarly rigor, disciplinary accuracy, and pedagogical quality."
          />
          <SelectionCard
            selectionMode="radio"
            isSelected={reviewerType === 'industry_expert'}
            onChange={() => { setReviewerType('industry_expert'); clearError('reviewerType') }}
            disabled={loading}
            icon={<IndustryIcon />}
            title="Industry Expert"
            description="You bring workforce and industry perspective â€” evaluating whether OERs prepare learners for real-world professional contexts."
          />
        </div>

        {errors.reviewerType && <Alert variant="error" message={errors.reviewerType} className="mt-3" />}

        <PanelFooter
          onBack={() => navigate(3)}
          onContinue={() => navigate(3, 2)}
          continueDisabled={!reviewerType}
          loading={loading}
        />
      </>
    )

    // Panel 3.2 â€” Expertise tags
    if (mainStep === 3 && sub === 2) return (
      <>
        <ReviewerEyebrow n={2} />
        <h1 className="text-heading-sm font-semibold font-heading text-text-primary">What are your areas of expertise?</h1>
        <p className="text-body-md text-text-muted mt-2">
          These tags surface tasks that match your knowledge. Add at least two â€” you can always update them in Settings.
        </p>

        <div className="mt-6">
          <p className="text-sm font-medium text-text-primary mb-1">
            Expertise tags
            <span className="ml-1.5 text-xs font-normal text-text-muted">(minimum 2)</span>
          </p>
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
                placeholder="Add a custom tagâ€¦"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
                disabled={loading}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addCustomTag}
              disabled={loading || !tagInput.trim()}
              className="shrink-0"
            >
              Add
            </Button>
          </div>
        </div>

        <PanelFooter
          onBack={() => navigate(3, 1)}
          onContinue={() => navigate(3, 3)}
          continueDisabled={expertiseTags.size < 2}
          loading={loading}
        />
      </>
    )

    // Panel 3.3 â€” Rubric specialization
    if (mainStep === 3 && sub === 3) return (
      <>
        <ReviewerEyebrow n={3} />
        <h1 className="text-heading-sm font-semibold font-heading text-text-primary">Which rubrics are you qualified to apply?</h1>
        <p className="text-body-md text-text-muted mt-2">
          Only tasks using your selected rubrics will appear in your Task Pool. You can update this in Settings.
        </p>

        <div className="grid grid-cols-2 gap-3 mt-6">
          {rubrics.map(r => (
            <SelectionCard
              key={r.id}
              selectionMode="checkbox"
              size="compact"
              isSelected={rubricSpecs.has(r.id)}
              onChange={() => toggleRubric(r.id)}
              disabled={loading}
              title={r.title}
              description={RUBRIC_DESCRIPTIONS[r.title]}
            />
          ))}
        </div>

        {errors.rubricSpecs && <Alert variant="error" message={errors.rubricSpecs} className="mt-3" />}
        {serverError && <Alert variant="error" message={serverError} className="mt-3" />}

        <PanelFooter
          onBack={() => navigate(3, 2)}
          onContinue={async () => { await submit() }}
          continueDisabled={rubricSpecs.size === 0}
          loading={loading}
        />
      </>
    )

    // Panel 4 â€” Finish
    if (mainStep === 4) return (
      <>
        <img src="/celebration-icon.svg" alt="" className="w-20 h-20 mb-4" />
        <h1 className="text-heading-sm font-semibold font-heading text-text-primary">You're all set, {displayName}!</h1>
        <p className="text-body-md text-text-muted mt-2">
          You're ready to go. Explore your dashboard to see what's waiting for you â€” and if anything changes, you can always update your profile in Settings.
        </p>

        <div className="flex justify-end gap-3 mt-8">
          {roles.has('reviewer') && (
            <Button
              type="button"
              variant={roles.has('author') || roles.has('coordinator') ? 'secondary' : 'primary'}
              onClick={() => router.push('/reviewer')}
            >
              Go to reviewer dashboard
            </Button>
          )}
          {roles.has('coordinator') && (
            <Button
              type="button"
              variant={roles.has('author') ? 'secondary' : 'primary'}
              onClick={() => router.push('/coordinator')}
            >
              Go to coordinator dashboard
            </Button>
          )}
          {roles.has('author') && (
            <Button
              type="button"
              variant="primary"
              onClick={() => router.push('/author')}
            >
              Go to author dashboard
            </Button>
          )}
        </div>
      </>
    )

    return null
  }

  // â”€â”€ Shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="min-h-screen bg-surface py-12 px-4">
      <div className="max-w-[600px] mx-auto">
        <p className="text-label-sm font-label font-semibold uppercase tracking-widest text-secondary">
          Getting started
        </p>
        <p className="text-heading-lg font-semibold font-heading text-text-primary">
          New User Onboarding
        </p>
        <div className="mt-6 mb-10">
          <StepIndicator
            steps={['Welcome', 'Personal Info', 'Role(s)', 'Finish']}
            currentStep={mainStep}
          />
        </div>
        <form noValidate onSubmit={e => e.preventDefault()} className="bg-white rounded-lg shadow-1 p-8">
          {renderPanel()}
        </form>
      </div>
    </div>
  )
}
