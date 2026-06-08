'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Props = {
  locale: string
  /** 완료 후 돌아올 경로 (e.g. /posting/language/apply) */
  returnPath: string
  onAuthed: () => void
}

export function ApplyLoginModal({ locale, returnPath }: Props) {
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
      <Card className="w-full max-w-md border-none shadow-2xl rounded-[32px] overflow-hidden">
        <CardHeader className="text-center space-y-2 p-8 pb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-black">
            {isEn ? 'Sign in to apply' : '신청하려면 로그인'}
          </CardTitle>
          <CardDescription className="font-medium">
            {isEn
              ? 'Sign in with Kakao to continue.'
              : '카카오 로그인으로 신청을 계속합니다.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-0 space-y-4">
          <Button
            type="button"
            onClick={handleKakao}
            className="w-full h-14 rounded-2xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#000000] font-black text-base shadow-lg"
          >
            {isEn ? 'Continue with Kakao' : '카카오로 계속하기'}
          </Button>

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
