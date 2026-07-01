import type { SupabaseClient } from '@supabase/supabase-js'

// Appends an oer_token (base64-encoded Supabase session) and oer_review_id to the
// Torus course URL so the OER Review Chrome extension auto-logs-in and routes the
// reviewer straight to this review's console instead of the extension login form.
export async function openInTorus(
  supabase: SupabaseClient,
  sourceUrl: string | null | undefined,
  reviewId: string | null,
) {
  let url = sourceUrl ?? '#'
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
        const sep = url.includes('?') ? '&' : '?'
        url = `${url}${sep}oer_review_id=${reviewId}&oer_token=${encodeURIComponent(token)}`
      }
    } catch { /* open without token if anything fails */ }
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
