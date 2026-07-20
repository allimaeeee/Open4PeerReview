// lib/supabase/queries.ts
// Typed query helpers — import these in Server Components and Route Handlers
// All functions accept a Supabase server client as the first argument.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { FileType, RubricWithItems, CreativeCommonsLicense } from '@/types'

type Client = SupabaseClient<Database>


// ── RUBRICS ───────────────────────────────────────────────────

/** Fetch all rubrics (without items) */
export async function getRubrics(supabase: Client) {
  const { data, error } = await supabase
    .from('rubrics')
    .select('*')
    .order('title')

  if (error) throw error
  return data
}

/** Fetch a single rubric with its items, ordered by sort_order */
export async function getRubricWithItems(
  supabase: Client,
  rubricId: string
): Promise<RubricWithItems> {
  const { data, error } = await supabase
    .from('rubrics')
    .select('*, rubric_items(*)')
    .eq('id', rubricId)
    .order('sort_order', { referencedTable: 'rubric_items' })
    .single()

  if (error) throw error
  return data as RubricWithItems
}


// ── DOCUMENTS ─────────────────────────────────────────────────

/** Fetch all documents authored by the current user */
export async function getMyDocuments(supabase: Client) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

/** Fetch a single document with its assigned rubrics (and rubric items) */
export async function getDocumentWithRubrics(supabase: Client, documentId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select(`
      *,
      document_rubrics (
        rubric_id,
        rubrics (
          *,
          rubric_items ( * )
        )
      )
    `)
    .eq('id', documentId)
    .order('sort_order', { referencedTable: 'rubric_items' })
    .single()

  if (error) throw error
  return data
}

