import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReviewerDashboard } from './components/ReviewerDashboard'

export default async function ReviewerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, roles, role, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_completed) redirect('/onboard')

  const roles: string[] = profile.roles ?? []
  if (!roles.includes('reviewer')) redirect('/author')

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {profile.display_name ? `Welcome, ${profile.display_name}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">{user.email}</p>
        </div>
      </div>

      <ReviewerDashboard userId={user.id} />
    </main>
  )
}
