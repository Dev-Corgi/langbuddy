import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { expiryIsoFromKakaoAccessToken } from '@/lib/kakao-oauth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  console.log('🔄 [Auth Callback] 시작')

  const requestUrl = new URL(request.url)
  const nextParam = requestUrl.searchParams.get('next') || '/'
  const nextPath =
    nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'
  console.log('🔄 [Auth Callback] Request URL:', requestUrl.toString())
  
  const code = requestUrl.searchParams.get('code')
  const error_code = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  
  console.log('🔄 [Auth Callback] Code:', code ? 'exists' : 'missing')
  console.log('🔄 [Auth Callback] Error code:', error_code)
  console.log('🔄 [Auth Callback] Error description:', error_description)

  if (error_code) {
    console.error('❌ [Auth Callback] OAuth error from provider:', {
      error_code,
      error_description
    })
    const loginPath = nextPath.startsWith('/admin')
      ? `/admin/login?error=${error_code}&desc=${encodeURIComponent(error_description ?? '')}`
      : `/auth/login?error=${error_code}&desc=${encodeURIComponent(error_description ?? '')}`
    return NextResponse.redirect(new URL(loginPath, requestUrl.origin))
  }

  if (code) {
    console.log('🔄 [Auth Callback] Exchanging code for session...')
    
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
    
    console.log('🔄 [Auth Callback] Exchange result - User:', user?.id)
    console.log('🔄 [Auth Callback] Exchange result - Error:', error)
   console.log('🔍 [Auth Callback] Session provider token:', session?.provider_token ? 'exists' : 'missing')
    console.log('🔍 [Auth Callback] Session provider_refresh_token:', session?.provider_refresh_token ? 'exists' : 'missing')
    
    if (error) {
      console.error('❌ [Auth Callback] Exchange error details:', {
        message: error.message,
        status: error.status,
        name: error.name
      })
      const loginPath = nextPath.startsWith('/admin')
        ? '/admin/login?error=auth_failed'
        : '/auth/login?error=auth_failed'
      return NextResponse.redirect(new URL(loginPath, requestUrl.origin))
    }

    if (user) {
      console.log('✅ [Auth Callback] User authenticated:', user.id)
      console.log('🔍 [Auth Callback] User app_metadata:', user.app_metadata)
      console.log('🔍 [Auth Callback] User user_metadata:', user.user_metadata)
      console.log('🔍 [Auth Callback] Provider:', user.app_metadata?.provider)
      
      // Save Kakao UUID if available (for message sending)
      const hasKakaoProvider = user.app_metadata?.providers?.includes('kakao') || 
                              user.app_metadata?.provider === 'kakao'
      
      if (hasKakaoProvider && user.user_metadata?.provider_id) {
        console.log('📝 [Auth Callback] Kakao provider detected')
        console.log('📝 [Auth Callback] Looking for UUID in user_metadata...')
        console.log('📝 [Auth Callback] user_metadata keys:', Object.keys(user.user_metadata || {}))
        
        // Use provider_id from Kakao (this is the UUID we need)
        const kakaoUuid = user.user_metadata.provider_id
        
        console.log('📝 [Auth Callback] Extracted Kakao UUID:', kakaoUuid)
        console.log('📝 [Auth Callback] Provider token:', session?.provider_token ? `${session.provider_token.substring(0, 20)}...` : 'missing')
        
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
          {
            id: user.id,
            ...kakaoPatch,
          },
          { onConflict: 'id' }
        )

        if (upsertError) {
          console.error('❌ [Auth Callback] Error upserting Kakao data:', upsertError)
        } else {
          console.log('✅ [Auth Callback] Kakao data saved successfully:', {
            uuid: kakaoUuid,
            hasToken: !!session?.provider_token,
            hasRefreshSaved: typeof providerRefresh === 'string' && providerRefresh.length > 0,
            expiresAt,
          })
        }
      } else {
        console.log('⏭️ [Auth Callback] Not a Kakao login, provider:', user.app_metadata?.provider)
      }
      
      // 온보딩 완료 여부 확인
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single()
      
      console.log('🔄 [Auth Callback] User data:', userData)
      console.log('🔄 [Auth Callback] User data error:', userError)
      
      if (!userData || !userData.onboarding_completed) {
        const skipOnboarding = nextPath.includes('/apply') || nextPath.startsWith('/admin')
        if (skipOnboarding) {
          console.log('➡️ [Auth Callback] Onboarding skipped, next:', nextPath)
          return NextResponse.redirect(new URL(nextPath, requestUrl.origin))
        }
        console.log('➡️ [Auth Callback] Redirecting to onboarding')
        return NextResponse.redirect(new URL('/auth/onboarding', requestUrl.origin))
      }
      
      console.log('➡️ [Auth Callback] Redirecting to next or home')
      if (nextPath.startsWith('/')) {
        return NextResponse.redirect(new URL(nextPath, requestUrl.origin))
      }
      return NextResponse.redirect(new URL('/', requestUrl.origin))
    }
  }

  console.log('⚠️ [Auth Callback] No code provided, redirecting to home')
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
