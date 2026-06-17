import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { submitOpenStaxLink, updateDocumentContent } from '@/lib/supabase/queries'
import { detectPlatform, isKnownOerUrl } from '@/lib/oer-platform'
import { fetchAndSnapshot } from '@/lib/snapshot-utils'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    url: string
    title: string
    authors: string
    subjectMatter: string
    ccLicense: string
    thirdPartyDisclosure?: string
    rubricIds?: string[]
    submissionScope?: string[]
    isDraft?: boolean
    coordinatorUpload?: boolean
    documentId?: string
    additionalPageUrls?: string[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { url, title, authors, subjectMatter, ccLicense, thirdPartyDisclosure, rubricIds, submissionScope, isDraft, coordinatorUpload, documentId, additionalPageUrls } = body

  if (!url || !isKnownOerUrl(url)) {
    return NextResponse.json(
      { error: 'URL must be from a supported OER platform (OpenStax, Pressbooks, OER Commons, LibreTexts, MERLOT, Open Textbook Library, or Siyavula)' },
      { status: 400 }
    )
  }

  const validAdditionalUrls = (additionalPageUrls ?? []).filter(u => u.trim())
  for (const pageUrl of validAdditionalUrls) {
    if (!isKnownOerUrl(pageUrl)) {
      return NextResponse.json(
        { error: `Additional page URL is not from a supported OER platform: ${pageUrl}` },
        { status: 400 }
      )
    }
  }

  const platform = detectPlatform(url)

  // Snapshot primary page
  const primary = await fetchAndSnapshot(supabase, url)
  if ('error' in primary) return NextResponse.json({ error: primary.error }, { status: primary.status })
  const { fingerprint, storagePath } = primary

  // Snapshot each additional page URL
  const additionalPages: Array<{ url: string; fingerprint: string; storagePath: string }> = []
  for (const pageUrl of validAdditionalUrls) {
    const result = await fetchAndSnapshot(supabase, pageUrl)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    additionalPages.push({ url: pageUrl, fingerprint: result.fingerprint, storagePath: result.storagePath })
  }

  try {
    // Update mode: patch content on an existing document
    if (documentId) {
      const { data: doc } = await supabase
        .from('documents')
        .select('author_id, is_draft')
        .eq('id', documentId)
        .single()

      if (!doc || doc.author_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
      if (!doc.is_draft) {
        return NextResponse.json({ error: 'Only drafts can be updated' }, { status: 400 })
      }

      await updateDocumentContent(supabase, documentId, {
        fileType: 'html',
        fileUrl: url,
        storagePath,
        sourceUrl: url,
        contentFingerprint: fingerprint,
        platform,
      })

      return NextResponse.json({ documentId, fingerprint })
    }

    // Create mode: insert new document
    const doc = await submitOpenStaxLink(supabase, {
      url,
      storagePath,
      fingerprint,
      title,
      authors,
      subjectMatter,
      ccLicense: ccLicense as Parameters<typeof submitOpenStaxLink>[1]['ccLicense'],
      thirdPartyDisclosure: thirdPartyDisclosure ?? null,
      rubricIds: rubricIds ?? [],
      platform,
      submissionScope: submissionScope ?? ['public'],
      isDraft: isDraft ?? false,
      coordinatorUpload: coordinatorUpload ?? false,
      additionalPages: additionalPages.length ? additionalPages : undefined,
    })
    return NextResponse.json({ documentId: doc.id, fingerprint })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save document' },
      { status: 500 }
    )
  }
}
