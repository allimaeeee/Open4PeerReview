// lib/supabase/queries.ts
// Typed query helpers — import these in Server Components and Route Handlers
// All functions accept a Supabase server client as the first argument.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Anchor, CommentWithAuthor, RubricWithItems } from './types'

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
  fileType: Database['public']['Enums']['file_type']
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
    })
    .select()
    .single()

  if (error) throw error
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


// ── COMMENTS ─────────────────────────────────────────────────

/** Fetch all comments for a document, with author display name */
export async function getComments(
  supabase: Client,
  documentId: string
): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, users(display_name, email)')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as CommentWithAuthor[]
}

/** Create a new comment with a format-specific anchor */
export async function createComment(
  supabase: Client,
  payload: {
    documentId: string
    rubricItemId: string
    body: string
    anchor: Anchor
  }
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('comments')
    .insert({
      document_id: payload.documentId,
      rubric_item_id: payload.rubricItemId,
      author_id: user.id,
      body: payload.body,
      anchor: payload.anchor,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Delete a comment (RLS ensures only author or admin can do this) */
export async function deleteComment(supabase: Client, commentId: string) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)

  if (error) throw error
}
