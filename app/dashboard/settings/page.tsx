import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: institutions }, { data: rubrics }] = await Promise.all([
    supabase
      .from('users')
      .select('display_name, institution, primary_discipline, profession, roles, reviewer_type, expertise_tags, rubric_specializations')
      .eq('id', user.id)
      .single(),
    supabase.from('institutions').select('name').order('name'),
    supabase.from('rubrics').select('id, title').order('title'),
  ])

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to dashboard
        </a>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your profile, account, and reviewer preferences.</p>
      </div>

      <SettingsForm
        userId={user.id}
        email={user.email ?? ''}
        defaultDisplayName={profile?.display_name ?? ''}
        defaultInstitution={profile?.institution ?? ''}
        defaultDiscipline={profile?.primary_discipline ?? ''}
        defaultProfession={profile?.profession ?? ''}
        defaultRoles={(profile?.roles ?? []) as ('author' | 'reviewer')[]}
        defaultReviewerType={profile?.reviewer_type ?? ''}
        defaultExpertiseTags={profile?.expertise_tags ?? []}
        defaultRubricSpecializations={profile?.rubric_specializations ?? []}
        institutions={(institutions ?? []).map(i => i.name)}
        rubrics={(rubrics ?? []).map(r => ({ id: r.id, title: r.title }))}
      />
    </main>
  )
}
