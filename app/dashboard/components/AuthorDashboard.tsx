import { createClient } from '@/lib/supabase/server'
import { getMyDocumentsWithStats, getRubrics } from '@/lib/supabase/queries'
import { AuthorDashboardClient } from './AuthorDashboardClient'

export async function AuthorDashboard() {
  const supabase = await createClient()
  const [documents, rubrics] = await Promise.all([
    getMyDocumentsWithStats(supabase),
    getRubrics(supabase),
  ])

  return <AuthorDashboardClient documents={documents} rubrics={rubrics} />
}
