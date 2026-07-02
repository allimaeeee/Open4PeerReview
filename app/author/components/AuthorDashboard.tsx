import { createClient } from '@/lib/supabase/server'
import { getMyDocumentsWithStats, getRubrics, getDistinctSubjectMatters } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS } from '@/types'
import { AuthorDashboardClient } from './AuthorDashboardClient'

interface Props {
  displayName: string
}

export async function AuthorDashboard({ displayName }: Props) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const [documents, rubrics, allSubjectMatters, profileResult] = await Promise.all([
    getMyDocumentsWithStats(supabase),
    getRubrics(supabase),
    getDistinctSubjectMatters(supabase),
    user
      ? supabase.from('users').select('institution').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const predefinedKeys = new Set(Object.keys(EXPERT_DOMAIN_LABELS))
  const customSubjectMatters = allSubjectMatters.filter(v => !predefinedKeys.has(v))
  const authorInstitution = (profileResult as { data: { institution: string | null } | null }).data?.institution ?? null

  return (
    <AuthorDashboardClient
      displayName={displayName}
      documents={documents}
      rubrics={rubrics}
      customSubjectMatters={customSubjectMatters}
      authorInstitution={authorInstitution}
    />
  )
}
