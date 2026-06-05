// app/reviewer/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSignedUrl } from '@/lib/supabase/queries'
import { ReviewerApp, type Review } from './components/ReviewerApp'

export default async function ReviewerPage({
  searchParams,
}: {
  searchParams: Promise<{ document?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { document: documentId } = await searchParams

  // Load the requested document, or fall back to the first one
  const docQuery = supabase
    .from('documents')
    .select('id, title, file_url, storage_path')

  const { data: docRow } = documentId
    ? await docQuery.eq('id', documentId).maybeSingle()
    : await docQuery.order('created_at', { ascending: true }).limit(1).maybeSingle()

  // Regenerate signed URL on every page load (stored URL is only valid 1 hour)
  const document = docRow
    ? { ...docRow, file_url: await getSignedUrl(supabase, docRow.storage_path) }
    : null

  // If a specific document was requested, load only its assigned rubrics.
  // Fall back to all preset rubrics if none are assigned.
  let rubricsRaw: { id: string; title: string; description: string | null; operational_definition: string | null; rubric_items: { id: string }[] }[] = []

  if (document) {
    if (documentId) {
      const { data: docRubrics } = await supabase
        .from('document_rubrics')
        .select('rubric:rubrics ( id, title, description, operational_definition, rubric_items(id) )')
        .eq('document_id', document.id)

      const assigned = (docRubrics ?? [])
        .map(r => r.rubric)
        .filter(Boolean) as typeof rubricsRaw

      if (assigned.length > 0) {
        rubricsRaw = assigned
      }
    }

    if (rubricsRaw.length === 0) {
      const { data } = await supabase
        .from('rubrics')
        .select('id, title, description, operational_definition, rubric_items(id)')
        .eq('is_preset', true)
        .order('title')
      rubricsRaw = data ?? []
    }
  }

  const rubrics = rubricsRaw.map(({ rubric_items, ...r }) => ({
    ...r,
    criteria_count: Array.isArray(rubric_items) ? rubric_items.length : 0,
  }))

  // Existing in-progress review by this reviewer on this document
  const { data: existingReview } = document
    ? await supabase
        .from('reviews')
        .select(`
          id, status, overall_comment, notes, last_saved_at,
          rubric_id,
          rubric:rubrics ( id, title, description, operational_definition ),
          review_scores ( id, rubric_item_id, score, comment ),
          annotations ( id, rubric_item_id, anchor, body, tag )
        `)
        .eq('document_id', document.id)
        .eq('reviewer_id', user.id)
        .in('status', ['in_progress', 'submitted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  return (
    <ReviewerApp
      userId={user.id}
      document={document ?? null}
      rubrics={rubrics}
      existingReview={existingReview as Review | null}
    />
  )
}
