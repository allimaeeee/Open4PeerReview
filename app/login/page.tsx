//Login page
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'

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
        setError(error.message.endsWith('.') ? error.message : error.message + '.')
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
        setError(error.message.endsWith('.') ? error.message : error.message + '.')
      } else {
        setMessage('Check your email to confirm your account.')
      }
    }

    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface">
      <Card variant="elevated" className="flex w-full max-w-4xl overflow-hidden">
        <div className="flex flex-col items-center justify-center gap-5 bg-surface-warm p-8 flex-1">
          <img src="/welcome-icon.svg" alt="" className="w-20 h-20" />
          <h2 className="font-heading text-heading-sm font-semibold text-text-primary text-center">
            Welcome to Open4PeerReview
          </h2>
          <p className="font-body text-body-md text-text-muted text-center">
            OER thrive when experts collaborate. Open4PeerReview brings together scholarly collaborators to ensure OER meets the highest standards of quality.
          </p>
        </div>
        <div className="p-8 flex-1">
        <h1 className="mb-2 text-heading-sm font-semibold font-heading text-text-primary">
          {mode === 'login' ? 'Log In' : 'Sign Up'}
        </h1>
        <p className="mb-6 text-body-md font-body text-text-muted">
          {mode === 'login' ? 'Welcome back — log in to continue.' : 'Create your account to get started.'}
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

          {error && <Alert variant="error" message={error} />}
          {message && <Alert variant="success" message={message} />}

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <p className="mt-4 text-center text-body-md font-body text-text-muted">
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
      </Card>
    </main>
  )
}