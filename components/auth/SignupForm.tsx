'use client'

// components/auth/SignupForm.tsx

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
import type { SignupFormValues } from '../../types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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
      <Input
        id="displayName"
        type="text"
        label="Full name"
        required
        autoComplete="name"
        placeholder="Jane Smith"
        value={values.displayName}
        onChange={set('displayName')}
        disabled={loading}
        error={errors.displayName}
      />

      <Input
        id="email"
        type="email"
        label="Email address"
        required
        autoComplete="email"
        placeholder="you@university.edu"
        value={values.email}
        onChange={set('email')}
        disabled={loading}
        error={errors.email}
      />

      <Input
        id="password"
        type="password"
        label="Password"
        required
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={values.password}
        onChange={set('password')}
        disabled={loading}
        error={errors.password}
      />

      <Input
        id="confirmPassword"
        type="password"
        label="Confirm password"
        required
        autoComplete="new-password"
        placeholder="Repeat your password"
        value={values.confirmPassword}
        onChange={set('confirmPassword')}
        disabled={loading}
        error={errors.confirmPassword}
      />

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5">
          {serverError}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
        Create account
      </Button>
    </form>
  )
}
