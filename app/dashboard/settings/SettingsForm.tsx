'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EXPERT_DOMAIN_LABELS, PROFESSION_LABELS } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'

const PROFESSION_OPTIONS = Object.entries(PROFESSION_LABELS).map(([value, label]) => ({ value, label }))
const DISCIPLINE_OPTIONS = Object.entries(EXPERT_DOMAIN_LABELS).map(([value, label]) => ({ value, label }))

const REVIEWER_TYPE_OPTIONS = [
  { value: 'academic_peer',   label: 'Academic Peer',   description: 'Researcher or faculty evaluating scholarly content' },
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
  institutions: string[]
  rubrics: { id: string; title: string }[]
}

function SaveButton({ loading, saved }: { loading: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button type="submit" variant="primary" size="lg" loading={loading}>
        Save changes
      </Button>
      {saved && !loading && (
        <span className="flex items-center gap-1.5 text-sm text-success font-medium">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Saved
        </span>
      )}
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5 pb-3 border-b border-slate-100">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
    </div>
  )
}

export function SettingsForm({
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
  const router = useRouter()
  const supabase = createClient()

  // ── Profile section ──────────────────────────────────────────────────────────
  const isKnownDiscipline = DISCIPLINE_OPTIONS.some(d => d.value === defaultDiscipline)
  const isKnownProfession = PROFESSION_OPTIONS.some(p => p.value === defaultProfession)

  const [displayName, setDisplayName]         = useState(defaultDisplayName)
  const [institution, setInstitution]         = useState(defaultInstitution)
  const [discipline, setDiscipline]           = useState(isKnownDiscipline ? defaultDiscipline : (defaultDiscipline ? 'other' : ''))
  const [disciplineOther, setDisciplineOther] = useState(isKnownDiscipline ? '' : defaultDiscipline)
  const [profession, setProfession]           = useState(isKnownProfession ? defaultProfession : (defaultProfession ? 'other' : ''))
  const [professionOther, setProfessionOther] = useState(isKnownProfession ? '' : defaultProfession)
  const [profileErrors, setProfileErrors]     = useState<Record<string, string>>({})
  const [profileServerError, setProfileServerError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading]   = useState(false)
  const [profileSaved, setProfileSaved]       = useState(false)

  // ── Email section ────────────────────────────────────────────────────────────
  const [newEmail, setNewEmail]               = useState(email)
  const [emailError, setEmailError]           = useState<string | null>(null)
  const [emailServerError, setEmailServerError] = useState<string | null>(null)
  const [emailLoading, setEmailLoading]       = useState(false)
  const [emailSaved, setEmailSaved]           = useState(false)

  // ── Password section ─────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors]   = useState<Record<string, string>>({})
  const [passwordServerError, setPasswordServerError] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSaved, setPasswordSaved]     = useState(false)

  // ── Roles section ────────────────────────────────────────────────────────────
  const [roles, setRoles]                     = useState<Set<'author' | 'reviewer'>>(new Set(defaultRoles))
  const [reviewerType, setReviewerType]       = useState(defaultReviewerType)
  const [expertiseTags, setExpertiseTags]     = useState<Set<string>>(new Set(defaultExpertiseTags))
  const [tagInput, setTagInput]               = useState('')
  const [rubricSpecs, setRubricSpecs]         = useState<Set<string>>(new Set(defaultRubricSpecializations))
  const [rolesErrors, setRolesErrors]         = useState<Record<string, string>>({})
  const [rolesServerError, setRolesServerError] = useState<string | null>(null)
  const [rolesLoading, setRolesLoading]       = useState(false)
  const [rolesSaved, setRolesSaved]           = useState(false)

  const isReviewer = roles.has('reviewer')

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function clearProfileError(key: string) {
    setProfileErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    setProfileSaved(false)
  }

  function toggleRole(role: 'author' | 'reviewer') {
    setRoles(prev => {
      const next = new Set(prev)
      if (next.has(role)) next.delete(role)
      else next.add(role)
      return next
    })
    setRolesErrors(prev => { const n = { ...prev }; delete n.roles; return n })
    setRolesSaved(false)
  }

  function toggleExpertiseTag(tag: string) {
    setExpertiseTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
    setRolesSaved(false)
  }

  function addCustomTag() {
    const tag = tagInput.trim()
    if (!tag) return
    setExpertiseTags(prev => new Set(prev).add(tag))
    setTagInput('')
    setRolesSaved(false)
  }

  function removeTag(tag: string) {
    setExpertiseTags(prev => { const n = new Set(prev); n.delete(tag); return n })
    setRolesSaved(false)
  }

  function toggleRubric(id: string) {
    setRubricSpecs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setRolesErrors(prev => { const n = { ...prev }; delete n.rubricSpecs; return n })
    setRolesSaved(false)
  }

  // ── Submit: profile ───────────────────────────────────────────────────────────
  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!displayName.trim()) errs.displayName = 'Display name is required.'
    if (!discipline)         errs.discipline  = 'Please select a discipline.'
    if (discipline === 'other' && !disciplineOther.trim()) errs.disciplineOther = 'Please specify your discipline.'
    if (!profession)         errs.profession  = 'Please select a profession.'
    if (profession === 'other' && !professionOther.trim()) errs.professionOther = 'Please specify your profession.'
    setProfileErrors(errs)
    if (Object.keys(errs).length) return

    setProfileLoading(true)
    setProfileServerError(null)

    const finalDiscipline = discipline === 'other' ? disciplineOther.trim() : discipline
    const finalProfession = profession === 'other' ? professionOther.trim() : profession
    const institutionName = institution.trim()

    if (institutionName) {
      await supabase.from('institutions').upsert({ name: institutionName }, { onConflict: 'name', ignoreDuplicates: true })
    }

    const { error } = await supabase
      .from('users')
      .update({
        display_name:       displayName.trim(),
        institution:        institutionName || null,
        primary_discipline: finalDiscipline,
        profession:         finalProfession,
      })
      .eq('id', userId)

    setProfileLoading(false)
    if (error) { setProfileServerError(error.message); return }
    setProfileSaved(true)
    router.refresh()
  }

  // ── Submit: email ─────────────────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newEmail.trim() || newEmail === email) {
      setEmailError('Enter a new email address.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError('Enter a valid email address.')
      return
    }
    setEmailError(null)
    setEmailLoading(true)
    setEmailServerError(null)

    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setEmailLoading(false)
    if (error) { setEmailServerError(error.message); return }
    setEmailSaved(true)
  }

  // ── Submit: password ──────────────────────────────────────────────────────────
  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!currentPassword)              errs.currentPassword  = 'Enter your current password.'
    if (!newPassword)                  errs.newPassword      = 'Enter a new password.'
    else if (newPassword.length < 8)   errs.newPassword      = 'Password must be at least 8 characters.'
    if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match.'
    setPasswordErrors(errs)
    if (Object.keys(errs).length) return

    setPasswordLoading(true)
    setPasswordServerError(null)

    // Verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (verifyError) {
      setPasswordErrors({ currentPassword: 'Current password is incorrect.' })
      setPasswordLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordLoading(false)
    if (error) { setPasswordServerError(error.message); return }
    setPasswordSaved(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  // ── Submit: roles ─────────────────────────────────────────────────────────────
  async function handleRolesSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (roles.size === 0)   errs.roles       = 'Please select at least one role.'
    if (isReviewer) {
      if (!reviewerType)    errs.reviewerType  = 'Please select your reviewer type.'
      if (rubricSpecs.size === 0) errs.rubricSpecs = 'Please select at least one rubric.'
    }
    setRolesErrors(errs)
    if (Object.keys(errs).length) return

    setRolesLoading(true)
    setRolesServerError(null)

    const { error } = await supabase
      .from('users')
      .update({
        roles:                   Array.from(roles),
        reviewer_type:           isReviewer ? reviewerType : null,
        expertise_tags:          isReviewer ? Array.from(expertiseTags) : [],
        rubric_specializations:  isReviewer ? Array.from(rubricSpecs) : [],
      })
      .eq('id', userId)

    setRolesLoading(false)
    if (error) { setRolesServerError(error.message); return }
    setRolesSaved(true)
    router.refresh()
  }

  const predefinedTagValues = new Set(DISCIPLINE_OPTIONS.map(d => d.value))
  const customTags = Array.from(expertiseTags).filter(t => !predefinedTagValues.has(t))

  return (
    <div className="space-y-8">

      {/* ── Profile ─────────────────────────────────────────────────────────── */}
      <Card variant="outlined" className="p-6">
        <SectionHeading title="Profile" description="Your public-facing name and academic background." />
        <form onSubmit={handleProfileSubmit} noValidate className="space-y-5">

          <Input
            id="displayName"
            type="text"
            label="Display name"
            required
            autoComplete="name"
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); clearProfileError('displayName') }}
            disabled={profileLoading}
            error={profileErrors.displayName}
          />

          <div>
            <Input
              id="institution"
              type="text"
              label="Institution"
              list="settings-institutions-list"
              autoComplete="organization"
              placeholder="Your university or organization"
              value={institution}
              onChange={e => { setInstitution(e.target.value); setProfileSaved(false) }}
              disabled={profileLoading}
            />
            <datalist id="settings-institutions-list">
              {institutions.map(name => <option key={name} value={name} />)}
            </datalist>
          </div>

          <div>
            <label htmlFor="discipline" className="block text-sm font-medium text-slate-700 mb-1.5">
              Primary discipline <span className="text-red-500">*</span>
            </label>
            <select
              id="discipline"
              value={discipline}
              onChange={e => { setDiscipline(e.target.value); clearProfileError('discipline'); clearProfileError('disciplineOther') }}
              disabled={profileLoading}
              className={inputBase}
            >
              <option value="">Select a discipline…</option>
              {DISCIPLINE_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            {profileErrors.discipline && <Alert variant="error" message={profileErrors.discipline} className="mt-1" />}
            {discipline === 'other' && (
              <Input
                type="text"
                placeholder="Please specify your discipline"
                value={disciplineOther}
                onChange={e => { setDisciplineOther(e.target.value); clearProfileError('disciplineOther') }}
                disabled={profileLoading}
                error={profileErrors.disciplineOther}
                className="mt-2"
              />
            )}
          </div>

          <div>
            <label htmlFor="profession" className="block text-sm font-medium text-slate-700 mb-1.5">
              Profession <span className="text-red-500">*</span>
            </label>
            <select
              id="profession"
              value={profession}
              onChange={e => { setProfession(e.target.value); clearProfileError('profession'); clearProfileError('professionOther') }}
              disabled={profileLoading}
              className={inputBase}
            >
              <option value="">Select your profession…</option>
              {PROFESSION_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {profileErrors.profession && <Alert variant="error" message={profileErrors.profession} className="mt-1" />}
            {profession === 'other' && (
              <Input
                type="text"
                placeholder="Please describe your profession"
                value={professionOther}
                onChange={e => { setProfessionOther(e.target.value); clearProfileError('professionOther') }}
                disabled={profileLoading}
                error={profileErrors.professionOther}
                className="mt-2"
              />
            )}
          </div>

          {profileServerError && <Alert variant="error" message={profileServerError} />}
          <SaveButton loading={profileLoading} saved={profileSaved} />
        </form>
      </Card>

      {/* ── Email ───────────────────────────────────────────────────────────── */}
      <Card variant="outlined" className="p-6">
        <SectionHeading title="Email address" description="Changing your email sends a confirmation link to the new address." />
        <form onSubmit={handleEmailSubmit} noValidate className="space-y-5">
          <Input
            id="newEmail"
            type="email"
            label="Email"
            required
            autoComplete="email"
            value={newEmail}
            onChange={e => { setNewEmail(e.target.value); setEmailError(null); setEmailSaved(false) }}
            disabled={emailLoading}
            error={emailError ?? undefined}
            helperText={emailSaved ? `Confirmation email sent to ${newEmail}. Check your inbox to complete the change.` : undefined}
          />
          {emailServerError && <Alert variant="error" message={emailServerError} />}
          <SaveButton loading={emailLoading} saved={false} />
        </form>
      </Card>

      {/* ── Password ────────────────────────────────────────────────────────── */}
      <Card variant="outlined" className="p-6">
        <SectionHeading title="Password" />
        <form onSubmit={handlePasswordSubmit} noValidate className="space-y-5">

          <Input
            id="currentPassword"
            type="password"
            label="Current password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={e => { setCurrentPassword(e.target.value); setPasswordErrors(p => { const n = {...p}; delete n.currentPassword; return n }) }}
            disabled={passwordLoading}
            error={passwordErrors.currentPassword}
          />

          <Input
            id="newPassword"
            type="password"
            label="New password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setPasswordErrors(p => { const n = {...p}; delete n.newPassword; return n }); setPasswordSaved(false) }}
            disabled={passwordLoading}
            error={passwordErrors.newPassword}
          />

          <Input
            id="confirmPassword"
            type="password"
            label="Confirm new password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setPasswordErrors(p => { const n = {...p}; delete n.confirmPassword; return n }); setPasswordSaved(false) }}
            disabled={passwordLoading}
            error={passwordErrors.confirmPassword}
          />

          {passwordServerError && <Alert variant="error" message={passwordServerError} />}
          <SaveButton loading={passwordLoading} saved={passwordSaved} />
        </form>
      </Card>

      {/* ── Roles ───────────────────────────────────────────────────────────── */}
      <Card variant="outlined" className="p-6">
        <SectionHeading title="Role & reviewer preferences" description="Your role determines which dashboards you can access." />
        <form onSubmit={handleRolesSubmit} noValidate className="space-y-5">

          {/* Role toggles */}
          <div>
            <p className="block text-sm font-medium text-slate-700 mb-1">
              Role <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-slate-500 mb-3">Select all that apply.</p>
            <div className="grid grid-cols-2 gap-3">
              {(['author', 'reviewer'] as const).map(role => (
                <Button
                  key={role}
                  type="button"
                  variant="toggle"
                  active={roles.has(role)}
                  onClick={() => toggleRole(role)}
                  disabled={rolesLoading}
                >
                  <span className="text-sm font-semibold capitalize">
                    {role === 'author' ? 'Author' : 'Reviewer'}
                  </span>
                  <span className="mt-0.5 text-xs text-slate-500">
                    {role === 'author' ? 'Submit work for peer review' : 'Review and evaluate submissions'}
                  </span>
                </Button>
              ))}
            </div>
            {rolesErrors.roles && <Alert variant="error" message={rolesErrors.roles} className="mt-1.5" />}
          </div>

          {/* Reviewer-specific fields */}
          {isReviewer && (
            <div className="space-y-5 rounded-xl border border-[#1e3a5f]/20 bg-[#1e3a5f]/[0.03] px-5 py-5">

              {/* Reviewer type */}
              <div>
                <p className="block text-sm font-medium text-slate-700 mb-2">
                  Reviewer type <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {REVIEWER_TYPE_OPTIONS.map(opt => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant="toggle"
                      active={reviewerType === opt.value}
                      onClick={() => { setReviewerType(opt.value); setRolesErrors(p => { const n={...p}; delete n.reviewerType; return n }); setRolesSaved(false) }}
                      disabled={rolesLoading}
                    >
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="mt-0.5 text-xs text-slate-500">{opt.description}</span>
                    </Button>
                  ))}
                </div>
                {rolesErrors.reviewerType && <Alert variant="error" message={rolesErrors.reviewerType} className="mt-1.5" />}
              </div>

              {/* Expertise tags */}
              <div>
                <p className="block text-sm font-medium text-slate-700 mb-1">
                  Expertise tags
                  <span className="ml-1.5 text-xs font-normal text-slate-400">optional</span>
                </p>
                <p className="text-xs text-slate-500 mb-3">Disciplines you can review, or add your own.</p>
                <div className="flex flex-wrap gap-2">
                  {DISCIPLINE_OPTIONS.map(d => (
                    <Button
                      key={d.value}
                      type="button"
                      variant="pill"
                      active={expertiseTags.has(d.value)}
                      onClick={() => toggleExpertiseTag(d.value)}
                      disabled={rolesLoading}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
                {customTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customTags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-[#1e3a5f] bg-[#1e3a5f] px-3 py-1 text-xs font-medium text-white">
                        {tag}
                        <Button
                          type="button"
                          variant="icon"
                          size="sm"
                          onClick={() => removeTag(tag)}
                          disabled={rolesLoading}
                          className="ml-0.5"
                          aria-label={`Remove ${tag}`}
                        >×</Button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <div className="flex-1 min-w-0">
                    <Input
                      type="text"
                      placeholder="Add a custom tag…"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
                      disabled={rolesLoading}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={addCustomTag}
                    disabled={rolesLoading || !tagInput.trim()}
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
                <p className="text-xs text-slate-500 mb-3">Rubrics you are qualified to apply.</p>
                <div className="space-y-2">
                  {rubrics.map(r => (
                    <Button
                      key={r.id}
                      type="button"
                      variant="toggle"
                      active={rubricSpecs.has(r.id)}
                      onClick={() => toggleRubric(r.id)}
                      disabled={rolesLoading}
                      className="!flex-row !items-center gap-3 !py-2.5"
                    >
                      <span className={[
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                        rubricSpecs.has(r.id) ? 'border-[#1e3a5f] bg-[#1e3a5f]' : 'border-slate-300 bg-white',
                      ].join(' ')}>
                        {rubricSpecs.has(r.id) && (
                          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className={['text-sm font-medium', rubricSpecs.has(r.id) ? 'text-[#1e3a5f]' : 'text-slate-700'].join(' ')}>
                        {r.title}
                      </span>
                    </Button>
                  ))}
                </div>
                {rolesErrors.rubricSpecs && <Alert variant="error" message={rolesErrors.rubricSpecs} className="mt-1.5" />}
              </div>

            </div>
          )}

          {rolesServerError && <Alert variant="error" message={rolesServerError} />}
          <SaveButton loading={rolesLoading} saved={rolesSaved} />
        </form>
      </Card>

    </div>
  )
}
