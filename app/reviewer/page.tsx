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
  if (!roles.includes('reviewer')) {
    redirect(roles.includes('coordinator') ? '/coordinator' : '/author')
  }

  return <ReviewerDashboard userId={user.id} displayName={profile?.display_name ?? ''} />
}
