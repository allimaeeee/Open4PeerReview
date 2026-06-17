import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoordinatorDashboard } from './components/CoordinatorDashboard'

export default async function CoordinatorPage() {
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
  if (!roles.includes('coordinator') && profile.role !== 'admin') redirect('/author')

  return <CoordinatorDashboard />
}
