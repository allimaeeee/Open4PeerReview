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

  // Determine which rubric to use for pre-created review rows
  const { data: docRubrics } = await supabase
    .from('document_rubrics')
    .select('rubric_id')
    .eq('document_id', documentId)
    .limit(1)

  const { data: presetRubric } = docRubrics?.length === 0
    ? await supabase.from('rubrics').select('id').eq('is_preset', true).limit(1).single()
    : { data: null }

  const rubricId = docRubrics?.[0]?.rubric_id ?? presetRubric?.id
  if (!rubricId) return

  // Pre-create review rows with status 'assigned' for each newly assigned reviewer
  // Ignore duplicates — reviewers who already have a review row keep their existing status
  await supabase
    .from('reviews')
    .upsert(
      reviewerIds.map(reviewerId => ({
        document_id: documentId,
        reviewer_id: reviewerId,
        rubric_id: rubricId,
        status: 'assigned' as const,
      })),
      { onConflict: 'document_id,reviewer_id', ignoreDuplicates: true }
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
      id, title, file_type, created_at, authors, subject_matter,
      creative_commons_license, third_party_content_disclosure,
      submission_scope, coordinator_released_at, is_draft,
      document_rubrics ( rubric:rubrics ( id, title ) ),
      reviews ( id, status, submitted_at )
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
    .select('id, title, author_id, storage_path, file_type, content_fingerprint, author:users!author_id(institution)')
    .eq('id', documentId)
    .single()

  if (docError) throw docError

  const isAuthor = doc.author_id === user.id

  if (!isAuthor) {
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

    if (!isCoordinator) throw new Error('Not authorised')
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id, status, overall_comment, submitted_at,
      reviewer:users!reviewer_id ( display_name, email ),
      rubric:rubrics ( id, title ),
      review_scores (
        id, score, comment,
        rubric_item:rubric_items ( id, label, sort_order, description )
      ),
      annotations ( id, body, tag, rubric_item_id, anchor )
    `)
    .eq('document_id', documentId)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true })

  if (error) throw error
  return { document: doc, reviews: data ?? [], isAuthor }
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
      id, title, file_type, created_at, subject_matter,
      creative_commons_license, third_party_content_disclosure,
      author:users!author_id ( display_name, email ),
      document_rubrics ( rubric:rubrics ( id, title ) ),
      reviews ( id, status, reviewer_id )
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

    if (scope.includes('public')) return true
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
            author:users!author_id ( id, display_name, email, institution ),
            document_rubrics ( rubric:rubrics ( id, title ) ),
            reviews ( id, status )
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
    assignments: assignmentsResult.data ?? [],
  }
}
