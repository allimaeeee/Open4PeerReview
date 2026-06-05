//Login page
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }

    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email to confirm your account.')
      }
    }

    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          OLI Annotation Platform
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <Input
              type="text"
              label="Display Name"
              required
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}

          <Input
            type="email"
            label="Email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            type="password"
            label="Password"
            required
            placeholder="••••••••"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          {message && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{message}</p>
          )}

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <Button
            type="button"
            variant="text"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </Button>
        </p>
      </div>
    </main>
  )
}