'use client'

// components/auth/SignupForm.tsx

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
import type { SignupFormValues } from '../../types'

const inputBase =
  'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 ' +
  'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 ' +
  'focus:border-[#1e3a5f] transition-colors bg-white disabled:bg-slate-50 disabled:cursor-not-allowed'

interface SignupFormProps {
  onSuccess?: () => void
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [values, setValues] = useState<SignupFormValues>({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormValues, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const supabase = createBrowserSupabase()

  const set = (field: keyof SignupFormValues) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setValues((v) => ({ ...v, [field]: e.target.value }))
    setErrors((e2) => ({ ...e2, [field]: undefined }))
  }

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

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setServerError(null)

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      setServerError(error.message)
      return
    }

    setSuccess(true)
    onSuccess?.()
  }

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
          Click it to activate your account and complete your profile.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-1.5">
          Full name <span className="text-red-500">*</span>
        </label>
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
        {errors.displayName && <p className="mt-1 text-xs text-red-600">{errors.displayName}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
          Email address <span className="text-red-500">*</span>
        </label>
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
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
          Password <span className="text-red-500">*</span>
        </label>
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
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
          Confirm password <span className="text-red-500">*</span>
        </label>
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
        {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
      </div>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5">
          {serverError}
        </p>
      )}

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
