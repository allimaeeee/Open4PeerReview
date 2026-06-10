import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENSTAX_ORIGIN = 'https://openstax.org'

function rewriteHtml(html: string): string {
  // Strip all <script> tags — the OpenStax React app boots, hydrates over the
  // SSR content, and renders blank when it can't initialize in an iframe context.
  // The SSR'd HTML already contains the full readable content; no JS needed.
  let out = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Inject <base> tag so relative URLs for CSS/images resolve against openstax.org
  const baseTag = `<base href="${OPENSTAX_ORIGIN}/">`
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/(<head[^>]*>)/i, `$1\n  ${baseTag}`)
  } else {
    out = baseTag + out
  }

  return out
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fingerprint: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { fingerprint } = await params

  if (!/^[0-9a-f]{64}$/.test(fingerprint)) {
    return new NextResponse('Invalid fingerprint', { status: 400 })
  }

  const { data, error } = await supabase.storage
    .from('openstax-snapshots')
    .download(`${fingerprint}.html`)

  if (error || !data) {
    return new NextResponse('Snapshot not found', { status: 404 })
  }

  const html = await data.text()
  const rewritten = rewriteHtml(html)

  return new NextResponse(rewritten, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Allow framing only from our own origin
      'Content-Security-Policy': "frame-ancestors 'self'",
      // Explicitly no X-Frame-Options so browsers allow the iframe
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
