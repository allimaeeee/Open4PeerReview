import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isKnownOerUrl } from '@/lib/oer-platform'
import { fetchAndSnapshot } from '@/lib/snapshot-utils'

// Lazily snapshot a single OER page URL on demand.
// Used when a reviewer navigates to a page that was saved without a fingerprint.
export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let url: string
  try {
    const body = await req.json()
    url = body.url
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!url || !isKnownOerUrl(url)) {
    return NextResponse.json(
      { error: 'URL must be from a supported OER platform' },
      { status: 400 }
    )
  }

  const result = await fetchAndSnapshot(supabase, url)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ fingerprint: result.fingerprint })
}
