'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createDocumentAssignments, assignRubrics, updateDocumentContent } from '@/lib/supabase/queries'

export async function releaseDocument(documentId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify the coordinator shares the same institution as the document's author
  const { data: coordProfile } = await supabase
    .from('users')
    .select('institution, roles')
    .eq('id', user.id)
    .single()

  if (!coordProfile?.roles?.includes('coordinator')) throw new Error('Not authorized')

  const { data: doc } = await supabase
    .from('documents')
    .select('author:users!author_id ( institution )')
    .eq('id', documentId)
    .single()

  const authorInstitution = (doc?.author as { institution: string | null } | null)?.institution
  if (!authorInstitution || authorInstitution !== coordProfile.institution) {
    throw new Error('Document does not belong to your organization')
  }

  const { error } = await supabase
    .from('documents')
    .update({ coordinator_released_at: new Date().toISOString() })
    .eq('id', documentId)

  if (error) throw error
  revalidatePath('/coordinator')
}

/** Coordinator publishes a draft document and optionally assigns specific reviewers */
export async function saveReviewerAssignments(documentId: string, reviewerIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('institution, roles')
    .eq('id', user.id)
    .single()

  if (!profile?.roles?.includes('coordinator')) throw new Error('Not authorized')

  const { data: doc } = await supabase
    .from('documents')
    .select('id, author_id')
    .eq('id', documentId)
    .single()

  if (!doc || doc.author_id !== user.id) throw new Error('Not authorized to publish this document')

  const { error: updateError } = await supabase
    .from('documents')
    .update({ is_draft: false, coordinator_released_at: new Date().toISOString() })
    .eq('id', documentId)

  if (updateError) throw updateError

  await createDocumentAssignments(supabase, documentId, reviewerIds, user.id)

  revalidatePath('/coordinator')
}

/** Author or coordinator deletes a draft document */
export async function deleteDraft(documentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: doc } = await supabase
    .from('documents')
    .select('author_id, storage_path, file_type, is_draft')
    .eq('id', documentId)
    .single()

  if (!doc || doc.author_id !== user.id) throw new Error('Not authorized')
  if (!doc.is_draft) throw new Error('Only drafts can be deleted')

  // Delete PDF from storage (PDFs are unique per document)
  if (doc.storage_path && doc.file_type === 'pdf') {
    await supabase.storage.from('documents').remove([doc.storage_path])
  }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (error) throw error
  revalidatePath('/coordinator')
  revalidatePath('/author')
}

/** Author deletes any document they own (draft or submitted), cascading to reviews */
export async function deleteDocument(documentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: doc } = await supabase
    .from('documents')
    .select('author_id, storage_path, file_type')
    .eq('id', documentId)
    .single()

  if (!doc || doc.author_id !== user.id) throw new Error('Not authorized')

  // Block deletion once any reviewer has started or submitted a review
  const { count } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .in('status', ['in_progress', 'submitted'])

  if (count && count > 0) throw new Error('Cannot delete a submission that is under review or has been reviewed.')

  if (doc.storage_path && doc.file_type === 'pdf') {
    await supabase.storage.from('documents').remove([doc.storage_path])
  }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (error) throw error
  revalidatePath('/author')
}

/** Author or coordinator adds/replaces the PDF content on a draft document */
export async function updateDraftPdf(
  documentId: string,
  content: { storagePath: string; fileUrl: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: doc } = await supabase
    .from('documents')
    .select('author_id, is_draft')
    .eq('id', documentId)
    .single()

  if (!doc || doc.author_id !== user.id) throw new Error('Not authorized')
  if (!doc.is_draft) throw new Error('Only drafts can be updated')

  await updateDocumentContent(supabase, documentId, {
    fileType: 'pdf',
    fileUrl: content.fileUrl,
    storagePath: content.storagePath,
    sourceUrl: null,
    contentFingerprint: null,
    platform: null,
  })
  revalidatePath('/coordinator')
}

/** Author or coordinator updates the metadata of a draft document */
export async function updateDraft(
  documentId: string,
  data: {
    title: string
    authors: string
    subjectMatter: string
    creativeCommonsLicense: string
    thirdPartyContentDisclosure: string | null
    submissionScope: string[]
    rubricIds: string[]
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: doc } = await supabase
    .from('documents')
    .select('author_id, is_draft')
    .eq('id', documentId)
    .single()

  if (!doc || doc.author_id !== user.id) throw new Error('Not authorized')
  if (!doc.is_draft) throw new Error('Only drafts can be edited')

  const { error } = await supabase
    .from('documents')
    .update({
      title: data.title,
      authors: data.authors,
      subject_matter: data.subjectMatter,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      creative_commons_license: data.creativeCommonsLicense as any,
      third_party_content_disclosure: data.thirdPartyContentDisclosure,
      submission_scope: data.submissionScope,
    })
    .eq('id', documentId)

  if (error) throw error
  await assignRubrics(supabase, documentId, data.rubricIds)
  revalidatePath('/coordinator')
}

