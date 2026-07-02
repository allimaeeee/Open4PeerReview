import type { SupabaseClient } from '@supabase/supabase-js'

interface OpenInTorusOptions {
  // Land on this specific page (e.g. the exact Torus page an annotation was made
  // on) instead of the course root. Falls back to sourceUrl when omitted.
  pageUrl?: string | null
  // Tell the extension to scroll to this annotation and expand its criterion once
  // the page loads (read as ?oer_goto= in the content script).
  annotationId?: string | null
}

// Appends an oer_token (base64-encoded Supabase session) and oer_review_id to the
// Torus course URL so the OER Review Chrome extension auto-logs-in and routes the
// reviewer straight to this review's console instead of the extension login form.
// Optionally deep-links to a specific page + annotation.
export async function openInTorus(
  supabase: SupabaseClient,
  sourceUrl: string | null | undefined,
  reviewId: string | null,
  options: OpenInTorusOptions = {},
) {
  const { pageUrl, annotationId } = options
  const preferredPage = pageUrl && pageUrl !== '#' ? pageUrl : null
  let url = preferredPage || sourceUrl || '#'
  if (url !== '#' && reviewId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const authPayload = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          user_id: session.user.id,
          email: session.user.email ?? '',
          expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        }
        const token = btoa(encodeURIComponent(JSON.stringify(authPayload)))
        const params = new URLSearchParams()
        params.set('oer_review_id', reviewId)
        params.set('oer_token', token)
        if (annotationId) params.set('oer_goto', annotationId)
        const sep = url.includes('?') ? '&' : '?'
        url = `${url}${sep}${params.toString()}`
      }
    } catch { /* open without token if anything fails */ }
  } else if (url !== '#' && annotationId) {
    // No session/review to deep-link with, but still ask the extension to scroll.
    const sep = url.includes('?') ? '&' : '?'
    url = `${url}${sep}oer_goto=${encodeURIComponent(annotationId)}`
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
