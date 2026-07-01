// app/reviewer/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSignedUrl } from '@/lib/supabase/queries'
import { ReviewerApp, type Review, type OERPage } from './components/ReviewerApp'

export default async function ReviewerPage({
  searchParams,
}: {
  searchParams: Promise<{ document?: string; review?: string }>
}) {
  const supabase = await createClient()
  const { document: documentId, review: reviewId } = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const params = new URLSearchParams()
    if (documentId) params.set('document', documentId)
    if (reviewId) params.set('review', reviewId)
    const next = params.size > 0 ? `/review?${params.toString()}` : '/review'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  // Load the requested document, or fall back to the first one
  const docQuery = supabase
    .from('documents')
    .select('id, title, file_url, storage_path, file_type, platform, source_url, course_access_code, content_fingerprint, pages')

  const { data: docRow } = documentId
    ? await docQuery.eq('id', documentId).maybeSingle()
    : await docQuery.order('created_at', { ascending: true }).limit(1).maybeSingle()

  // For PDFs regenerate the signed URL; HTML snapshots are served through the proxy route
  const document = docRow
    ? {
        ...docRow,
        file_url: docRow.file_type === 'html'
          ? docRow.file_url
          : docRow.storage_path
            ? await getSignedUrl(supabase, docRow.storage_path)
            : null,
        pages: Array.isArray(docRow.pages)
          ? (docRow.pages as unknown[]).flatMap((p): OERPage[] => {
              if (typeof p === 'string') return [{ url: p, fingerprint: null }]
              if (p && typeof (p as Record<string, unknown>).url === 'string') return [p as OERPage]
              return []
            })
          : null,
      }
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

  const reviewSelect = `
    id, status, overall_comment, notes, last_saved_at,
    rubric_id,
    rubric:rubrics ( id, title, description, operational_definition ),
    review_scores ( id, rubric_item_id, score, criterion_scores, comment ),
    annotations ( id, rubric_item_id, anchor, body, tag ),
    score_comments ( id, rubric_item_id, score_level, body )
  `

  // When the extension's Console button is used it passes ?review=<id> so we load
  // that specific review directly — no rubric filter needed.  Fallback: rubric-filtered
  // query for direct browser access (rubric_id filter prevents loading a review whose
  // rubric no longer matches the document's assignment and would cause submit errors).
  const rubricIds = rubricsRaw.map(r => r.id)
  const { data: existingReview } = document
    ? reviewId
      ? await supabase
          .from('reviews')
          .select(reviewSelect)
          .eq('id', reviewId)
          .eq('reviewer_id', user.id)
          .maybeSingle()
      : rubricIds.length > 0
        ? await supabase
            .from('reviews')
            .select(reviewSelect)
            .eq('document_id', document.id)
            .eq('reviewer_id', user.id)
            .in('rubric_id', rubricIds)
            .in('status', ['assigned', 'in_progress', 'submitted'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null }
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