/** Author submits a saved draft for review */
export async function submitDraft(documentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: doc } = await supabase
    .from('documents')
    .select('author_id')
    .eq('id', documentId)
    .single()

  if (!doc || doc.author_id !== user.id) throw new Error('Not authorized')

  const { error } = await supabase
    .from('documents')
    .update({ is_draft: false })
    .eq('id', documentId)

  if (error) throw error
  revalidatePath('/coordinator')
  revalidatePath('/author')
}

/** Coordinator assigns reviewers to an author-submitted org doc and releases it */
export async function assignAndReleaseDocument(documentId: string, reviewerIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('institution, roles')
    .eq('id', user.id)
    .single()

  if (!profile?.roles?.includes('coordinator')) throw new Error('Not authorized')

  const { data: doc } = await supabase
    .from('documents')
    .select('author:users!author_id ( institution )')
    .eq('id', documentId)
    .single()

  const authorInstitution = (doc?.author as { institution: string | null } | null)?.institution
  if (!authorInstitution || authorInstitution !== profile.institution) {
    throw new Error('Document does not belong to your organization')
  }

  if (reviewerIds.length > 0) {
    await createDocumentAssignments(supabase, documentId, reviewerIds, user.id)
  }

  const { error } = await supabase
    .from('documents')
    .update({ coordinator_released_at: new Date().toISOString() })
    .eq('id', documentId)

  if (error) throw error
  revalidatePath('/coordinator')
}

/** Reviewer accepts a document — creates an in_progress review and moves it to My Reviews */
export async function acceptDocument(documentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Resolve rubrics: every rubric assigned to the document gets its own review row,
  // falling back to the preset rubric if none are assigned (mirrors ReviewerApp logic)
  const { data: docRubrics } = await supabase
    .from('document_rubrics')
    .select('rubric_id')
    .eq('document_id', documentId)

  let rubricIds = (docRubrics ?? []).map(r => r.rubric_id)

  if (rubricIds.length === 0) {
    const { data: presets } = await supabase
      .from('rubrics')
      .select('id')
      .eq('is_preset', true)
      .order('title')
      .limit(1)
    if (presets?.[0]) rubricIds = [presets[0].id]
  }

  if (rubricIds.length === 0) throw new Error('No rubric available for this document')

  // Ignore duplicates — reviewer already has a review for that rubric (e.g., opened the console first)
  const { error } = await supabase
    .from('reviews')
    .upsert(
      rubricIds.map(rubricId => ({
        document_id: documentId,
        reviewer_id: user.id,
        rubric_id: rubricId,
        status: 'in_progress' as const,
      })),
      { onConflict: 'document_id,rubric_id,reviewer_id', ignoreDuplicates: true }
    )

  if (error) throw error

  // Promote coordinator-pre-created 'assigned' rows to 'in_progress' — the upsert above
  // ignores them, and the dashboard only surfaces in_progress reviews under My Reviews
  const { error: promoteError } = await supabase
    .from('reviews')
    .update({ status: 'in_progress' })
    .eq('document_id', documentId)
    .eq('reviewer_id', user.id)
    .eq('status', 'assigned')

  if (promoteError) throw promoteError

  await supabase
    .from('document_acceptances')
    .upsert({ document_id: documentId, reviewer_id: user.id }, { onConflict: 'document_id,reviewer_id' })
  revalidatePath('/reviewer')
}

