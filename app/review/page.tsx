// app/reviewer/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReviewerApp } from './components/ReviewerApp'

export default async function ReviewerPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Demo document — first document in the system
  const { data: document } = await supabase
    .from('documents')
    .select('id, title, file_url, storage_path')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Preset rubrics for the picker — include criteria count for display
  const { data: rubricsRaw } = await supabase
    .from('rubrics')
    .select('id, title, description, operational_definition, rubric_items(id)')
    .eq('is_preset', true)
    .order('title')

  const rubrics = (rubricsRaw ?? []).map((row) => {
    const { rubric_items, ...r } = row
    return { ...r, criteria_count: Array.isArray(rubric_items) ? rubric_items.length : 0 }
  })

  // Existing in-progress review by this reviewer on this document
  const { data: existingReview } = document
    ? await supabase
        .from('reviews')
        .select(`
          id, status, overall_comment, last_saved_at,
          rubric_id,
          rubric:rubrics ( id, title, description ),
          review_scores (
            id, rubric_item_id, score, comment,
            annotations ( id, anchor, body )
          )
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
      existingReview={existingReview ?? null}
    />
  )
}
