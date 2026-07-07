// Fetches review data from Supabase for use by shortcut functions.
// Accepts a browser Supabase client — never imports React.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CriterionWithScore, ReviewerData, FeedbackData } from './types'
import { resolveRubricSlug } from '../rubric-data/rubricNameMap'

// ── Reviewer console (/review?document=<id>) ──────────────────────────────────

export async function loadReviewerData(
  supabase: SupabaseClient,
  documentId: string,
): Promise<ReviewerData | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 1. Find the reviewer's active review for this document
  const { data: review } = await supabase
    .from('reviews')
    .select('id, rubric_id')
    .eq('document_id', documentId)
    .eq('reviewer_id', user.id)
    .in('status', ['assigned', 'in_progress', 'submitted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!review) return null

  // 2. Rubric title, to resolve which static rubric-data content applies
  const { data: rubric } = await supabase
    .from('rubrics')
    .select('title')
    .eq('id', review.rubric_id)
    .maybeSingle()
  const rubricSlug = rubric ? resolveRubricSlug(rubric.title) : null

  // 3. Rubric items for this review's rubric
  const { data: items } = await supabase
    .from('rubric_items')
    .select('id, label, description, sort_order')
    .eq('rubric_id', review.rubric_id)
    .order('sort_order')

  if (!items) return null

  // 3. Review scores (criterion_scores array + per-criterion comment)
  const { data: scores } = await supabase
    .from('review_scores')
    .select('rubric_item_id, criterion_scores, comment')
    .eq('review_id', review.id)

  // 4. Score comments (NI / Exceeds polarity comments)
  const { data: scoreComments } = await supabase
    .from('score_comments')
    .select('id, rubric_item_id, score_level, body')
    .eq('review_id', review.id)

  // 5. Annotations linked to this review
  const { data: annotations } = await supabase
    .from('annotations')
    .select('id, rubric_item_id, body, tag')
    .eq('review_id', review.id)

  const scoresMap = Object.fromEntries(
    (scores ?? []).map(s => [s.rubric_item_id, s.criterion_scores as string[]])
  )

  const criteria: CriterionWithScore[] = items.map(item => ({
    criterion: { id: item.id, label: item.label, description: item.description ?? '', rubricSlug },
    scores: (scoresMap[item.id] ?? []) as CriterionWithScore['scores'],
    scoreComments: (scoreComments ?? [])
      .filter(sc => sc.rubric_item_id === item.id)
      .map(sc => ({
        id: sc.id,
        rubric_item_id: sc.rubric_item_id,
        score_level: sc.score_level as 'does_not_meet' | 'exceeds',
        body: sc.body,
      })),
    annotations: (annotations ?? [])
      .filter(a => a.rubric_item_id === item.id)
      .map(a => ({
        id: a.id,
        body: a.body,
        tag: a.tag as 'action_item' | 'quick_fix' | null,
        rubric_item_id: a.rubric_item_id,
      })),
  }))

  return { reviewId: review.id, documentId, rubricSlug, criteria }
}

// ── Feedback view (/author/feedback/<documentId>) ─────────────────────────────

export async function loadFeedbackData(
  supabase: SupabaseClient,
  documentId: string,
): Promise<FeedbackData | null> {
  // Load all submitted reviews for this document
  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      id,
      review_scores ( rubric_item_id, criterion_scores ),
      score_comments ( id, rubric_item_id, score_level, body ),
      annotations ( id, rubric_item_id, body, tag )
    `)
    .eq('document_id', documentId)
    .eq('status', 'submitted')

  if (!reviews || reviews.length === 0) return null

  // Gather all rubric_item_ids to fetch labels
  const itemIds = [
    ...new Set(
      reviews.flatMap(r =>
        (r.review_scores ?? []).map((rs: { rubric_item_id: string }) => rs.rubric_item_id).filter(Boolean)
      )
    ),
  ]

  const { data: items } = await supabase
    .from('rubric_items')
    .select('id, label, description, sort_order, rubric_id')
    .in('id', itemIds)
    .order('sort_order')

  if (!items) return null

  // Each item's rubric may differ across a document's multiple assigned
  // rubrics — resolve slug per rubric_id, not once for the whole document.
  const rubricIds = [...new Set(items.map(i => i.rubric_id))]
  const { data: rubrics } = await supabase
    .from('rubrics')
    .select('id, title')
    .in('id', rubricIds)
  const rubricSlugById = new Map(
    (rubrics ?? []).map(r => [r.id, resolveRubricSlug(r.title)]),
  )

  // Merge across all reviews per criterion (union of scores, comments, annotations)
  const criteriaMap = new Map<string, CriterionWithScore>()

  for (const item of items) {
    const criterionScores = new Set<CriterionWithScore['scores'][number]>()
    const scoreComments: CriterionWithScore['scoreComments'] = []
    const annotations: CriterionWithScore['annotations'] = []

    for (const review of reviews) {
      const rs = (review.review_scores ?? []).find((s: { rubric_item_id: string }) => s.rubric_item_id === item.id)
      if (rs) {
        for (const s of (rs.criterion_scores ?? []) as string[]) {
          criterionScores.add(s as CriterionWithScore['scores'][number])
        }
      }
      for (const sc of (review.score_comments ?? []).filter((sc: { rubric_item_id: string }) => sc.rubric_item_id === item.id)) {
        scoreComments.push({
          id: (sc as { id: string }).id,
          rubric_item_id: item.id,
          score_level: (sc as { score_level: string }).score_level as 'does_not_meet' | 'exceeds',
          body: (sc as { body: string }).body,
        })
      }
      for (const a of (review.annotations ?? []).filter((a: { rubric_item_id: string | null }) => a.rubric_item_id === item.id)) {
        annotations.push({
          id: (a as { id: string }).id,
          body: (a as { body: string }).body,
          tag: (a as { tag: string | null }).tag as 'action_item' | 'quick_fix' | null,
          rubric_item_id: item.id,
        })
      }
    }

    criteriaMap.set(item.id, {
      criterion: {
        id: item.id,
        label: item.label,
        description: item.description ?? '',
        rubricSlug: rubricSlugById.get(item.rubric_id) ?? null,
      },
      scores: [...criterionScores],
      scoreComments,
      annotations,
    })
  }

  return { documentId, criteria: [...criteriaMap.values()] }
}
