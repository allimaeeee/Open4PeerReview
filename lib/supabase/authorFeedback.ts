// lib/supabase/authorFeedback.ts
// Author-side writes for the feedback report: per-item "addressed" / "will address
// later" flags and free-form revision notes. Client-only (uses the browser client).
// RLS restricts every row to the document author, so these are safe to call directly.

'use client'

import { createClient } from '@/lib/supabase/client'
import type { FeedbackResponseStatus, FeedbackTargetType, ReportStatus } from '@/types'

export interface FeedbackResponseRow {
  id: string
  target_type: FeedbackTargetType
  target_id: string
  status: FeedbackResponseStatus
  review_id: string
}

export interface RevisionNoteRow {
  id: string
  body: string
  review_id: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackCommentRow {
  id: string
  target_type: FeedbackTargetType
  target_id: string
  body: string
  review_id: string
}

/** Set (or change) the author's status on a single feedback item. Upserts on (target_type, target_id). */
export async function setFeedbackResponse(params: {
  documentId: string
  reviewId: string
  targetType: FeedbackTargetType
  targetId: string
  status: FeedbackResponseStatus
}): Promise<FeedbackResponseRow> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('author_feedback_responses')
    .upsert(
      {
        document_id: params.documentId,
        review_id: params.reviewId,
        target_type: params.targetType,
        target_id: params.targetId,
        status: params.status,
        author_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'target_type,target_id' }
    )
    .select('id, target_type, target_id, status, review_id')
    .single()

  if (error) throw error
  return data as FeedbackResponseRow
}

/** Remove the author's status on a feedback item (toggle back to "none"). */
export async function clearFeedbackResponse(params: {
  targetType: FeedbackTargetType
  targetId: string
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('author_feedback_responses')
    .delete()
    .eq('target_type', params.targetType)
    .eq('target_id', params.targetId)

  if (error) throw error
}

/**
 * Set (or update) the author's free-text comment on a single feedback item
 * (an annotation or a rubric criterion). Author-private. Upserts on
 * (target_type, target_id), so re-saving replaces the existing comment.
 */
export async function setFeedbackComment(params: {
  documentId: string
  reviewId: string
  targetType: FeedbackTargetType
  targetId: string
  body: string
}): Promise<FeedbackCommentRow> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('author_feedback_comments')
    .upsert(
      {
        document_id: params.documentId,
        review_id: params.reviewId,
        target_type: params.targetType,
        target_id: params.targetId,
        body: params.body,
        author_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'target_type,target_id' }
    )
    .select('id, target_type, target_id, body, review_id')
    .single()

  if (error) throw error
  return data as FeedbackCommentRow
}

/** Remove the author's comment on a feedback item (e.g. when cleared to empty). */
export async function clearFeedbackComment(params: {
  targetType: FeedbackTargetType
  targetId: string
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('author_feedback_comments')
    .delete()
    .eq('target_type', params.targetType)
    .eq('target_id', params.targetId)

  if (error) throw error
}

/** Append a new revision note to a submission. */
export async function addRevisionNote(params: {
  documentId: string
  reviewId?: string | null
  body: string
}): Promise<RevisionNoteRow> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('revision_notes')
    .insert({
      document_id: params.documentId,
      review_id: params.reviewId ?? null,
      body: params.body,
      author_id: user.id,
    })
    .select('id, body, review_id, created_at, updated_at')
    .single()

  if (error) throw error
  return data as RevisionNoteRow
}

/** Edit an existing revision note's body. */
export async function updateRevisionNote(params: {
  id: string
  body: string
}): Promise<RevisionNoteRow> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('revision_notes')
    .update({ body: params.body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, body, review_id, created_at, updated_at')
    .single()

  if (error) throw error
  return data as RevisionNoteRow
}

/** Delete a revision note. */
export async function deleteRevisionNote(params: { id: string }): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('revision_notes')
    .delete()
    .eq('id', params.id)

  if (error) throw error
}

/**
 * Set the author's decision on the released review report:
 *  - 'published' — publicly accessible (Adopter surface pending)
 *  - 'private'   — kept private (Completed Submissions tab)
 *  - 'revising'  — author is addressing feedback before deciding
 *  - null        — clear the decision (back to awaiting)
 * RLS restricts documents UPDATE to the document author, so this is author-only.
 */
export async function setReportStatus(params: {
  documentId: string
  status: ReportStatus | null
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('documents')
    .update({ report_status: params.status })
    .eq('id', params.documentId)

  if (error) throw error
}

/**
 * Store the author's link to the revised OER, submitted during the revision flow.
 * Pass null (or empty) to clear it. Author-only via documents RLS.
 */
export async function setRevisedLink(params: {
  documentId: string
  link: string | null
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('documents')
    .update({ revised_link: params.link || null })
    .eq('id', params.documentId)

  if (error) throw error
}
