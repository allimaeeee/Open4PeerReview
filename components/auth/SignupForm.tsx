'use client'

// components/auth/SignupForm.tsx
// Full signup form: email, password, display name, profession, expert domain.

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
import {
  PROFESSION_LABELS,
  EXPERT_DOMAIN_LABELS,
  type SignupFormValues,
  type UserProfession,
  type ExpertDomain,
} from '../../types'
import { Constants } from '../../types/database.types'

const PROFESSIONS  = Constants.Enums.user_profession
const DOMAINS      = Constants.Enums.expert_domain

// ─── Field helpers ────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children, required }: {
  htmlFor: string; children: React.ReactNode; required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

const inputBase =
  'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 ' +
  'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 ' +
  'focus:border-[#1e3a5f] transition-colors bg-white disabled:bg-slate-50 disabled:cursor-not-allowed'

// ─── Component ────────────────────────────────────────────────────────────────

interface SignupFormProps {
  onSuccess?: () => void
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [values, setValues] = useState<SignupFormValues>({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    profession: '',
    expertDomain: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormValues, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const supabase = createBrowserSupabase()

  const set = (field: keyof SignupFormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setValues((v) => ({ ...v, [field]: e.target.value }))
    setErrors((e2) => ({ ...e2, [field]: undefined }))
  }

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const newErrors: typeof errors = {}

    if (!values.email.trim()) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
      newErrors.email = 'Enter a valid email address'

    if (!values.password) newErrors.password = 'Password is required'
    else if (values.password.length < 8)
      newErrors.password = 'Password must be at least 8 characters'

    if (values.confirmPassword !== values.password)
      newErrors.confirmPassword = 'Passwords do not match'

    if (!values.displayName.trim()) newErrors.displayName = 'Name is required'

    if (!values.profession) newErrors.profession = 'Please select your profession'
    if (!values.expertDomain) newErrors.expertDomain = 'Please select your domain'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setServerError(null)

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName },
      },
    })

    if (authError) {
      setServerError(authError.message)
      setLoading(false)
      return
    }

    const userId = authData.user?.id
    if (!userId) {
      setServerError('Unexpected error — please try again.')
      setLoading(false)
      return
    }

    // 2. Insert public user profile
    const { error: profileError } = await supabase.from('users').insert({
      id: userId,
      email: values.email,
      display_name: values.displayName,
      profession: values.profession as UserProfession,
      expert_domain: values.expertDomain as ExpertDomain,
      role: 'reviewer',
    })

    if (profileError) {
      setServerError(profileError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    setSuccess(true)
    onSuccess?.()
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="text-center py-8 space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <svg className="h-6 w-6 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Check your inbox</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          We sent a confirmation link to <strong>{values.email}</strong>.
          Click it to activate your account.
        </p>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Display name */}
      <div>
        <FieldLabel htmlFor="displayName" required>Full name</FieldLabel>
        <input
          id="displayName"
          type="text"
          autoComplete="name"
          placeholder="Jane Smith"
          value={values.displayName}
          onChange={set('displayName')}
          disabled={loading}
          className={inputBase}
        />
        <FieldError message={errors.displayName} />
      </div>

      {/* Email */}
      <div>
        <FieldLabel htmlFor="email" required>Email address</FieldLabel>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@university.edu"
          value={values.email}
          onChange={set('email')}
          disabled={loading}
          className={inputBase}
        />
        <FieldError message={errors.email} />
      </div>

      {/* Password */}
      <div>
        <FieldLabel htmlFor="password" required>Password</FieldLabel>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={values.password}
          onChange={set('password')}
          disabled={loading}
          className={inputBase}
        />
        <FieldError message={errors.password} />
      </div>

      {/* Confirm password */}
      <div>
        <FieldLabel htmlFor="confirmPassword" required>Confirm password</FieldLabel>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={values.confirmPassword}
          onChange={set('confirmPassword')}
          disabled={loading}
          className={inputBase}
        />
        <FieldError message={errors.confirmPassword} />
      </div>

      {/* Profession + Expert domain side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="profession" required>Profession</FieldLabel>
          <select
            id="profession"
            value={values.profession}
            onChange={set('profession')}
            disabled={loading}
            className={inputBase}
          >
            <option value="">Select…</option>
            {PROFESSIONS.map((p) => (
              <option key={p} value={p}>
                {PROFESSION_LABELS[p]}
              </option>
            ))}
          </select>
          <FieldError message={errors.profession} />
        </div>

        <div>
          <FieldLabel htmlFor="expertDomain" required>Expert domain</FieldLabel>
          <select
            id="expertDomain"
            value={values.expertDomain}
            onChange={set('expertDomain')}
            disabled={loading}
            className={inputBase}
          >
            <option value="">Select…</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {EXPERT_DOMAIN_LABELS[d]}
              </option>
            ))}
          </select>
          <FieldError message={errors.expertDomain} />
        </div>
      </div>

      {/* Server error */}
      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5">
          {serverError}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className={[
          'w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150',
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
            Creating account…
          </>
        ) : (
          'Create account'
        )}
      </button>
    </form>
  )
}
