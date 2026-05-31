import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RoleToggle } from './components/RoleToggle'
import { AuthorDashboard } from './components/AuthorDashboard'
import { ReviewerDashboard } from './components/ReviewerDashboard'
import { CoordinatorDashboard } from './components/CoordinatorDashboard'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
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
  const isCoordinator = profile.role === 'admin'
  const isAuthor = roles.includes('author')
  const isReviewer = roles.includes('reviewer')

  const availableViews = [
    ...(isAuthor ? ['author'] : []),
    ...(isReviewer ? ['reviewer'] : []),
    ...(isCoordinator ? ['coordinator'] : []),
  ]

  if (availableViews.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-slate-500">No role assigned to your account. Please contact an administrator.</p>
      </main>
    )
  }

  const { view: viewParam } = await searchParams
  const activeView = availableViews.includes(viewParam ?? '') ? (viewParam as string) : availableViews[0]

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {profile.display_name ? `Welcome, ${profile.display_name}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">{user.email}</p>
        </div>
        {availableViews.length > 1 && (
          <RoleToggle currentView={activeView} availableViews={availableViews} />
        )}
      </div>

      {activeView === 'author' && <AuthorDashboard />}
      {activeView === 'reviewer' && <ReviewerDashboard userId={user.id} />}
      {activeView === 'coordinator' && <CoordinatorDashboard />}
    </main>
  )
}
