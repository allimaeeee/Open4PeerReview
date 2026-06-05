import { createClient } from '@/lib/supabase/server'
import { getMyDocumentsWithStats, getRubrics, getDistinctSubjectMatters } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS } from '@/types'
import { AuthorDashboardClient } from './AuthorDashboardClient'

export async function AuthorDashboard() {
  const supabase = await createClient()
  const [documents, rubrics, allSubjectMatters] = await Promise.all([
    getMyDocumentsWithStats(supabase),
    getRubrics(supabase),
    getDistinctSubjectMatters(supabase),
  ])

  const predefinedKeys = new Set(Object.keys(EXPERT_DOMAIN_LABELS))
  const customSubjectMatters = allSubjectMatters.filter(v => !predefinedKeys.has(v))

  return (
    <AuthorDashboardClient
      documents={documents}
      rubrics={rubrics}
      customSubjectMatters={customSubjectMatters}
    />
  )
}
