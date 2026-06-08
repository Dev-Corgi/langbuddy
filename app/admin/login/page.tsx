'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Globe } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted">
          <p className="text-muted-foreground font-bold">Loading…</p>
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  )
}

function AdminLoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const supabase = createClient()
  const locale = useLocale()

  const toggleLocale = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko'
    localStorage.setItem('locale', newLocale)
    window.dispatchEvent(new Event('localeChange'))
  }

  useEffect(() => {
    const errorCode = searchParams.get('error')
    const errorDesc = searchParams.get('desc')
    if (errorCode) {
      setError(
        errorDesc ||
          (locale === 'en' ? 'Login failed. Please try again.' : '로그인에 실패했습니다. 다시 시도해 주세요.')
      )
    }
  }, [searchParams, locale])

  const handleKakaoLogin = async () => {
    setLoading(true)
    setError(null)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/admin')}`,
        scopes: 'profile_nickname profile_image account_email talk_message',
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
  }

  const t = {
    ko: {
      title: '관리자 로그인',
      description: '카카오 계정으로 관리자 페이지에 로그인합니다.',
      login: '카카오로 로그인',
      loggingIn: '로그인 중...',
    },
    en: {
      title: 'Admin Login',
      description: 'Sign in to the admin panel with your Kakao account.',
      login: 'Continue with Kakao',
      loggingIn: 'Signing in...',
    },
  }[locale]

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6 relative">
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleLocale}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border text-[13px] font-black text-muted-foreground hover:text-primary transition-colors uppercase shadow-sm"
        >
          <Globe className="w-4 h-4" />
          {locale}
        </button>
      </div>

      <Card className="w-full max-w-[400px] border-black shadow-xl rounded-[32px]">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-black">{t.title}</CardTitle>
          <CardDescription className="font-medium text-muted-foreground">
            {t.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm font-bold text-destructive">{error}</p>
          )}
          <Button
            type="button"
            onClick={handleKakaoLogin}
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#000000] font-black text-base shadow-lg"
          >
            {loading ? t.loggingIn : t.login}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
