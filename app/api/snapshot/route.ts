import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { submitOpenStaxLink } from '@/lib/supabase/queries'
import { detectPlatform, isKnownOerUrl } from '@/lib/oer-platform'

async function fingerprintHtml(html: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(html)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

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
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { url, title, authors, subjectMatter, ccLicense, thirdPartyDisclosure, rubricIds } = body

  if (!url || !isKnownOerUrl(url)) {
    return NextResponse.json(
      { error: 'URL must be from a supported OER platform (OpenStax, Pressbooks, OER Commons, LibreTexts, MERLOT, Open Textbook Library, or Siyavula)' },
      { status: 400 }
    )
  }

  const platform = detectPlatform(url)

  // Fetch the OER page
  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Open4PeerReview/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${res.status} ${res.statusText}` },
        { status: 502 }
      )
    }
    html = await res.text()
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach URL: ${err instanceof Error ? err.message : 'network error'}` },
      { status: 502 }
    )
  }

  const fingerprint = await fingerprintHtml(html)
  const storagePath = `${fingerprint}.html`

  // Upload to openstax-snapshots bucket — skip if identical content already stored
  const { error: uploadError } = await supabase.storage
    .from('openstax-snapshots')
    .upload(storagePath, new Blob([html], { type: 'text/html' }), {
      contentType: 'text/html',
      upsert: false,
    })

  // 409 (Duplicate) means the snapshot already exists — that's fine
  if (uploadError && !uploadError.message.includes('already exists') && uploadError.message !== 'The resource already exists') {
    console.error('Snapshot upload error:', uploadError)
    return NextResponse.json({ error: 'Failed to store snapshot' }, { status: 500 })
  }

  try {
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
    })
    return NextResponse.json({ documentId: doc.id, fingerprint })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save document' },
      { status: 500 }
    )
  }
}