/** Upload a file to Supabase Storage and insert a document row */
export async function uploadDocument(
  supabase: Client,
  file: File,
  title: string,
  fileType: FileType,
  authors: string,
  subjectMatter: string,
  creativeCommonsLicense: CreativeCommonsLicense,
  thirdPartyContentDisclosure: string | null,
  submissionScope: string[] = ['public'],
  isDraft = false,
  coordinatorUpload = false,
  publicReview = false,
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Upload file to Storage
  const ext = file.name.split('.').pop()
  const storagePath = `${user.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { upsert: false })

  if (uploadError) throw uploadError

  // 2. Get a signed URL (valid 1 hour — regenerate on each read in production)
  const { data: signedUrl, error: urlError } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 60)

  if (urlError || !signedUrl) throw urlError

  // 3. Insert document row
  const { data, error } = await supabase
    .from('documents')
    .insert({
      author_id: user.id,
      title,
      file_url: signedUrl.signedUrl,
      storage_path: storagePath,
      file_type: fileType,
      authors,
      subject_matter: subjectMatter,
      creative_commons_license: creativeCommonsLicense,
      third_party_content_disclosure: thirdPartyContentDisclosure || null,
      submission_scope: submissionScope,
      is_draft: isDraft,
      coordinator_upload: coordinatorUpload,
      public_review: publicReview,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Insert a document row for a snapshotted OER URL */
export async function submitOpenStaxLink(
  supabase: Client,
  opts: {
    url: string
    storagePath: string
    fingerprint: string
    title: string
    authors: string
    subjectMatter: string
    ccLicense: CreativeCommonsLicense
    thirdPartyDisclosure: string | null
    rubricIds: string[]
    platform: string
    submissionScope: string[]
    isDraft?: boolean
    coordinatorUpload?: boolean
    publicReview?: boolean
    additionalPages?: Array<{ url: string; fingerprint: string; storagePath: string }>
  }
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('documents')
    .insert({
      author_id: user.id,
      title: opts.title,
      file_url: opts.url,
      storage_path: opts.storagePath,
      file_type: 'html',
      authors: opts.authors,
      subject_matter: opts.subjectMatter,
      creative_commons_license: opts.ccLicense,
      third_party_content_disclosure: opts.thirdPartyDisclosure,
      source_url: opts.url,
      content_fingerprint: opts.fingerprint,
      platform: opts.platform,
      submission_scope: opts.submissionScope,
      is_draft: opts.isDraft ?? false,
      coordinator_upload: opts.coordinatorUpload ?? false,
      public_review: opts.publicReview ?? false,
      pages: opts.additionalPages?.length ? (opts.additionalPages as import('@/types/database.types').Json) : null,
    })
    .select()
    .single()

  if (error) throw error

  if (opts.rubricIds.length > 0) {
    await assignRubrics(supabase, data.id, opts.rubricIds)
  }

  return data
}

/** Update content fields on an existing draft (used when adding/replacing PDF or URL) */
export async function updateDocumentContent(
  supabase: Client,
  documentId: string,
  content: {
    fileType: FileType
    fileUrl: string
    storagePath: string
    sourceUrl?: string | null
    contentFingerprint?: string | null
    platform?: string | null
  }
) {
  const { error } = await supabase
    .from('documents')
    .update({
      file_type: content.fileType,
      file_url: content.fileUrl,
      storage_path: content.storagePath,
      source_url: content.sourceUrl ?? null,
      content_fingerprint: content.contentFingerprint ?? null,
      platform: content.platform ?? null,
    })
    .eq('id', documentId)

  if (error) throw error
}

/** Assign rubrics to a document (replaces existing assignments) */
export async function assignRubrics(
  supabase: Client,
  documentId: string,
  rubricIds: string[]
) {
  // Remove existing assignments first
  await supabase
    .from('document_rubrics')
    .delete()
    .eq('document_id', documentId)

  if (rubricIds.length === 0) return

  const { error } = await supabase
    .from('document_rubrics')
    .insert(rubricIds.map(rubricId => ({ document_id: documentId, rubric_id: rubricId })))

  if (error) throw error
}

/** Insert a document row for an OLI Torus course link */
export async function submitTorusLink(
  supabase: Client,
  opts: {
    url: string
    title: string
    authors: string
    subjectMatter: string
    ccLicense: CreativeCommonsLicense
    thirdPartyDisclosure: string | null
    courseAccessCode: string | null
    rubricIds: string[]
    submissionScope: string[]
    isDraft?: boolean
    coordinatorUpload?: boolean
    publicReview?: boolean
  }
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('documents')
    .insert({
      author_id: user.id,
      title: opts.title,
      file_url: opts.url,
      file_type: 'html',
      authors: opts.authors,
      subject_matter: opts.subjectMatter,
      creative_commons_license: opts.ccLicense,
      third_party_content_disclosure: opts.thirdPartyDisclosure,
      source_url: opts.url,
      platform: 'OLI Torus',
      course_access_code: opts.courseAccessCode,
      submission_scope: opts.submissionScope,
      is_draft: opts.isDraft ?? false,
      coordinator_upload: opts.coordinatorUpload ?? false,
      public_review: opts.publicReview ?? false,
    })
    .select()
    .single()

  if (error) throw error

  if (opts.rubricIds.length > 0) {
    await assignRubrics(supabase, data.id, opts.rubricIds)
  }

  return data
}

/** Save a metadata-only draft with no content source yet */
export async function saveDraftDocument(
  supabase: Client,
  opts: {
    title: string
    authors: string
    subjectMatter: string
    creativeCommonsLicense: CreativeCommonsLicense
    thirdPartyContentDisclosure: string | null
    submissionScope: string[]
    coordinatorUpload?: boolean
  }
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('documents')
    .insert({
      author_id: user.id,
      title: opts.title,
      authors: opts.authors,
      subject_matter: opts.subjectMatter,
      creative_commons_license: opts.creativeCommonsLicense,
      third_party_content_disclosure: opts.thirdPartyContentDisclosure,
      submission_scope: opts.submissionScope,
      is_draft: true,
      coordinator_upload: opts.coordinatorUpload ?? false,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Insert a PDF draft row (metadata only — skips file upload) */
export async function savePdfDraft(
  supabase: Client,
  opts: {
    title: string
    authors: string
    subjectMatter: string
    ccLicense: CreativeCommonsLicense
    thirdPartyDisclosure: string | null
    submissionScope: string[]
    publicReview: boolean
    rubricIds: string[]
  }
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('documents')
    .insert({
      author_id: user.id,
      title: opts.title,
      file_type: 'pdf',
      authors: opts.authors,
      subject_matter: opts.subjectMatter,
      creative_commons_license: opts.ccLicense,
      third_party_content_disclosure: opts.thirdPartyDisclosure,
      submission_scope: opts.submissionScope,
      is_draft: true,
      coordinator_upload: false,
      public_review: opts.publicReview,
    })
    .select()
    .single()

  if (error) throw error
  if (opts.rubricIds.length > 0) {
    await assignRubrics(supabase, data.id, opts.rubricIds)
  }
  return data
}

/** Update metadata fields on an existing draft without touching file/storage columns */
export async function updateDraftMetadata(
  supabase: Client,
  documentId: string,
  opts: {
    title: string
    authors: string
    subjectMatter: string
    ccLicense: string
    thirdPartyDisclosure: string | null
    submissionScope: string[]
    publicReview: boolean
    sourceUrl?: string | null
    courseAccessCode?: string | null
  }
) {
  const { error } = await supabase
    .from('documents')
    .update({
      title: opts.title,
      authors: opts.authors,
      subject_matter: opts.subjectMatter,
      creative_commons_license: opts.ccLicense as CreativeCommonsLicense,
      third_party_content_disclosure: opts.thirdPartyDisclosure,
      submission_scope: opts.submissionScope,
      public_review: opts.publicReview,
      ...(opts.sourceUrl !== undefined ? { source_url: opts.sourceUrl, file_url: opts.sourceUrl } : {}),
      ...(opts.courseAccessCode !== undefined ? { course_access_code: opts.courseAccessCode } : {}),
    })
    .eq('id', documentId)

  if (error) throw error
}

/** Assign specific reviewers to a document (upserts, ignores duplicates) */
export async function createDocumentAssignments(
  supabase: Client,
  documentId: string,
  reviewerIds: string[],
  assignedBy: string,
) {
  if (reviewerIds.length === 0) return

  const { error } = await supabase
    .from('document_assignments')
    .upsert(
      reviewerIds.map(reviewerId => ({
        document_id: documentId,
        reviewer_id: reviewerId,
        assigned_by: assignedBy,
      })),
      { onConflict: 'document_id,reviewer_id', ignoreDuplicates: true }
    )

  if (error) throw error

  // Every rubric assigned to the document gets its own review row per reviewer —
  // matches the reviews table's real uq_review constraint on (document_id, rubric_id, reviewer_id).
  const { data: docRubrics } = await supabase
    .from('document_rubrics')
    .select('rubric_id')
    .eq('document_id', documentId)

  let rubricIds = (docRubrics ?? []).map(r => r.rubric_id)

  if (rubricIds.length === 0) {
    const { data: presetRubric } = await supabase
      .from('rubrics')
      .select('id')
      .eq('is_preset', true)
      .limit(1)
      .single()
    if (presetRubric) rubricIds = [presetRubric.id]
  }

  if (rubricIds.length === 0) return

  // Pre-create review rows with status 'assigned' for each reviewer × rubric pair.
  // Ignore duplicates — reviewers who already have a review row keep their existing status
  await supabase
    .from('reviews')
    .upsert(
      reviewerIds.flatMap(reviewerId => rubricIds.map(rubricId => ({
        document_id: documentId,
        reviewer_id: reviewerId,
        rubric_id: rubricId,
        status: 'assigned' as const,
      }))),
      { onConflict: 'document_id,rubric_id,reviewer_id', ignoreDuplicates: true }
    )
}

/** Get a fresh signed URL for a document (call before serving to reviewer) */
export async function getSignedUrl(supabase: Client, storagePath: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data) throw error
  return data.signedUrl
}


// ── DASHBOARDS ────────────────────────────────────────────────

/** Author dashboard: current user's documents with rubric assignments and review counts */
export async function getMyDocumentsWithStats(supabase: Client) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('documents')
    .select(`
      id, title, file_type, platform, created_at, authors, subject_matter,
      creative_commons_license, third_party_content_disclosure, source_url,
      submission_scope, coordinator_released_at, is_draft, report_status, public_review,
      document_rubrics ( rubric:rubrics ( id, title ) ),
      reviews ( id, status, submitted_at, rubric_id, coordinator_approval, review_rubric_submissions ( rubric_id ) )
    `)
    .eq('author_id', user.id)
    .eq('coordinator_upload', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/** Full feedback for a single document — submitted reviews only, visible to the document author */
export async function getDocumentFeedback(supabase: Client, documentId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, title, author_id, storage_path, file_type, content_fingerprint, platform, source_url, course_access_code, submission_scope, report_status, revised_link, author:users!author_id(institution), document_rubrics(rubric:rubrics(id, title, rubric_items(id)))')
    .eq('id', documentId)
    .single()

  if (docError) throw docError

  const isAuthor = doc.author_id === user.id

  // A viewer can hold several roles at once (e.g. author of this document AND the
  // org coordinator, per the multi-role model). Compute coordinator status
  // independently of authorship so a coordinator who also authored the document
  // still gets the coordinator view — seeing pending reviews and able to
  // approve/return them — rather than being locked into the author view.
  const { data: viewer } = await supabase
    .from('users')
    .select('roles, institution')
    .eq('id', user.id)
    .single()

  const viewerRoles = (viewer?.roles ?? []) as string[]
  const authorInstitution = (doc.author as { institution: string | null } | null)?.institution
  const isCoordinator =
    viewerRoles.includes('coordinator') &&
    !!viewer?.institution &&
    viewer.institution === authorInstitution

  if (!isAuthor && !isCoordinator) {
    // Otherwise the viewer must be a reviewer of this document to see its feedback.
    const { count: reviewCount } = await supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .eq('reviewer_id', user.id)

    if ((reviewCount ?? 0) === 0) throw new Error('Not authorised')
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id, status, overall_comment, notes, submitted_at,
      coordinator_approval, coordinator_note, coordinator_decided_at,
      reviewer:users!reviewer_id ( display_name, email ),
      rubric:rubrics ( id, title ),
      review_rubric_submissions ( rubric_id, submitted_at ),
      review_scores (
        id, score, criterion_scores, comment,
        rubric_item:rubric_items ( id, label, sort_order, description )
      ),
      annotations ( id, body, tag, rubric_item_id, anchor ),
      score_comments ( id, rubric_item_id, score_level, body )
    `)
    .eq('document_id', documentId)
    .order('submitted_at', { ascending: true })

  if (error) throw error

  // Only surface reviews that have actually been released for reading. Per-rubric
  // submission creates a review_rubric_submissions row; a review may still be
  // 'in_progress' overall while some rubrics are released. Extension-submitted
  // (OLI Torus) and legacy whole-review submissions set status='submitted' without
  // creating per-rubric rows — include those too. (Previously an !inner join on
  // review_rubric_submissions handled the first case but silently dropped the
  // second, so extension-reviewed submissions never appeared to coordinators.)
  const releasedReviews = (data ?? []).filter(r => {
    const row = r as { status?: string; review_rubric_submissions?: unknown[] }
    return (row.review_rubric_submissions?.length ?? 0) > 0 || row.status === 'submitted'
  })

  // Hold org-scoped reviews back from the author until a coordinator approves.
  // (RLS also enforces this; the filter keeps the returned payload clean and
  // covers the both-scoped edge case defensively.) Coordinators and reviewers
  // see submitted reviews regardless of approval so they can act on them — this
  // includes a coordinator who also authored the document.
  const docScope = ((doc as { submission_scope?: string[] | null }).submission_scope ?? [])
  const requiresApproval = docScope.includes('organization')
  const visibleReviews = (isAuthor && !isCoordinator && requiresApproval)
    ? releasedReviews.filter(
        r => (r as { coordinator_approval?: string | null }).coordinator_approval === 'approved'
      )
    : releasedReviews

  // Author-side response state. RLS restricts these tables to the document author,
  // so non-authors (coordinators/reviewers) simply receive empty arrays.
  const { data: feedbackResponses } = await supabase
    .from('author_feedback_responses')
    .select('id, target_type, target_id, status, review_id')
    .eq('document_id', documentId)

  const { data: revisionNotes } = await supabase
    .from('revision_notes')
    .select('id, body, review_id, created_at, updated_at')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })

  const { data: feedbackComments } = await supabase
    .from('author_feedback_comments')
    .select('id, target_type, target_id, body, review_id')
    .eq('document_id', documentId)

  const allRubrics = ((doc as { document_rubrics?: { rubric: { id: string; title: string; rubric_items?: { id: string }[] } | null }[] }).document_rubrics ?? [])
    .map(dr => dr.rubric)
    .filter((r): r is { id: string; title: string; rubric_items?: { id: string }[] } => r !== null)
    .map(r => ({ id: r.id, title: r.title, itemIds: (r.rubric_items ?? []).map(item => item.id) }))
  return {
    document: doc,
    reviews: visibleReviews,
    isAuthor,
    isCoordinator,
    allRubrics,
    feedbackResponses: feedbackResponses ?? [],
    revisionNotes: revisionNotes ?? [],
    feedbackComments: feedbackComments ?? [],
  }
}

