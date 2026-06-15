// Shared utilities for fetching OER pages and storing HTML snapshots.
// Used by both the initial upload route and the lazy-snapshot route.

import type { SupabaseClient } from '@supabase/supabase-js'

export async function fingerprintHtml(html: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(html)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function fetchAndSnapshot(
  supabase: SupabaseClient,
  url: string,
): Promise<{ fingerprint: string; storagePath: string } | { error: string; status: number }> {
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
    if (!res.ok) return { error: `Failed to fetch page (${url}): ${res.status} ${res.statusText}`, status: 502 }
    html = await res.text()
  } catch (err) {
    return { error: `Could not reach URL (${url}): ${err instanceof Error ? err.message : 'network error'}`, status: 502 }
  }

  const fingerprint = await fingerprintHtml(html)
  const storagePath = `${fingerprint}.html`

  const { error: uploadError } = await supabase.storage
    .from('openstax-snapshots')
    .upload(storagePath, new Blob([html], { type: 'text/html' }), {
      contentType: 'text/html',
      upsert: false,
    })

  if (uploadError && !uploadError.message.includes('already exists') && uploadError.message !== 'The resource already exists') {
    console.error('Snapshot upload error:', uploadError)
    return { error: 'Failed to store snapshot', status: 500 }
  }

  return { fingerprint, storagePath }
}
