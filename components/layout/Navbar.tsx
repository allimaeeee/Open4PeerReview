'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/supabase/useUser'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { NavRoleSwitcher } from '@/components/patterns/NavRoleSwitcher'
import { NotificationBell } from '@/components/patterns/NotificationBell'
import { UserMenu } from '@/components/patterns/UserMenu'

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

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    const supabase = createClient()
    supabase
      .from('users')
      .select('display_name, roles, role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [user?.id])

  if (loading) return null

  const roles = profile?.roles ?? []
  const isCoordinator = profile?.role === 'admin'
  const availableViews = [
    ...(roles.includes('author') ? ['author'] : []),
    ...(roles.includes('reviewer') ? ['reviewer'] : []),
    ...(isCoordinator ? ['coordinator'] : []),
  ]

  const currentView = pathname.startsWith('/author')
    ? 'author'
    : pathname.startsWith('/reviewer')
    ? 'reviewer'
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
