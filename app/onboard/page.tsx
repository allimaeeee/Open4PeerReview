import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('onboarding_completed, display_name, institution, primary_discipline, profession, roles')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.onboarding_completed) redirect('/dashboard')

  const { data: institutions } = await supabase
    .from('institutions')
    .select('name')
    .order('name')

  const displayNameFallback =
    profile?.display_name ??
    (user.user_metadata?.display_name as string | undefined) ??
    ''

  return (
    <OnboardingForm
      userId={user.id}
      email={user.email ?? ''}
      defaultDisplayName={displayNameFallback}
      defaultInstitution={profile?.institution ?? ''}
      defaultDiscipline={profile?.primary_discipline ?? ''}
      defaultProfession={profile?.profession ?? ''}
      defaultRoles={(profile?.roles ?? []) as ('author' | 'reviewer')[]}
      institutions={(institutions ?? []).map((i) => i.name)}
    />
  )
}
