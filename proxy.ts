import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl

  // Logged-in users hitting auth pages → send to their role-based dashboard
  const authPaths = ['/', '/login']
  if (session && authPaths.includes(pathname)) {
    const { data: profile } = await supabase
      .from('users')
      .select('roles')
      .eq('id', session.user.id)
      .maybeSingle()

    const roles: string[] = profile?.roles ?? []
    let destination = '/reviewer'
    if (roles.includes('coordinator')) destination = '/coordinator'
    else if (roles.includes('author')) destination = '/author'

    return NextResponse.redirect(new URL(destination, request.url))
  }

  // Unauthenticated users hitting protected pages → send to login
  if (!session && pathname.startsWith('/review')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/', '/login', '/review/:path*'],
}

