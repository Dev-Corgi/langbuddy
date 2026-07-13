import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { expiryIsoFromKakaoAccessToken } from '@/lib/kakao-oauth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const nextParam = requestUrl.searchParams.get('next') || '/'
  const nextPath =
    nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'
  
  const code = requestUrl.searchParams.get('code')
  const error_code = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  if (error_code) {
    console.error('[Auth Callback] OAuth error from provider:', { error_code, error_description })
    const loginPath = nextPath.startsWith('/admin')
      ? `/admin/login?error=${error_code}&desc=${encodeURIComponent(error_description ?? '')}`
      : `/auth/login?error=${error_code}&desc=${encodeURIComponent(error_description ?? '')}`
    return NextResponse.redirect(new URL(loginPath, requestUrl.origin))
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Component에서는 쿠키 설정이 제한될 수 있음
            }
          },
        },
      }
    )
    
    const { data: { user, session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('[Auth Callback] Exchange error:', error.message)
      const loginPath = nextPath.startsWith('/admin')
        ? '/admin/login?error=auth_failed'
        : '/auth/login?error=auth_failed'
      return NextResponse.redirect(new URL(loginPath, requestUrl.origin))
    }

    if (user) {
      const hasKakaoProvider = user.app_metadata?.providers?.includes('kakao') || 
                              user.app_metadata?.provider === 'kakao'
      
      if (hasKakaoProvider && user.user_metadata?.provider_id) {
        const kakaoUuid = user.user_metadata.provider_id
        const providerAccess = session?.provider_token ?? null
        const providerRefresh = session?.provider_refresh_token ?? null
        const expiresAt =
          expiryIsoFromKakaoAccessToken(providerAccess) ??
          (providerAccess ? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() : null)

        const kakaoPatch: Record<string, unknown> = {
          kakao_uuid: kakaoUuid,
          kakao_access_token: providerAccess,
          kakao_token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }
        if (typeof providerRefresh === 'string' && providerRefresh.length > 0) {
          kakaoPatch.kakao_refresh_token = providerRefresh
        }

        const admin = createSupabaseAdmin()
        const { error: upsertError } = await admin.from('users').upsert(
          { id: user.id, ...kakaoPatch },
          { onConflict: 'id' }
        )
        if (upsertError) {
          console.error('[Auth Callback] Error upserting Kakao data:', upsertError)
        }
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single()
      
      if (!userData || !userData.onboarding_completed) {
        const skipOnboarding = nextPath.includes('/apply') || nextPath.startsWith('/admin')
        if (skipOnboarding) {
          return NextResponse.redirect(new URL(nextPath, requestUrl.origin))
        }
        return NextResponse.redirect(new URL('/auth/onboarding', requestUrl.origin))
      }
      
      if (nextPath.startsWith('/')) {
        return NextResponse.redirect(new URL(nextPath, requestUrl.origin))
      }
      return NextResponse.redirect(new URL('/', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
