'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/supabase/useUser'
import { EXPERT_DOMAIN_LABELS, PROFESSION_LABELS } from '@/types'
import { Modal, ModalContent } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { ChipGroup } from '@/components/ui/ChipGroup'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Select } from '@/components/ui/Select'
import { SelectionCard } from '@/components/ui/SelectionCard'

type Tab = 'profile' | 'account' | 'roles'

interface Props {
  open: boolean
  onClose: () => void
}

const PROFESSION_OPTIONS = Object.entries(PROFESSION_LABELS).map(([value, label]) => ({ value, label }))
const DISCIPLINE_OPTIONS = Object.entries(EXPERT_DOMAIN_LABELS).map(([value, label]) => ({ value, label }))

const REVIEWER_TYPE_OPTIONS = [
  { value: 'academic_peer',   label: 'Academic Peer',   description: 'Researcher or faculty evaluating scholarly content' },
  { value: 'industry_expert', label: 'Industry Expert', description: 'Practitioner with domain expertise outside academia' },
] as const

const RUBRIC_DESCRIPTIONS: Record<string, string> = {
  'Accessibility':                      'Content usable by learners relying on assistive technologies',
  'Copy Editing':                        'Grammar, spelling, formatting, and clarity',
  'Copyright Review':                    'Licensing, attribution, and open reuse rights',
  'Disciplinary Appropriateness':        'Scholarly rigor, accuracy, and currency in field',
  'eLearning':                           'Digital tools and pedagogical effectiveness',
  'Universal Design for Learning (UDL)': 'Multiple pathways for engagement and expression',
}

function SettingsLogoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="w-3.5 h-3.5 text-text-primary">
      <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8c0-.3 0-.6-.1-.9l1.4-1.1-1.5-2.6-1.7.7A5 5 0 0 0 9 3.4L8.8 1.5h-3L5.6 3.4A5 5 0 0 0 4 4.1l-1.7-.7L.8 6l1.4 1.1A5.2 5.2 0 0 0 2 8c0 .3 0 .6.1.9L.7 10l1.5 2.6 1.7-.7c.5.3 1 .5 1.6.7l.3 1.9h3l.3-1.9c.6-.2 1.1-.4 1.6-.7l1.7.7L13.5 10 12 8.9c.1-.3.1-.6.1-.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'account', label: 'Account' },
  { id: 'roles',   label: 'Roles' },
]

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

function SaveButton({ loading, saved }: { loading: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button type="submit" variant="primary" size="md" loading={loading}>
        Save changes
      </Button>
      {saved && !loading && (
        <span className="flex items-center gap-1.5 text-body-sm text-success font-medium">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Saved
        </span>
      )}
    </div>
  )
}

