'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { PRIVACY_POLICY_VERSION } from '@/lib/privacy-policy'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, UserCircle } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'
import { i18n } from '@/lib/i18n'
import { toast } from 'sonner'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const locale = useLocale()
  const tDict = i18n[locale]

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'남' | '여'>('남')
  const [nationality, setNationality] = useState<'한국인' | '외국인'>('한국인')
  const [kakaoId, setKakaoId] = useState('')
  const [privacyAgreed, setPrivacyAgreed] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      // 이미 온보딩 완료한 경우
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (userData?.onboarding_completed) {
        router.push('/')
        return
      }

      setLoading(false)
    }

    checkAuth()
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    if (!name.trim() || !gender || !nationality || !kakaoId.trim()) {
      toast.error(locale === 'en' ? 'Please fill in all required fields' : '필수 항목을 모두 입력해주세요')
      setSubmitting(false)
      return
    }

    if (!privacyAgreed) {
      toast.error(
        locale === 'en'
          ? 'Please agree to the Privacy Policy to continue.'
          : '계속하려면 개인정보 처리방침에 동의해 주세요.'
      )
      setSubmitting(false)
      return
    }

    const res = await fetch('/api/complete-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        gender,
        nationality,
        kakaoId: kakaoId.trim(),
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('Onboarding error:', body)
      toast.error(locale === 'en' ? 'Failed to save information' : '정보 저장에 실패했습니다')
      setSubmitting(false)
      return
    }

    toast.success(locale === 'en' ? 'Welcome to LangBuddy!' : 'LangBuddy에 오신 것을 환영합니다!')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-[40px] overflow-hidden bg-card">
        <CardHeader className="text-center space-y-4 p-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <UserCircle className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-black text-foreground">
            {locale === 'en' ? 'Complete Your Profile' : '프로필 완성하기'}
          </CardTitle>
          <CardDescription className="text-muted-foreground font-medium text-base">
            {locale === 'en' 
              ? 'Tell us a bit about yourself to get started' 
              : '시작하기 전에 간단한 정보를 입력해주세요'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 이름 */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-foreground">
                {locale === 'en' ? 'Name' : '이름'} *
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={locale === 'en' ? 'Enter your name' : '이름을 입력하세요'}
                className="h-12 rounded-xl border-border bg-muted/50 focus:bg-card focus:ring-primary transition-all font-medium"
                required
              />
            </div>

            {/* 성별 */}
            <div className="space-y-3">
              <Label className="text-sm font-bold text-foreground">
                {locale === 'en' ? 'Gender' : '성별'} *
              </Label>
              <RadioGroup value={gender} onValueChange={(v) => setGender(v as '남' | '여')}>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2 flex-1 p-4 rounded-2xl border border-border bg-muted/30 hover:bg-muted transition-colors cursor-pointer">
                    <RadioGroupItem value="남" id="male" />
                    <Label htmlFor="male" className="flex-1 font-bold cursor-pointer">
                      {locale === 'en' ? 'Male' : '남'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 flex-1 p-4 rounded-2xl border border-border bg-muted/30 hover:bg-muted transition-colors cursor-pointer">
                    <RadioGroupItem value="여" id="female" />
                    <Label htmlFor="female" className="flex-1 font-bold cursor-pointer">
                      {locale === 'en' ? 'Female' : '여'}
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* 국적 */}
            <div className="space-y-3">
              <Label className="text-sm font-bold text-foreground">
                {locale === 'en' ? 'Nationality' : '국적'} *
              </Label>
              <RadioGroup value={nationality} onValueChange={(v) => setNationality(v as '한국인' | '외국인')}>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2 flex-1 p-4 rounded-2xl border border-border bg-muted/30 hover:bg-muted transition-colors cursor-pointer">
                    <RadioGroupItem value="한국인" id="korean" />
                    <Label htmlFor="korean" className="flex-1 font-bold cursor-pointer">
                      {locale === 'en' ? 'Korean' : '한국인'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 flex-1 p-4 rounded-2xl border border-border bg-muted/30 hover:bg-muted transition-colors cursor-pointer">
                    <RadioGroupItem value="외국인" id="foreigner" />
                    <Label htmlFor="foreigner" className="flex-1 font-bold cursor-pointer">
                      {locale === 'en' ? 'Foreigner' : '외국인'}
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* 카카오톡 ID */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-foreground">
                {locale === 'en' ? 'KakaoTalk ID' : '카카오톡 ID'} *
              </Label>
              <Input
                value={kakaoId}
                onChange={(e) => setKakaoId(e.target.value)}
                placeholder={locale === 'en' ? 'Enter your KakaoTalk ID' : '카카오톡 ID를 입력하세요'}
                className="h-12 rounded-xl border-border bg-muted/50 focus:bg-card focus:ring-primary transition-all font-medium"
                required
              />
            </div>

            {/* 개인정보 처리방침 동의 */}
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
              <input
                id="privacy-agree"
                type="checkbox"
                checked={privacyAgreed}
                onChange={(e) => setPrivacyAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <Label
                htmlFor="privacy-agree"
                className="text-sm font-medium leading-snug text-muted-foreground cursor-pointer [&_a]:font-bold [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline"
              >
                {locale === 'en' ? (
                  <>
                    I have read and agree to the{' '}
                    <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </Link>
                    . *
                  </>
                ) : (
                  <>
                    <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                      개인정보 처리방침
                    </Link>
                    을 읽었으며 내용에 동의합니다. *
                  </>
                )}
              </Label>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-14 rounded-2xl bg-primary hover:bg-secondary font-black text-lg shadow-lg shadow-primary/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {locale === 'en' ? 'Saving...' : '저장 중...'}
                </>
              ) : (
                locale === 'en' ? 'Complete' : '완료'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
