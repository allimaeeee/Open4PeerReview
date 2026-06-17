'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/supabase/useUser'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { NavRoleSwitcher } from '@/components/patterns/NavRoleSwitcher'
import { NotificationBell } from '@/components/patterns/NotificationBell'
import { UserMenu } from '@/components/patterns/UserMenu'
import { useReviewSaveStatus } from '@/lib/review-save-context'

function formatLastSaved(lastSavedAt: Date | null): string {
  if (!lastSavedAt) return 'Not yet saved'
  const diffSec = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000)
  const time = lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffSec < 10) return `Last saved ${time} (just now)`
  if (diffSec < 60) return `Last saved ${time} (${diffSec}s ago)`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Last saved ${time} (${diffMin} min ago)`
  const diffHrs = Math.floor(diffMin / 60)
  const remMin  = diffMin % 60
  if (diffHrs < 24) {
    const parts = [`${diffHrs} ${diffHrs === 1 ? 'hr' : 'hrs'}`]
    if (remMin > 0) parts.push(`${remMin} min`)
    return `Last saved ${time} (${parts.join(', ')} ago)`
  }
  const diffDays = Math.floor(diffHrs / 24)
  const remHrs   = diffHrs % 24
  const parts = [`${diffDays} ${diffDays === 1 ? 'day' : 'days'}`]
  if (remHrs > 0) parts.push(`${remHrs} ${remHrs === 1 ? 'hr' : 'hrs'}`)
  if (remMin > 0) parts.push(`${remMin} min`)
  return `Last saved ${time} (${parts.join(', ')} ago)`
}

type Profile = {
  display_name: string | null
  roles: string[] | null
  role: string | null
}

function LogoIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="w-4 h-4 text-on-primary"
    >
      <path
        d="M 8 1 C 9.4 2.3 11.1 2.9 13 3.1 C 13.1 5 13.7 6.6 15 8 C 13.7 9.4 13.1 11 13 12.9 C 11.1 13.1 9.4 13.7 8 15 C 6.6 13.7 5 13.1 3.1 12.9 C 2.9 11 2.3 9.4 1 8 C 2.3 6.6 2.9 5 3.1 3.1 C 5 2.9 6.6 2.3 8 1 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 4.5 8 L 7 10.5 L 11.5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Navbar() {
  const { user, loading } = useUser()
  const [profile, setProfile] = useState<Profile | null>(null)
  const pathname = usePathname()
  const { saveStatus, lastSavedAt } = useReviewSaveStatus()
  const [, setTick] = useState(0)
  const inReviewConsole = pathname.startsWith('/review')

  useEffect(() => {
    if (!inReviewConsole) return
    const id = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(id)
  }, [inReviewConsole])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    const supabase = createClient()
    const fetchProfile = () =>
      supabase
        .from('users')
        .select('display_name, roles, role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setProfile(data))

    fetchProfile()
    window.addEventListener('roles-updated', fetchProfile)
    return () => window.removeEventListener('roles-updated', fetchProfile)
  }, [user?.id])

  if (loading) return null

  const roles = profile?.roles ?? []
  const availableViews = [
    ...(roles.includes('author') ? ['author'] : []),
    ...(roles.includes('reviewer') ? ['reviewer'] : []),
    ...(roles.includes('coordinator') || profile?.role === 'admin' ? ['coordinator'] : []),
  ]

  const currentView = pathname.startsWith('/author')
    ? 'author'
    : pathname.startsWith('/reviewer')
    ? 'reviewer'
    : pathname.startsWith('/coordinator')
    ? 'coordinator'
    : availableViews[0] ?? ''

  const showRightSide =
    !!user &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/onboard')

  return (
    <nav className="border-b border-border bg-surface-card px-6 py-3">
      <div className="flex items-center justify-between">
        <Link
          href={user ? '/author' : '/login'}
          className="flex items-center gap-2 font-semibold font-display text-text-primary"
        >
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <LogoIcon />
          </div>
          O4PR Certification Hub
        </Link>
        {showRightSide && (
          <div className="flex items-center gap-4">
            {inReviewConsole && (
              <div className="flex items-center gap-1.5">
                {saveStatus === 'saving' && (
                  <svg className="w-3.5 h-3.5 animate-spin text-text-muted" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                    <path d="M8 2A6 6 0 0114 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {saveStatus === 'saved' && (
                  <svg className="w-3.5 h-3.5 text-success" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M5 8.5L7 10.5L11 6" />
                  </svg>
                )}
                <span className="text-body-sm text-text-muted">
                  {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : formatLastSaved(lastSavedAt)}
                </span>
              </div>
            )}
            <NavRoleSwitcher currentView={currentView} availableViews={availableViews} />
            <NotificationBell />
            <UserMenu
              displayName={profile?.display_name ?? user.email ?? ''}
            />
          </div>
        )}
      </div>
    </nav>
  )
}