/** Reviewer declines a document — removes it from their pool and notifies the coordinator if assigned */
export async function declineDocument(documentId: string, note: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Record the decline to hide this doc from the reviewer's pool
  const { error: declineError } = await supabase
    .from('review_declines')
    .upsert({ document_id: documentId, reviewer_id: user.id, note }, { onConflict: 'document_id,reviewer_id' })
  if (declineError) throw declineError

  // If coordinator-assigned: stamp the assignment with the decline note
  const { data: assignment } = await supabase
    .from('document_assignments')
    .select('id')
    .eq('document_id', documentId)
    .eq('reviewer_id', user.id)
    .maybeSingle()

  if (assignment) {
    await supabase
      .from('document_assignments')
      .update({ decline_note: note, declined_at: new Date().toISOString() })
      .eq('id', assignment.id)

    // Delete the pre-created assigned review row so it doesn't linger
    await supabase
      .from('reviews')
      .delete()
      .eq('document_id', documentId)
      .eq('reviewer_id', user.id)
      .eq('status', 'assigned')

    // If all assigned reviewers have now declined, return the doc to pending release
    const { count } = await supabase
      .from('document_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .is('declined_at', null)

    if (count === 0) {
      await supabase
        .from('documents')
        .update({ coordinator_released_at: null })
        .eq('id', documentId)
    }
  }

  revalidatePath('/reviewer')
  revalidatePath('/coordinator')
}

/** Author or coordinator saves draft metadata and submits for review in one step */
export async function updateAndSubmitDraft(
  documentId: string,
  data: {
    title: string
    authors: string
    subjectMatter: string
    creativeCommonsLicense: string
    thirdPartyContentDisclosure: string | null
    submissionScope: string[]
    rubricIds: string[]
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: doc } = await supabase
    .from('documents')
    .select('author_id, is_draft, file_type')
    .eq('id', documentId)
    .single()

  if (!doc || doc.author_id !== user.id) throw new Error('Not authorized')
  if (!doc.is_draft) throw new Error('Only drafts can be submitted')
  if (!doc.file_type) throw new Error('Please add a PDF or OER URL before submitting for review.')

  const { error } = await supabase
    .from('documents')
    .update({
      title: data.title,
      authors: data.authors,
      subject_matter: data.subjectMatter,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      creative_commons_license: data.creativeCommonsLicense as any,
      third_party_content_disclosure: data.thirdPartyContentDisclosure,
      submission_scope: data.submissionScope,
      is_draft: false,
    })
    .eq('id', documentId)

  if (error) throw error
  await assignRubrics(supabase, documentId, data.rubricIds)
  revalidatePath('/coordinator')
}

// ── Review approval (org submissions) ─────────────────────────────────────────
// After a reviewer submits, an org submission is held for coordinator approval
// before the author can see it. The coordinator either approves it (releases it
// to the author) or sends it back to the reviewer with a note.

type CoordSupabase = Awaited<ReturnType<typeof createClient>>

/**
 * Verify the current user is a coordinator whose institution matches the review's
 * document author, and return the review's document id. Mirrors releaseDocument's
 * institution check; RLS enforces the same rule as a second line of defense.
 */
async function assertCoordinatorForReview(
  supabase: CoordSupabase,
  userId: string,
  reviewId: string
): Promise<string> {
  const { data: coord } = await supabase
    .from('users')
    .select('institution, roles')
    .eq('id', userId)
    .single()

  if (!coord?.roles?.includes('coordinator')) throw new Error('Not authorized')

  const { data: review } = await supabase
    .from('reviews')
    .select('document_id, document:documents!document_id ( author:users!author_id ( institution ) )')
    .eq('id', reviewId)
    .single()

  if (!review) throw new Error('Review not found')

  const authorInstitution = (
    (review.document as { author: { institution: string | null } | null } | null)?.author
  )?.institution

  if (!coord.institution || !authorInstitution || authorInstitution !== coord.institution) {
    throw new Error('Review does not belong to your organization')
  }

  return review.document_id
}

/** Coordinator approves a submitted review — releases it to the document author. */
export async function approveReview(reviewId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const documentId = await assertCoordinatorForReview(supabase, user.id, reviewId)

  const { error } = await supabase
    .from('reviews')
    .update({
      coordinator_approval: 'approved',
      coordinator_note: null,
      coordinator_decided_at: new Date().toISOString(),
    })
    .eq('id', reviewId)

  if (error) throw error

  revalidatePath('/coordinator')
  revalidatePath(`/author/feedback/${documentId}`)
}

/**
 * Coordinator sends a submitted review back to the reviewer with a required note.
 * Fully re-opens the review: status → in_progress (restores the reviewer's write
 * access) and the per-rubric release rows are deleted so the author can't see it
 * and the reviewer can edit and re-submit.
 */
export async function returnReviewToReviewer(reviewId: string, note: string) {
  const trimmed = (note ?? '').trim()
  if (!trimmed) throw new Error('A note explaining the requested changes is required')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const documentId = await assertCoordinatorForReview(supabase, user.id, reviewId)

  const { error: updateError } = await supabase
    .from('reviews')
    .update({
      status: 'in_progress',
      coordinator_approval: 'changes_requested',
      coordinator_note: trimmed,
      coordinator_decided_at: new Date().toISOString(),
      submitted_at: null,
    })
    .eq('id', reviewId)

  if (updateError) throw updateError

  const { error: deleteError } = await supabase
    .from('review_rubric_submissions')
    .delete()
    .eq('review_id', reviewId)

  if (deleteError) throw deleteError

  revalidatePath('/coordinator')
  revalidatePath('/reviewer')
  revalidatePath(`/author/feedback/${documentId}`)
}
