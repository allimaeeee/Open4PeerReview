import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('onboarding_completed, display_name, institution, primary_discipline, profession, roles, reviewer_type, expertise_tags, rubric_specializations')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.onboarding_completed) redirect('/dashboard')

  const [{ data: institutions }, { data: rubrics }] = await Promise.all([
    supabase.from('institutions').select('name').order('name'),
    supabase.from('rubrics').select('id, title').order('title'),
  ])

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
      defaultReviewerType={profile?.reviewer_type ?? ''}
      defaultExpertiseTags={profile?.expertise_tags ?? []}
      defaultRubricSpecializations={profile?.rubric_specializations ?? []}
      institutions={(institutions ?? []).map((i) => i.name)}
      rubrics={(rubrics ?? []).map((r) => ({ id: r.id, title: r.title }))}
    />
  )
}
