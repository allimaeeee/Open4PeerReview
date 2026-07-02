'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { SettingsModal } from '@/components/patterns/SettingsModal'

interface Props {
  displayName: string
}

function getInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  const word = words[0] ?? ''
  return word.slice(0, 2).toUpperCase() || word.toUpperCase()
}

export function UserMenu({ displayName }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [settingsOpen, setSettingsOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = getInitials(displayName)

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        showChevron={false}
        className="rounded-full w-8 h-8 bg-primary !text-on-primary text-label-sm font-semibold flex items-center justify-center normal-case tracking-normal hover:opacity-90"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="right">
        <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="w-4 h-4 flex-shrink-0">
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 8c0-.3 0-.6-.1-.9l1.4-1.1-1.5-2.6-1.7.7A5 5 0 0 0 9 3.4L8.8 1.5h-3L5.6 3.4A5 5 0 0 0 4 4.1l-1.7-.7L.8 6l1.4 1.1A5.2 5.2 0 0 0 2 8c0 .3 0 .6.1.9L.7 10l1.5 2.6 1.7-.7c.5.3 1 .5 1.6.7l.3 1.9h3l.3-1.9c.6-.2 1.1-.4 1.6-.7l1.7.7L13.5 10 12 8.9c.1-.3.1-.6.1-.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Settings
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="w-4 h-4 flex-shrink-0">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6.5 6.5a1.5 1.5 0 1 1 1.5 1.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
            </svg>
            Get help
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onClick={handleSignOut}>
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="w-4 h-4 flex-shrink-0">
              <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}

export default UserMenu
