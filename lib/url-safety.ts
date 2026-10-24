// Server-only: SSRF guard for fetching user-submitted OER URLs.
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { isPrivateHostname, isValidOerUrl } from '@/lib/oer-platform'

const MAX_REDIRECTS = 5

async function assertPublicUrl(url: string): Promise<void> {
  if (!isValidOerUrl(url)) throw new Error('URL must be a public https link')
  const { hostname } = new URL(url)
  if (isIP(hostname)) return // literal already vetted by isValidOerUrl
  const records = await lookup(hostname, { all: true })
  if (records.length === 0 || records.some(r => isPrivateHostname(r.address))) {
    throw new Error('URL resolves to a non-public address')
  }
}

/** fetch() that validates the target (and every redirect hop) against private/internal addresses. */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current)
    const res = await fetch(current, { ...init, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return res
      current = new URL(location, current).toString()
      continue
    }
    return res
  }
  throw new Error('Too many redirects')
}
