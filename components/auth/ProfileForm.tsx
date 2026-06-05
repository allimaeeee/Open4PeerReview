'use client'

// components/auth/ProfileForm.tsx
// Allows an existing user to update display_name, profession, and primary_discipline.

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
import {
  PROFESSION_LABELS,
  EXPERT_DOMAIN_LABELS,
  type AppUser,
  type ProfileFormValues,
} from '../../types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const PROFESSION_OPTIONS = Object.entries(PROFESSION_LABELS).map(([value, label]) => ({ value, label }))
const DISCIPLINE_OPTIONS = Object.entries(EXPERT_DOMAIN_LABELS).map(([value, label]) => ({ value, label }))

const inputBase =
  'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 ' +
  'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 ' +
  'focus:border-[#1e3a5f] transition-colors bg-white disabled:bg-slate-50 disabled:cursor-not-allowed'

interface ProfileFormProps {
  user: AppUser
  onSaved?: (updated: AppUser) => void
}

export function ProfileForm({ user, onSaved }: ProfileFormProps) {
  const knownDiscipline = DISCIPLINE_OPTIONS.some(d => d.value === user.primary_discipline)
  const knownProfession = PROFESSION_OPTIONS.some(p => p.value === user.profession)

  const [values, setValues] = useState<ProfileFormValues>({
    displayName:      user.display_name ?? '',
    profession:       knownProfession ? (user.profession ?? '') : 'other',
    primaryDiscipline: knownDiscipline ? (user.primary_discipline ?? '') : (user.primary_discipline ? 'other' : ''),
  })
  const [professionOther, setProfessionOther]   = useState(knownProfession ? '' : (user.profession ?? ''))
  const [disciplineOther, setDisciplineOther]   = useState(knownDiscipline ? '' : (user.primary_discipline ?? ''))
  const [errors, setErrors]                     = useState<Partial<Record<keyof ProfileFormValues, string>>>({})
  const [serverError, setServerError]           = useState<string | null>(null)
  const [loading, setLoading]                   = useState(false)
  const [saved, setSaved]                       = useState(false)

  const supabase = createBrowserSupabase()

  const set = (field: keyof ProfileFormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setValues((v) => ({ ...v, [field]: e.target.value }))
    setErrors((e2) => ({ ...e2, [field]: undefined }))
    setSaved(false)
  }

  const validate = (): boolean => {
    const newErrors: typeof errors = {}
    if (!values.displayName.trim()) newErrors.displayName = 'Name is required'
    if (!values.profession)        newErrors.profession   = 'Please select your profession'
    if (!values.primaryDiscipline) newErrors.primaryDiscipline = 'Please select your discipline'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setServerError(null)

    const finalProfession  = values.profession === 'other' ? professionOther.trim() : values.profession
    const finalDiscipline  = values.primaryDiscipline === 'other' ? disciplineOther.trim() : values.primaryDiscipline

    const { data, error } = await supabase
      .from('users')
      .update({
        display_name:       values.displayName,
        profession:         finalProfession,
        primary_discipline: finalDiscipline,
      })
      .eq('id', user.id)
      .select()
      .single()

    setLoading(false)

    if (error) {
      setServerError(error.message)
      return
    }

    setSaved(true)
    onSaved?.(data as AppUser)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input
        id="displayName"
        type="text"
        label="Full name"
        required
        autoComplete="name"
        value={values.displayName}
        onChange={set('displayName')}
        disabled={loading}
        error={errors.displayName}
      />

      <Input
        type="email"
        label="Email address"
        value={user.email}
        readOnly
        helperText="Email cannot be changed here."
      />

      <div>
        <label htmlFor="profession" className="block text-sm font-medium text-slate-700 mb-1.5">
          Profession <span className="text-red-500">*</span>
        </label>
        <select
          id="profession"
          value={values.profession}
          onChange={set('profession')}
          disabled={loading}
          className={inputBase}
        >
          <option value="">Select your profession…</option>
          {PROFESSION_OPTIONS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        {errors.profession && <p className="mt-1 text-xs text-red-600">{errors.profession}</p>}
        {values.profession === 'other' && (
          <Input
            type="text"
            placeholder="Please describe your profession"
            value={professionOther}
            onChange={e => { setProfessionOther(e.target.value); setSaved(false) }}
            disabled={loading}
            className="mt-2"
          />
        )}
      </div>

      <div>
        <label htmlFor="primaryDiscipline" className="block text-sm font-medium text-slate-700 mb-1.5">
          Primary discipline <span className="text-red-500">*</span>
        </label>
        <select
          id="primaryDiscipline"
          value={values.primaryDiscipline}
          onChange={set('primaryDiscipline')}
          disabled={loading}
          className={inputBase}
        >
          <option value="">Select your discipline…</option>
          {DISCIPLINE_OPTIONS.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        {errors.primaryDiscipline && <p className="mt-1 text-xs text-red-600">{errors.primaryDiscipline}</p>}
        {values.primaryDiscipline === 'other' && (
          <Input
            type="text"
            placeholder="Please specify your discipline"
            value={disciplineOther}
            onChange={e => { setDisciplineOther(e.target.value); setSaved(false) }}
            disabled={loading}
            className="mt-2"
          />
        )}
      </div>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5">{serverError}</p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="flex-1"
          loading={loading}
        >
          Save changes
        </Button>

        {saved && !loading && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd" />
            </svg>
            Saved
          </span>
        )}
      </div>
    </form>
  )
}
