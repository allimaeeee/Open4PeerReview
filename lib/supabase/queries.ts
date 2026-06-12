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
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Snapshot an OpenStax link: insert a document row with file_type 'html' */
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
    })
    .select()
    .single()

  if (error) throw error

  if (opts.rubricIds.length > 0) {
    await assignRubrics(supabase, data.id, opts.rubricIds)
  }

  return data
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
      creative_commons_license, third_party_content_disclosure, source_url,
      document_rubrics ( rubric:rubrics ( id, title ) ),
      reviews ( id, status, submitted_at, rubric_id )
    `)
    .eq('author_id', user.id)
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
    .select('id, title, author_id, storage_path, file_type, content_fingerprint')
    .eq('id', documentId)
    .single()

  if (docError) throw docError
  if (doc.author_id !== user.id) throw new Error('Not authorised')

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
  return { document: doc, reviews: data ?? [] }
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
      creative_commons_license, third_party_content_disclosure, source_url,
      author:users!author_id ( id, display_name, email ),
      document_rubrics ( rubric:rubrics ( id, title ) ),
      reviews ( id, status, reviewer_id, submitted_at, rubric_id )
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
    reviewsInProgress: reviews.filter(r => r.status === 'in_progress').length,
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
