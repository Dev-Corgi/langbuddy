'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Loader2, Settings, User, Bell, Shield, Save } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'

export default function AdminSettingsPage() {
  const locale = useLocale()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getProfile()
  }, [supabase])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    // Profile update logic could go here
    setTimeout(() => setIsSaving(false), 1000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-10">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Settings className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            {locale === 'en' ? 'Settings' : '설정'}
          </h1>
          <p className="text-muted-foreground font-medium text-sm md:text-base">
            {locale === 'en' ? 'Manage admin account and service environment.' : '관리자 계정 및 서비스 환경을 설정합니다.'}
          </p>
        </div>

        <div className="grid gap-6 md:gap-8">
          {/* Profile Section */}
          <Card className="border-border shadow-sm rounded-[24px] md:rounded-[32px] overflow-hidden border-none bg-card">
            <CardHeader className="p-6 md:p-8 pb-0">
              <div className="flex items-center gap-3 mb-2">
                <User className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-lg md:text-xl font-black">
                  {locale === 'en' ? 'Admin Profile' : '관리자 프로필'}
                </CardTitle>
              </div>
              <CardDescription className="font-bold text-muted-foreground text-sm">
                {locale === 'en' ? 'Check and update your account information.' : '계정 정보를 확인하고 수정합니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <Label className="font-bold text-foreground/70">{locale === 'en' ? 'Email Account' : '이메일 계정'}</Label>
                    <Input 
                      value={user?.email || ''} 
                      disabled 
                      className="h-12 rounded-xl bg-muted border-border text-muted-foreground font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-foreground/70">{locale === 'en' ? 'User UID' : '사용자 UID'}</Label>
                    <Input 
                      value={user?.id || ''} 
                      disabled 
                      className="h-12 rounded-xl bg-muted border-border text-muted-foreground text-[10px] md:text-xs font-mono truncate"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-foreground/70">{locale === 'en' ? 'Last Login' : '마지막 로그인'}</Label>
                  <p className="text-xs md:text-sm font-bold text-muted-foreground">
                    {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR') : '-'}
                  </p>
                </div>
                
                <Separator className="bg-muted" />
                
                <div className="flex justify-end">
                  <Button 
                    disabled={isSaving}
                    className="h-12 px-8 rounded-xl bg-primary hover:bg-secondary font-black shadow-lg shadow-primary/20 w-full md:w-auto"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> {locale === 'en' ? 'Save Changes' : '저장하기'}</>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Service Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <Card className="border-border shadow-sm rounded-[24px] md:rounded-[32px] overflow-hidden border-none bg-card">
              <CardHeader className="p-6 md:p-8 pb-0">
                <div className="flex items-center gap-3 mb-2">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-lg md:text-xl font-black">
                    {locale === 'en' ? 'Notifications' : '알림 설정'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8">
                <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                  {locale === 'en' ? 'Receive notifications for new member registrations or bookings. (Coming Soon)' : '새로운 동아리원 가입이나 예매 신청 시 알림을 받습니다. (준비 중)'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm rounded-[24px] md:rounded-[32px] overflow-hidden border-none bg-card">
              <CardHeader className="p-6 md:p-8 pb-0">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-lg md:text-xl font-black">
                    {locale === 'en' ? 'Security' : '보안 설정'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8">
                <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                  {locale === 'en' ? 'Manage password changes and two-factor authentication. Available in Supabase dashboard.' : '비밀번호 변경 및 2단계 인증을 설정합니다. Supabase 대시보드에서 관리할 수 있습니다.'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
