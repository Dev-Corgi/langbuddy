'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'
import { i18n } from '@/lib/i18n'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPathRaw = searchParams.get('next') || '/'
  const nextPath = nextPathRaw.startsWith('/') ? nextPathRaw : '/'
  const kakaoReauthReason = searchParams.get('reason') === 'kakao_reauth'
  const supabase = createClient()
  const locale = useLocale()
  const tDict = i18n[locale]
  
  // URL 파라미터에서 에러 정보 확인
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    const desc = params.get('desc')
    
    if (error) {
      console.error('❌ [로그인 페이지] URL 에러 파라미터:', { error, desc })
      if (desc) {
        alert(`로그인 실패: ${error} - ${desc}`)
      }
    }
  }, [])

  useEffect(() => {
    // 이미 로그인된 경우 홈으로 리다이렉트
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // 온보딩 완료 여부 확인
        const { data: userData } = await supabase
          .from('users')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single()
        
        if (userData?.onboarding_completed) {
          router.push(nextPath)
        } else {
          const isApply = nextPath.includes('/apply')
          if (isApply) {
            router.push(nextPath)
          } else {
            router.push('/auth/onboarding')
          }
        }
      }
    }
    checkUser()
  }, [supabase, router, nextPath])

  const handleKakaoLogin = async () => {
    console.log('🔵 [카카오 로그인] 시작')
    console.log('🔵 [카카오 로그인] Redirect URL:', `${window.location.origin}/auth/callback`)
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        scopes: 'profile_nickname profile_image account_email talk_message'
      }
    })
    
    console.log('🔵 [카카오 로그인] Response data:', data)
    console.log('🔵 [카카오 로그인] Response error:', error)
    
    if (error) {
      console.error('❌ [카카오 로그인] Error details:', {
        message: error.message,
        status: error.status,
        name: error.name,
        stack: error.stack
      })
      alert(`로그인 실패: ${error.message}`)
    } else {
      console.log('✅ [카카오 로그인] OAuth 리다이렉트 시작')
    }
  }

  const handleGoogleLogin = async () => {
    console.log('🟢 [구글 로그인] 시작')
    console.log('🟢 [구글 로그인] Redirect URL:', `${window.location.origin}/auth/callback`)
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    
    console.log('🟢 [구글 로그인] Response data:', data)
    console.log('🟢 [구글 로그인] Response error:', error)
    
    if (error) {
      console.error('❌ [구글 로그인] Error details:', {
        message: error.message,
        status: error.status,
        name: error.name,
        stack: error.stack
      })
      alert(`로그인 실패: ${error.message}`)
    } else {
      console.log('✅ [구글 로그인] OAuth 리다이렉트 시작')
    }
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-[40px] overflow-hidden bg-card">
        <CardHeader className="text-center space-y-4 p-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <MessageSquare className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-black text-foreground">
            {locale === 'en' ? 'Welcome to LangBuddy' : 'LangBuddy에 오신 것을 환영합니다'}
          </CardTitle>
          <CardDescription className="text-muted-foreground font-medium text-base">
            {locale === 'en' 
              ? 'Sign in to join language exchanges' 
              : '언어교환에 참여하려면 로그인하세요'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-4">
          {kakaoReauthReason && (
            <div
              role="status"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-950"
            >
              {locale === 'en'
                ? 'Kakao access needs to be refreshed. Please sign in with Kakao again.'
                : '카카오 연동을 갱신해야 합니다. 카카오로 다시 로그인해 주세요.'}
            </div>
          )}
          <Button
            onClick={handleKakaoLogin}
            className="w-full h-14 rounded-2xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#000000] font-black text-lg shadow-lg"
          >
            <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.442 1.443 4.615 3.686 6.143-.203.755-.753 2.817-.864 3.247-.137.532.195.525.41.382.157-.105 2.548-1.696 3.548-2.363C9.49 17.967 10.72 18 12 18c5.523 0 10-3.477 10-7.5S17.523 3 12 3z"/>
            </svg>
            {locale === 'en' ? 'Continue with Kakao' : '카카오로 시작하기'}
          </Button>

          {/* Google login temporarily hidden */}
          {/* <Button
            onClick={handleGoogleLogin}
            className="w-full h-14 rounded-2xl bg-white hover:bg-gray-50 text-gray-800 font-black text-lg shadow-lg border-2 border-gray-200"
          >
            <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {locale === 'en' ? 'Continue with Google' : '구글로 시작하기'}
          </Button> */}

          <p className="text-center text-xs font-medium leading-relaxed text-muted-foreground px-1">
            {locale === 'en' ? (
              <>
                By continuing, you acknowledge our{' '}
                <Link
                  href="/privacy"
                  className="font-bold text-primary underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </Link>
                .
              </>
            ) : (
              <>
                로그인(소셜 로그인)을 진행하시면{' '}
                <Link
                  href="/privacy"
                  className="font-bold text-primary underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  개인정보 처리방침
                </Link>
                을 확인한 것으로 간주됩니다.
              </>
            )}
          </p>

          <div className="pt-4 text-center">
            <button
              onClick={() => !nextPath.includes('/apply') && router.push('/')}
              className={`text-sm font-bold transition-colors ${
                nextPath.includes('/apply')
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-primary'
              }`}
              type="button"
              disabled={nextPath.includes('/apply')}
            >
              {locale === 'en' ? 'Continue without login' : '로그인 없이 계속하기'}
            </button>
            {nextPath.includes('/apply') && (
              <p className="text-xs text-muted-foreground mt-2">
                {locale === 'en'
                  ? 'Applying for language exchange requires sign-in.'
                  : '언어교환 신청은 로그인 후 진행할 수 있습니다.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-muted flex items-center justify-center">
          <p className="text-muted-foreground font-bold">Loading…</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