/** All distinct subject_matter values stored across documents (used to populate the custom options list) */
export async function getDistinctSubjectMatters(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('subject_matter')

  if (error) throw error
  return [...new Set((data ?? []).map(d => d.subject_matter).filter(Boolean))]
}

/** Reviewer dashboard: all documents with their rubric assignments and this reviewer's review status */
export async function getAllDocumentsWithRubrics(supabase: Client) {
  const { data, error } = await supabase
    .from('documents')
    .select(`
      id, title, file_type, platform, created_at, subject_matter,
      creative_commons_license, third_party_content_disclosure, source_url, course_access_code, public_review,
      author:users!author_id ( id, display_name, email ),
      document_rubrics ( rubric:rubrics ( id, title, rubric_items ( id ) ) ),
      reviews ( id, status, reviewer_id, submitted_at, rubric_id, notes, review_scores ( id, rubric_item_id, criterion_scores ), review_rubric_submissions ( rubric_id ) )
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}
/** Coordinator dashboard: high-level stats */
export async function getCoordinatorStats(supabase: Client) {
  const [docsResult, reviewsResult, usersResult] = await Promise.all([
    supabase.from('documents').select('id', { count: 'exact' }),
    supabase.from('reviews').select('id, status'),
    supabase.from('users').select('id', { count: 'exact' }),
  ])

  const reviews = reviewsResult.data ?? []
  return {
    documentCount: docsResult.count ?? 0,
    reviewTotal: reviews.length,
    reviewsInProgress: reviews.filter(r => r.status === 'assigned' || r.status === 'in_progress').length,
    reviewsSubmitted: reviews.filter(r => r.status === 'submitted').length,
    userCount: usersResult.count ?? 0,
  }
}

/** Coordinator dashboard: all documents with author info and review breakdown */
export async function getAllDocumentsForCoordinator(supabase: Client) {
  const { data, error } = await supabase
    .from('documents')
    .select(`
      id, title, file_type, created_at,
      author:users!author_id ( display_name, email ),
      document_rubrics ( rubric:rubrics ( id, title ) ),
      reviews ( id, status )
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/** Reviewer dashboard: documents visible to this reviewer based on their institution, scope, and direct assignments */
export async function getDocumentsForReviewer(supabase: Client, userId: string) {
  const [profileResult, docsResult, assignmentsResult, declinesResult, acceptancesResult] = await Promise.all([
    supabase
      .from('users')
      .select('institution')
      .eq('id', userId)
      .single(),
    supabase
      .from('documents')
      .select(`
        id, title, file_type, created_at, subject_matter,
        creative_commons_license, third_party_content_disclosure,
        submission_scope, coordinator_released_at, is_draft,
        author:users!author_id ( id, display_name, email, institution ),
        document_rubrics ( rubric:rubrics ( id, title, rubric_items ( id ) ) ),
        reviews ( id, status, reviewer_id, submitted_at, review_scores ( id, score ) )
      `)
      .eq('is_draft', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('document_assignments')
      .select('document_id')
      .eq('reviewer_id', userId),
    supabase
      .from('review_declines')
      .select('document_id')
      .eq('reviewer_id', userId),
    supabase
      .from('document_acceptances')
      .select('document_id')
      .eq('reviewer_id', userId),
  ])

  if (profileResult.error) throw profileResult.error
  if (docsResult.error) throw docsResult.error

  const reviewerInstitution = profileResult.data?.institution ?? null
  const assignedDocIds = new Set(
    (assignmentsResult.data ?? []).map(a => a.document_id)
  )
  const declinedDocIds = new Set(
    (declinesResult.data ?? []).map(d => d.document_id)
  )
  const acceptedDocIds = new Set(
    (acceptancesResult.data ?? []).map(a => a.document_id)
  )

  const visible = (docsResult.data ?? []).filter(doc => {
    if (declinedDocIds.has(doc.id)) return false

    // Coordinator-assigned docs are always visible to the assignee, even if they
    // are also the document author (coordinator may assign themselves during testing).
    if (assignedDocIds.has(doc.id)) return true

    // For the open pool, an author should not review their own document.
    const authorId = (doc.author as { id: string } | null)?.id
    if (authorId === userId) return false

    const scope: string[] = (doc.submission_scope ?? []) as string[]
    const authorInstitution = (doc.author as { institution: string | null } | null)?.institution ?? null

    if (scope.includes('public')) return reviewerInstitution === null
    if (
      scope.includes('organization') &&
      doc.coordinator_released_at &&
      reviewerInstitution &&
      authorInstitution === reviewerInstitution
    ) return true

    return false
  })

  return { documents: visible, acceptedDocIds, assignedDocIds }
}

/** Coordinator dashboard: org members, pending org submissions, and released submissions */
export async function getCoordinatorDashboardData(supabase: Client) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: coordProfile } = await supabase
    .from('users')
    .select('institution')
    .eq('id', user.id)
    .single()

  const institution = coordProfile?.institution ?? null

  const [membersResult, docsResult, rubricsResult, subjectMattersResult] = await Promise.all([
    institution
      ? supabase
          .from('users')
          .select('id, display_name, email, roles, reviewer_type, expertise_tags, rubric_specializations, onboarding_completed, created_at')
          .eq('institution', institution)
          .order('display_name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    institution
      ? supabase
          .from('documents')
          .select(`
            id, title, file_type, created_at, submission_scope, coordinator_released_at, is_draft, coordinator_upload,
            authors, platform, subject_matter, creative_commons_license, public_review,
            author:users!author_id ( id, display_name, email, institution ),
            document_rubrics ( rubric:rubrics ( id, title ) ),
            reviews ( id, status, coordinator_approval, submitted_at, rubric_id, reviewer:users!reviewer_id ( id, display_name, email ) )
          `)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from('rubrics').select('id, title').order('title'),
    supabase.from('documents').select('subject_matter'),
  ])

  if (membersResult.error) throw membersResult.error
  if (docsResult.error) throw docsResult.error

  const allOrgDocs = (docsResult.data ?? []).filter(doc => {
    const scope: string[] = (doc.submission_scope ?? []) as string[]
    const authorInstitution = (doc.author as { id: string; institution: string | null } | null)?.institution ?? null
    return scope.includes('organization') && authorInstitution === institution
  })

  const coordinatorUserId = user.id

  // Author-submitted org docs not yet released (coordinator_upload=false means it came from the author flow)
  const pending = allOrgDocs.filter(doc =>
    !doc.coordinator_released_at && !doc.is_draft && !doc.coordinator_upload
  )

  // All non-draft released docs
  const released = allOrgDocs.filter(doc => !!doc.coordinator_released_at && !doc.is_draft)

  // Released docs with at least one completed (submitted) review that has not yet
  // been released to the author — i.e. ready for the coordinator to release.
  // A submitted org review is awaiting release unless it's been approved or sent
  // back. Treat a null coordinator_approval as pending: the extension's submit
  // path (and any pre-approval-feature submissions) leave it null rather than
  // stamping 'pending'.
  const readyToRelease = released.filter(doc =>
    ((doc.reviews ?? []) as { status: string; coordinator_approval: string | null }[])
      .some(r =>
        r.status === 'submitted' &&
        r.coordinator_approval !== 'approved' &&
        r.coordinator_approval !== 'changes_requested'
      )
  )

  // Fetch assignments for released and pending docs
  const managedDocIds = [...released, ...pending].map(d => d.id)
  const assignmentsResult = managedDocIds.length > 0
    ? await supabase
        .from('document_assignments')
        .select('document_id, decline_note, declined_at, reviewer:users!reviewer_id ( id, display_name, email )')
        .in('document_id', managedDocIds)
    : { data: [] as { document_id: string; decline_note: string | null; declined_at: string | null; reviewer: { id: string; display_name: string | null; email: string } | null }[], error: null }

  const allSubjectMatters = [...new Set((subjectMattersResult.data ?? []).map(d => d.subject_matter).filter(Boolean))]

  return {
    institution,
    coordinatorUserId,
    members: membersResult.data ?? [],
    rubrics: (rubricsResult.data ?? []) as { id: string; title: string }[],
    customSubjectMatters: allSubjectMatters,
    pending,
    released,
    readyToRelease,
    assignments: assignmentsResult.data ?? [],
  }
}
