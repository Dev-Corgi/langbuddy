'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { SupabaseEmailOtpAuth } from '@/components/supabase-email-otp-auth'

type Props = {
  locale: string
  /** 완료 후 돌아올 경로 (e.g. /posting/language/apply) */
  returnPath: string
  onAuthed: () => void
}

export function ApplyLoginModal({ locale, returnPath, onAuthed }: Props) {
  const isEn = locale === 'en'
  const router = useRouter()
  const supabase = createClient()

  const handleKakao = async () => {
    const next = encodeURIComponent(returnPath)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        scopes: 'profile_nickname profile_image account_email talk_message',
      },
    })
    if (error) {
      alert(error.message)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-[32px] overflow-hidden max-h-[90vh] overflow-y-auto">
        <CardHeader className="text-center space-y-2 p-8 pb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-black">
            {isEn ? 'Sign in to apply' : '신청하려면 로그인'}
          </CardTitle>
          <CardDescription className="font-medium">
            {isEn
              ? 'Use Kakao or email (one-time code) to continue.'
              : '카카오 로그인 또는 이메일 인증번호(OTP)로 신청을 계속합니다.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-0 space-y-6">
          <Button
            type="button"
            onClick={handleKakao}
            className="w-full h-14 rounded-2xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#000000] font-black text-base shadow-lg"
          >
            {isEn ? 'Continue with Kakao' : '카카오로 계속하기'}
          </Button>

          <div className="space-y-2">
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs font-bold uppercase">
                <span className="bg-card px-3 text-muted-foreground">
                  {isEn ? 'or email (guest)' : '또는 이메일 (게스트)'}
                </span>
              </div>
            </div>
            <SupabaseEmailOtpAuth locale={locale} onSuccess={onAuthed} />
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full font-bold text-muted-foreground"
            onClick={() => router.push((returnPath || '').replace(/\/apply\/?$/, '') || '/')}
          >
            {isEn ? 'Cancel' : '취소'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
