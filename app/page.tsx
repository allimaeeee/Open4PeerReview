import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function dashboardForRoles(roles: string[]): string {
  if (roles.includes('coordinator')) return '/coordinator'
  if (roles.includes('author')) return '/author'
  return '/reviewer'
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .maybeSingle()

  redirect(dashboardForRoles(profile?.roles ?? []))
}