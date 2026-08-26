import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import {
  getAdminHomePath,
  hasAdminPanelAccess,
  isClubLeaderAllowedPath,
  isClubLeaderUser,
  isSuperAdminUser,
} from '@/lib/admin-access'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // /debug 경로 보호 — 카카오 세션 + 슈퍼관리자만
  if (request.nextUrl.pathname.startsWith('/debug')) {
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
    if (!session?.user) {
      const login = new URL('/auth/login', request.url)
      login.searchParams.set('next', nextPath)
      return NextResponse.redirect(login)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_superadmin, is_admin, is_staff')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!isSuperAdminUser(session.user.email, profile)) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return response
  }

  // /admin 경로 보호
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const isLoginPage = request.nextUrl.pathname === '/admin/login'

    if (isLoginPage) {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_superadmin, is_admin, is_staff')
          .eq('id', session.user.id)
          .maybeSingle()

        if (hasAdminPanelAccess(session.user.email, profile)) {
          return NextResponse.redirect(
            new URL(getAdminHomePath(session.user.email, profile), request.url)
          )
        }
      }
      return response
    }

    if (!session?.user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_superadmin, is_admin, is_staff')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!hasAdminPanelAccess(session.user.email, profile)) {
      return NextResponse.redirect(
        new URL('/admin/login?error=no_access', request.url)
      )
    }

    // 소모임장: 번개 관리·설정(+ posting 편집)만 허용
    if (
      isClubLeaderUser(session.user.email, profile) &&
      !isClubLeaderAllowedPath(request.nextUrl.pathname)
    ) {
      return NextResponse.redirect(new URL('/admin/meetups', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/debug', '/debug/:path*'],
}
