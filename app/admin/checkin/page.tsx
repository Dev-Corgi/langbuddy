'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, QrCode, Search, UserCheck, UserX, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function AdminCheckinPage() {
  const locale = useLocale()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [todaySession, setTodaySession] = useState<any>(null)
  const [scannerActive, setScannerActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchQueryResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    async function checkAuthAndFetchSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/admin/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_superadmin && user.email !== 'pomato5959@gmail.com') {
        window.location.href = '/admin/dashboard'
        return
      }

      setIsSuperAdmin(true)

      // Fetch today's or next language exchange session
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]

      const { data: sessions } = await supabase
        .from('postings')
        .select('*')
        .eq('category', '언어교환')
        .eq('status', 'active')
        .order('date', { ascending: true })
      
      // Find session for today or nearest future
      const session = sessions?.find(s => s.date >= todayStr) || sessions?.[0]
      setTodaySession(session)
      setLoading(false)
    }

    checkAuthAndFetchSession()
  }, [supabase])

  useEffect(() => {
    if (scannerActive && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      )
      
      scanner.render(onScanSuccess, onScanFailure)
      scannerRef.current = scanner
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
        scannerRef.current = null
      }
    }
  }, [scannerActive])

  async function onScanSuccess(decodedText: string) {
    if (!todaySession) return
    
    // Stop scanner briefly to process
    setScannerActive(false)
    
    try {
      const { data, error } = await supabase
        .from('form_responses')
        .select('*, forms(title)')
        .eq('qr_code', decodedText)
        .eq('form_id', todaySession.form_id)
        .single()

      if (error || !data) {
        toast.error(locale === 'en' ? 'Invalid QR code for this session.' : '유효하지 않은 QR 코드이거나 현재 세션 신청자가 아닙니다.')
        setScannerActive(true)
        return
      }

      if (data.checked_in_at) {
        toast.info(locale === 'en' ? `${data.answers?.name || 'User'} is already checked in.` : `${data.answers?.name || '참가자'}님은 이미 출석 처리되었습니다.`)
        setScannerActive(true)
        return
      }

      const { error: updateError } = await supabase
        .from('form_responses')
        .update({ checked_in_at: new Date().toISOString() })
        .eq('id', data.id)

      if (updateError) throw updateError

      toast.success(locale === 'en' ? `Check-in successful: ${data.answers?.name}` : `출석 확인: ${data.answers?.name}님`)
      
      // Vibrations if supported
      if ('vibrate' in navigator) navigator.vibrate(200)
      
    } catch (err) {
      console.error(err)
      toast.error(locale === 'en' ? 'Check-in failed.' : '출석 처리에 실패했습니다.')
    }
    
    // Resume scanner after delay
    setTimeout(() => setScannerActive(true), 2000)
  }

  function onScanFailure(error: any) {
    // Silent failure for scanner scanning frames
  }

  const handleManualSearch = async () => {
    if (!todaySession || searchQuery.length < 2) return
    
    setIsSearching(true)
    try {
      // Since answers is JSONB, we might need a more complex query or fetch all and filter
      // For now, let's fetch all responses for this form and filter in JS for simplicity
      const { data } = await supabase
        .from('form_responses')
        .select('*')
        .eq('form_id', todaySession.form_id)

      if (data) {
        const filtered = data.filter(r => {
          const name = r.answers?.name || r.answers?.이름 || ''
          return name.toLowerCase().includes(searchQuery.toLowerCase())
        })
        setSearchQueryResults(filtered)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  const handleManualCheckin = async (participantId: string, name: string) => {
    try {
      const { error } = await supabase
        .from('form_responses')
        .update({ checked_in_at: new Date().toISOString() })
        .eq('id', participantId)

      if (error) throw error

      toast.success(locale === 'en' ? `Manual check-in successful: ${name}` : `수동 출석 완료: ${name}님`)
      
      // Update local state
      setSearchQueryResults(prev => prev.map(r => 
        r.id === participantId ? { ...r, checked_in_at: new Date().toISOString() } : r
      ))
    } catch (err) {
      console.error(err)
      toast.error(locale === 'en' ? 'Check-in failed.' : '출석 처리에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-10 bg-muted/30 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link 
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {locale === 'en' ? 'Back to Dashboard' : '대시보드로 돌아가기'}
          </Link>
          <div className="flex items-center justify-between pt-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
              <QrCode className="w-8 h-8 text-primary" />
              {locale === 'en' ? 'Check-in Scanner' : '현장 출석 스캐너'}
            </h1>
          </div>
          {todaySession ? (
            <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-primary uppercase tracking-wider">{todaySession.category}</p>
                <h3 className="font-bold text-foreground">{todaySession.title}</h3>
                <p className="text-xs text-muted-foreground font-medium">{todaySession.date} • {todaySession.location}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-xl font-bold">
                <Link href="/admin/arrange">{locale === 'en' ? 'Arrange Seats' : '자리 배치하기'}</Link>
              </Button>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="font-bold text-destructive">
                {locale === 'en' ? 'No active session found for today.' : '오늘 진행되는 활성 세션이 없습니다.'}
              </p>
            </div>
          )}
        </header>

        <div className="grid gap-6">
          {/* QR Scanner Card */}
          <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-black">{locale === 'en' ? 'QR Scanner' : 'QR 코드 스캔'}</CardTitle>
              <CardDescription className="font-medium">
                {locale === 'en' ? 'Scan the participant\'s QR code to check in.' : '참가자의 QR 코드를 스캔하여 출석을 확인하세요.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!scannerActive ? (
                <Button 
                  onClick={() => setScannerActive(true)}
                  disabled={!todaySession}
                  className="w-full h-32 rounded-3xl bg-primary hover:bg-secondary text-xl font-black flex flex-col gap-2"
                >
                  <QrCode className="w-10 h-10" />
                  {locale === 'en' ? 'Start Scanner' : '스캐너 시작하기'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div id="qr-reader" className="overflow-hidden rounded-2xl border-4 border-muted" />
                  <Button 
                    variant="outline" 
                    onClick={() => setScannerActive(false)}
                    className="w-full h-12 rounded-xl font-bold"
                  >
                    {locale === 'en' ? 'Stop Scanner' : '스캐너 중지'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Search Card */}
          <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-black">{locale === 'en' ? 'Manual Search' : '수동 이름 검색'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder={locale === 'en' ? 'Enter name...' : '이름을 입력하세요'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                    className="h-12 pl-10 rounded-xl border-border bg-muted/30 font-medium"
                  />
                </div>
                <Button 
                  onClick={handleManualSearch}
                  disabled={isSearching || searchQuery.length < 2}
                  className="h-12 px-6 rounded-xl font-black"
                >
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : (locale === 'en' ? 'Search' : '검색')}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  {searchResults.map((result) => {
                    const name = result.answers?.name || result.answers?.이름 || 'Anonymous'
                    const lang = result.answers?._selected_language || '-'
                    const checkedIn = !!result.checked_in_at
                    
                    return (
                      <div 
                        key={result.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all",
                          checkedIn ? "bg-emerald-50/50 border-emerald-100" : "bg-muted/30 border-border"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-black",
                            checkedIn ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"
                          )}>
                            {name[0]}
                          </div>
                          <div>
                            <p className="font-black text-foreground">{name}</p>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-tight">{lang}</p>
                          </div>
                        </div>
                        {checkedIn ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-black">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {locale === 'en' ? 'Checked-in' : '출석 완료'}
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            onClick={() => handleManualCheckin(result.id, name)}
                            className="rounded-full font-black px-4 bg-primary hover:bg-secondary"
                          >
                            <UserCheck className="w-4 h-4 mr-1.5" />
                            {locale === 'en' ? 'Check-in' : '출석'}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              
              {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                <div className="text-center py-8 text-muted-foreground">
                  <UserX className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">{locale === 'en' ? 'No participants found.' : '검색된 참가자가 없습니다.'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
