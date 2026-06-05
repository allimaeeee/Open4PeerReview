//Navbar component
'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/supabase/useUser'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function Navbar() {
  const { user, loading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) return null

  return (
    <nav className="border-b border-gray-200 bg-white px-6 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/dashboard" className="font-semibold text-gray-900">
          Open4PeerReview
        </Link>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <Button variant="text" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </nav>
  )
}