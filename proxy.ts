import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // supabaseResponse must be returned (or have its cookies copied) so that
  // any token refresh that happens inside getUser() propagates to the browser.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Helper: copy any refreshed session cookies into a redirect response so
  // the browser receives the updated token even when we don't return supabaseResponse.
  function redirectWithCookies(destination: string | URL) {
    const redirectResponse = NextResponse.redirect(destination)
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...rest }) =>
      redirectResponse.cookies.set(name, value, rest)
    )
    return redirectResponse
  }

  // Logged-in users hitting auth pages → send to their role-based dashboard
  const authPaths = ['/', '/login']
  if (user && authPaths.includes(pathname)) {
    const { data: profile } = await supabase
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .maybeSingle()

    const roles: string[] = profile?.roles ?? []
    let destination = '/reviewer'
    if (roles.includes('coordinator')) destination = '/coordinator'
    else if (roles.includes('author')) destination = '/author'

    return redirectWithCookies(new URL(destination, request.url))
  }

  // Unauthenticated users hitting protected pages → send to login
  if (!user && pathname.startsWith('/review')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return redirectWithCookies(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/', '/login', '/review/:path*'],
}