export function SettingsModal({ open, onClose }: Props) {
  const { user } = useUser()
  const router = useRouter()
  const supabase = createClient()

  // ── Tab ───────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  // ── Data loading ──────────────────────────────────────────────────────────────
  const [dataLoading, setDataLoading]   = useState(true)
  const [institutions, setInstitutions] = useState<string[]>([])
  const [rubrics, setRubrics]           = useState<{ id: string; title: string }[]>([])

  // ── Profile section ───────────────────────────────────────────────────────────
  const [displayName, setDisplayName]               = useState('')
  const [institution, setInstitution]               = useState('')
  const [discipline, setDiscipline]                 = useState('')
  const [disciplineOther, setDisciplineOther]       = useState('')
  const [profession, setProfession]                 = useState('')
  const [professionOther, setProfessionOther]       = useState('')
  const [profileErrors, setProfileErrors]           = useState<Record<string, string>>({})
  const [profileServerError, setProfileServerError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading]         = useState(false)
  const [profileSaved, setProfileSaved]             = useState(false)

  // ── Email section ─────────────────────────────────────────────────────────────
  const [newEmail, setNewEmail]                   = useState('')
  const [emailError, setEmailError]               = useState<string | null>(null)
  const [emailServerError, setEmailServerError]   = useState<string | null>(null)
  const [emailLoading, setEmailLoading]           = useState(false)
  const [emailSaved, setEmailSaved]               = useState(false)

  // ── Password section ──────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword]         = useState('')
  const [newPassword, setNewPassword]                 = useState('')
  const [confirmPassword, setConfirmPassword]         = useState('')
  const [passwordErrors, setPasswordErrors]           = useState<Record<string, string>>({})
  const [passwordServerError, setPasswordServerError] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading]         = useState(false)
  const [passwordSaved, setPasswordSaved]             = useState(false)

  // ── Roles section ─────────────────────────────────────────────────────────────
  const [roles, setRoles]                         = useState<Set<'author' | 'reviewer' | 'coordinator'>>(new Set())
  const [reviewerType, setReviewerType]           = useState('')
  const [expertiseTags, setExpertiseTags]         = useState<Set<string>>(new Set())
  const [tagInput, setTagInput]                   = useState('')
  const [rubricSpecs, setRubricSpecs]             = useState<Set<string>>(new Set())
  const [rolesErrors, setRolesErrors]             = useState<Record<string, string>>({})
  const [rolesServerError, setRolesServerError]   = useState<string | null>(null)
  const [rolesLoading, setRolesLoading]           = useState(false)
  const [rolesSaved, setRolesSaved]               = useState(false)

  const isReviewer = roles.has('reviewer')

  // ── Fetch profile + reference data on open ────────────────────────────────────
  useEffect(() => {
    if (!open || !user?.id) return
    setDataLoading(true)

    Promise.all([
      supabase
        .from('users')
        .select('display_name, institution, primary_discipline, profession, roles, reviewer_type, expertise_tags, rubric_specializations')
        .eq('id', user.id)
        .single(),
      supabase.from('institutions').select('name').order('name'),
      supabase.from('rubrics').select('id, title').order('title'),
    ]).then(([{ data: profile }, { data: insts }, { data: rubs }]) => {
      const isKnownDiscipline = DISCIPLINE_OPTIONS.some(d => d.value === profile?.primary_discipline)
      const isKnownProfession = PROFESSION_OPTIONS.some(p => p.value === profile?.profession)

      setDisplayName(profile?.display_name ?? '')
      setInstitution(profile?.institution ?? '')
      setDiscipline(isKnownDiscipline ? (profile?.primary_discipline ?? '') : (profile?.primary_discipline ? 'other' : ''))
      setDisciplineOther(isKnownDiscipline ? '' : (profile?.primary_discipline ?? ''))
      setProfession(isKnownProfession ? (profile?.profession ?? '') : (profile?.profession ? 'other' : ''))
      setProfessionOther(isKnownProfession ? '' : (profile?.profession ?? ''))
      setRoles(new Set((profile?.roles ?? []) as ('author' | 'reviewer' | 'coordinator')[]))
      setReviewerType(profile?.reviewer_type ?? '')
      setExpertiseTags(new Set(profile?.expertise_tags ?? []))
      setRubricSpecs(new Set(profile?.rubric_specializations ?? []))
      setNewEmail(user.email ?? '')

      setInstitutions((insts ?? []).map(i => i.name))
      setRubrics((rubs ?? []).map(r => ({ id: r.id, title: r.title })))

      setDataLoading(false)
    })
  }, [open, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function clearProfileError(key: string) {
    setProfileErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    setProfileSaved(false)
  }

  function toggleRole(role: 'author' | 'reviewer' | 'coordinator') {
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
      .eq('id', user!.id)

    setProfileLoading(false)
    if (error) { setProfileServerError(error.message); return }
    setProfileSaved(true)
    router.refresh()
  }

  // ── Submit: email ─────────────────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newEmail.trim() || newEmail === user?.email) {
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
    if (!currentPassword)                errs.currentPassword  = 'Enter your current password.'
    if (!newPassword)                    errs.newPassword      = 'Enter a new password.'
    else if (newPassword.length < 8)     errs.newPassword      = 'Password must be at least 8 characters.'
    if (newPassword !== confirmPassword) errs.confirmPassword  = 'Passwords do not match.'
    setPasswordErrors(errs)
    if (Object.keys(errs).length) return

    setPasswordLoading(true)
    setPasswordServerError(null)

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email:    user?.email ?? '',
      password: currentPassword,
    })
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
    if (roles.size === 0)  errs.roles       = 'Please select at least one role.'
    if (isReviewer) {
      if (!reviewerType)         errs.reviewerType  = 'Please select your reviewer type.'
      if (rubricSpecs.size === 0) errs.rubricSpecs  = 'Please select at least one rubric.'
    }
    setRolesErrors(errs)
    if (Object.keys(errs).length) return

    setRolesLoading(true)
    setRolesServerError(null)

    const { error } = await supabase
      .from('users')
      .update({
        roles:                  Array.from(roles),
        reviewer_type:          isReviewer ? reviewerType : null,
        expertise_tags:         isReviewer ? Array.from(expertiseTags) : [],
        rubric_specializations: isReviewer ? Array.from(rubricSpecs) : [],
      })
      .eq('id', user!.id)

    setRolesLoading(false)
    if (error) { setRolesServerError(error.message); return }
    setRolesSaved(true)
    window.dispatchEvent(new CustomEvent('roles-updated'))
    router.refresh()
  }

  const predefinedTagValues = new Set(DISCIPLINE_OPTIONS.map(d => d.value))
  const customTags = Array.from(expertiseTags).filter(t => !predefinedTagValues.has(t))

  return (
    <Modal open={open} onClose={onClose}>
      <ModalContent className="relative">

        {/* ── Close button ─── */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="absolute top-3 right-3 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors z-10"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="w-4 h-4">
            <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {dataLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-body-sm text-text-muted">Loading...</p>
          </div>
        ) : (
          <div className="flex h-full">

            {/* ── Left column: nav ─── */}
            <div className="w-[30%] h-full flex flex-col p-4 bg-surface-container-low border-r border-border">
              <div className="flex items-center gap-2 mb-6">
                <SettingsLogoIcon />
                <span className="text-title-sm font-semibold text-text-primary">
                  Settings
                </span>
              </div>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cx(
                    'w-full text-left px-3 py-2 rounded-md text-body-md transition-colors cursor-pointer',
                    activeTab === tab.id
                      ? 'bg-surface-container text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-container hover:text-text-primary'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Right column: content ─── */}
            <div className="w-[70%] overflow-y-auto p-8">

              {/* ─────────────────────── TAB: Profile ─────────────────────── */}
              {activeTab === 'profile' && (
                <div>
                  <h3 className="text-title-lg font-heading font-semibold text-text-primary">Profile</h3>
                  <p className="text-body-sm text-text-muted mb-6">Your public-facing name and academic background.</p>
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
                      <Select
                        id="discipline"
                        label="Primary discipline"
                        required
                        value={discipline}
                        onChange={e => { setDiscipline(e.target.value); clearProfileError('discipline'); clearProfileError('disciplineOther') }}
                        disabled={profileLoading}
                        error={profileErrors.discipline}
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
                          onChange={e => { setDisciplineOther(e.target.value); clearProfileError('disciplineOther') }}
                          disabled={profileLoading}
                          error={profileErrors.disciplineOther}
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
                        onChange={e => { setProfession(e.target.value); clearProfileError('profession'); clearProfileError('professionOther') }}
                        disabled={profileLoading}
                        error={profileErrors.profession}
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
                </div>
              )}

              {/* ─────────────────────── TAB: Account ─────────────────────── */}
              {activeTab === 'account' && (
                <div>

                  {/* Email sub-section */}
                  <div>
                    <h3 className="text-title-lg font-heading font-semibold text-text-primary">Email address</h3>
                    <p className="text-body-sm text-text-muted mb-6">
                      Changing your email sends a confirmation link to the new address.
                    </p>
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
                  </div>

                  <div className="border-t border-border my-6" />

                  {/* Password sub-section */}
                  <div>
                    <h3 className="text-title-lg font-heading font-semibold text-text-primary">Password</h3>
                    <p className="text-body-sm text-text-muted mb-6">You must verify your current password before changes take effect.</p>
                    <form onSubmit={handlePasswordSubmit} noValidate className="space-y-5">
                      <Input
                        id="currentPassword"
                        type="password"
                        label="Current password"
                        required
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={e => { setCurrentPassword(e.target.value); setPasswordErrors(p => { const n = { ...p }; delete n.currentPassword; return n }) }}
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
                        onChange={e => { setNewPassword(e.target.value); setPasswordErrors(p => { const n = { ...p }; delete n.newPassword; return n }); setPasswordSaved(false) }}
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
                        onChange={e => { setConfirmPassword(e.target.value); setPasswordErrors(p => { const n = { ...p }; delete n.confirmPassword; return n }); setPasswordSaved(false) }}
                        disabled={passwordLoading}
                        error={passwordErrors.confirmPassword}
                      />
                      {passwordServerError && <Alert variant="error" message={passwordServerError} />}
                      <SaveButton loading={passwordLoading} saved={passwordSaved} />
                    </form>
                  </div>

                </div>
              )}

              {/* ───────────────────── TAB: Role & Preferences ────────────── */}
              {activeTab === 'roles' && (
                <div>
                  <form onSubmit={handleRolesSubmit} noValidate className="space-y-5">

                    {/* ── Roles sub-section ── */}
                    <div>
                      <h3 className="text-title-lg font-heading font-semibold text-text-primary">Role Selection</h3>
                      <p className="text-body-sm text-text-muted mt-1">
                        Indicate how you participate in OER. Your role determines which dashboards you can access.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <SelectionCard
                        selectionMode="checkbox"
                        isSelected={roles.has('author')}
                        onChange={() => toggleRole('author')}
                        disabled={rolesLoading}
                        title="Author"
                        description="Submit work for peer review"
                      />
                      <SelectionCard
                        selectionMode="checkbox"
                        isSelected={roles.has('reviewer')}
                        onChange={() => toggleRole('reviewer')}
                        disabled={rolesLoading}
                        title="Reviewer"
                        description="Review and evaluate submissions"
                      />
                      <SelectionCard
                        selectionMode="checkbox"
                        isSelected={roles.has('coordinator')}
                        onChange={() => toggleRole('coordinator')}
                        disabled={rolesLoading}
                        title="Coordinator"
                        description="Manage OER submissions for your organization"
                      />
                    </div>
                    {rolesErrors.roles && <Alert variant="error" message={rolesErrors.roles} className="mt-1.5" />}

                    {/* ── Reviewer Profile sub-section ── */}
                    {isReviewer && (
                      <>
                        <div className="border-t border-border my-6" />

                        <div>
                          <h3 className="text-title-lg font-heading font-semibold text-text-primary">Reviewer Profile</h3>
                          <p className="text-body-sm text-text-muted mt-1">
                            Customize how you appear to coordinators and which rubrics you are qualified to apply.
                          </p>
                        </div>

                        {/* Reviewer type */}
                        <div>
                          <p className="block text-body-md font-medium text-text-primary mb-2">
                            Reviewer type <span className="text-error" aria-hidden="true">*</span>
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            {REVIEWER_TYPE_OPTIONS.map(opt => (
                              <SelectionCard
                                key={opt.value}
                                selectionMode="radio"
                                isSelected={reviewerType === opt.value}
                                onChange={() => { setReviewerType(opt.value); setRolesErrors(p => { const n = { ...p }; delete n.reviewerType; return n }); setRolesSaved(false) }}
                                disabled={rolesLoading}
                                title={opt.label}
                                description={opt.description}
                              />
                            ))}
                          </div>
                          {rolesErrors.reviewerType && <Alert variant="error" message={rolesErrors.reviewerType} className="mt-1.5" />}
                        </div>

                        {/* Expertise tags */}
                        <div>
                          <p className="block text-body-md font-medium text-text-primary mb-1">
                            Expertise tags
                            <span className="ml-1.5 text-body-sm font-normal text-text-muted">optional</span>
                          </p>
                          <p className="text-body-sm text-text-muted mb-3">Disciplines you can review, or add your own.</p>
                          <ChipGroup label="Discipline suggestions">
                            {DISCIPLINE_OPTIONS.map(d => (
                              expertiseTags.has(d.value) ? (
                                <Chip
                                  key={d.value}
                                  label={d.label}
                                  variant="selected"
                                  onRemove={() => toggleExpertiseTag(d.value)}
                                  disabled={rolesLoading}
                                />
                              ) : (
                                <Chip
                                  key={d.value}
                                  label={d.label}
                                  variant="suggestion"
                                  onClick={() => toggleExpertiseTag(d.value)}
                                  disabled={rolesLoading}
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
                                  disabled={rolesLoading}
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
                                disabled={rolesLoading}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
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
                          <p className="block text-body-md font-medium text-text-primary mb-1">
                            Rubric specialization <span className="text-error" aria-hidden="true">*</span>
                          </p>
                          <p className="text-body-sm text-text-muted mb-3">Rubrics you are qualified to apply.</p>
                          <div className="grid grid-cols-2 gap-3">
                            {rubrics.map(r => (
                              <SelectionCard
                                key={r.id}
                                selectionMode="checkbox"
                                size="compact"
                                isSelected={rubricSpecs.has(r.id)}
                                onChange={() => toggleRubric(r.id)}
                                disabled={rolesLoading}
                                title={r.title}
                                description={RUBRIC_DESCRIPTIONS[r.title]}
                              />
                            ))}
                          </div>
                          {rolesErrors.rubricSpecs && <Alert variant="error" message={rolesErrors.rubricSpecs} className="mt-1.5" />}
                        </div>
                      </>
                    )}

                    {rolesServerError && <Alert variant="error" message={rolesServerError} />}
                    <SaveButton loading={rolesLoading} saved={rolesSaved} />
                  </form>
                </div>
              )}

            </div>
          </div>
        )}

      </ModalContent>
    </Modal>
  )
}
