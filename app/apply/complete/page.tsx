'use client'

import { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { MainNav } from "@/app/_components/main-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, Download, Loader2, QrCode, MessageCircle, Mail } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useLocale } from "@/hooks/use-locale"
import { i18n } from "@/lib/i18n"
import { cn, extractParticipantInfoFromAnswers, type CoreFormQuestion } from "@/lib/utils"
import { initKakaoSDK } from "@/lib/kakao-share"
import { kakaoSendNeedsParticipantKakaoReconnect } from "@/lib/kakao-send-status"
import {
  formatSessionDateLabel,
  resolveApplicationSessionYmd,
  buildRecurringSessionDisplayTitles,
} from "@/lib/session-event-date"
import { toast } from "sonner"

const mailDeliveryProblemToast = (locale: string) =>
  toast.error(
    locale === "en"
      ? "Something went wrong, please contact the administrator."
      : "문제가 발생했습니다, 관리자에게 문의하세요"
  )

export default function ApplicationCompletePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  const supabase = createClient()
  const locale = useLocale()
  const tDict = i18n[locale]
  
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<CoreFormQuestion[]>([])
  const [sendingToKakao, setSendingToKakao] = useState(false)
  const [kakaoSent, setKakaoSent] = useState(false)
  const [kakaoReconnectNeeded, setKakaoReconnectNeeded] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [gmailNotConfigured, setGmailNotConfigured] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [hasKakaoUuid, setHasKakaoUuid] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize Kakao SDK for Share functionality
    const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY
    if (kakaoAppKey) {
      initKakaoSDK(kakaoAppKey)
    }
  }, [])

  useEffect(() => {
    if (!id) {
      router.push('/')
      return
    }

    const responseId = id

    async function fetchData() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      setUser(authUser)

      if (!authUser) {
        const next = `/apply/complete?id=${encodeURIComponent(responseId)}`
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`)
        setLoading(false)
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('kakao_uuid')
        .eq('id', authUser.id)
        .single()

      setHasKakaoUuid(!!userData?.kakao_uuid)

      const { data: response, error } = await supabase
        .from('form_responses')
        .select('*, forms(title, title_en)')
        .eq('id', responseId)
        .single()

      if (error || !response) {
        console.error('Error fetching application:', error)
        router.replace('/')
        setLoading(false)
        return
      }

      if (!response.user_id || response.user_id !== authUser.id) {
        router.replace('/')
        setLoading(false)
        return
      }

      let recurringKind: 'language' | 'study' | null = null
      if (response.form_id) {
        const [{ data: leRow }, { data: stRow }] = await Promise.all([
          supabase
            .from('language_exchange_schedules')
            .select('form_id')
            .eq('form_id', response.form_id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('study_schedules')
            .select('form_id')
            .eq('form_id', response.form_id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle(),
        ])
        recurringKind = leRow ? 'language' : stRow ? 'study' : null
      }

      setData({ ...response, _recurring_kind: recurringKind })
      if (response.form_id) {
        const { data: qData } = await supabase
          .from('form_questions')
          .select('*')
          .eq('form_id', response.form_id)
          .order('display_order', { ascending: true })
        if (qData) {
          setQuestions(qData as any)
        }
      }
      setLoading(false)
    }

    fetchData()
  }, [id, supabase, router])

  /** 입금 대기가 아닐 때 1회: 카카오 연동이면 나에게 보내기, 아니면 이메일(설정 시) */
  useEffect(() => {
    if (loading || !data?.id || !data?.qr_code || !user?.id) return

    const storageKey = `langbuddy_auto_qr_${data.id}`
    const lockKey = `${storageKey}_lock`
    const prev = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null
    if (prev === 'kakao') {
      setKakaoSent(true)
      return
    }
    if (prev === 'email') {
      setEmailSent(true)
      return
    }

    if (typeof window !== 'undefined' && sessionStorage.getItem(lockKey)) return
    if (typeof window !== 'undefined') sessionStorage.setItem(lockKey, '1')

    let cancelled = false

    async function runAutoSend() {
      try {
        if (hasKakaoUuid) {
          setSendingToKakao(true)
          setKakaoReconnectNeeded(false)
          const { data: userData } = await supabase
            .from('users')
            .select('kakao_uuid, name')
            .eq('id', user.id)
            .single()

          if (cancelled || !userData?.kakao_uuid) return

          const nameQuestion = questions.find((q) => q.system_key === 'name')
          const userName = nameQuestion ? data.answers?.[nameQuestion.id] : userData.name || 'User'
          const displayDayAuto =
            typeof data.answers?._selected_day === 'string' ? data.answers._selected_day : ''
          const sessionYmdAuto = resolveApplicationSessionYmd(
            displayDayAuto,
            data.answers?._event_date,
            data.created_at as string
          )
          const kind = data._recurring_kind as 'language' | 'study' | null | undefined
          const builtAuto =
            kind && sessionYmdAuto.length >= 10
              ? buildRecurringSessionDisplayTitles(displayDayAuto, sessionYmdAuto, kind)
              : null
          const ft = builtAuto
            ? locale === 'en'
              ? builtAuto.title_en
              : builtAuto.title
            : (locale === 'en' && data.forms?.title_en ? data.forms.title_en : data.forms?.title) ||
              'LangBuddy'

          const res = await fetch('/api/send-kakao-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kakaoId: userData.kakao_uuid,
              qrCode: data.qr_code,
              formTitle: ft,
              name: userName,
              responseId: data.id,
              userId: user.id,
            }),
          })
          const result = await res.json()
          if (cancelled) return
          if (res.ok && result.success) {
            sessionStorage.setItem(storageKey, 'kakao')
            setKakaoSent(true)
          } else if (kakaoSendNeedsParticipantKakaoReconnect(result.kakaoSendStatus)) {
            setKakaoReconnectNeeded(true)
          }
        } else if (user.email) {
          setSendingEmail(true)
          setGmailNotConfigured(false)
          const res = await fetch('/api/send-qr-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              responseId: data.id,
              locale: locale === 'en' ? 'en' : 'ko',
            }),
          })
          const result = await res.json()
          if (cancelled) return
          if (res.ok && result.ok) {
            sessionStorage.setItem(storageKey, 'email')
            setEmailSent(true)
          } else if (result.error === 'email_not_configured') {
            setGmailNotConfigured(true)
          } else {
            mailDeliveryProblemToast(locale)
          }
        }
      } catch (e) {
        console.error('Auto QR delivery:', e)
        if (!cancelled) mailDeliveryProblemToast(locale)
      } finally {
        if (typeof window !== 'undefined') sessionStorage.removeItem(lockKey)
        if (!cancelled) {
          setSendingToKakao(false)
          setSendingEmail(false)
        }
      }
    }

    runAutoSend()
    return () => {
      cancelled = true
      if (typeof window !== 'undefined' && !sessionStorage.getItem(storageKey)) {
        sessionStorage.removeItem(lockKey)
      }
    }
  }, [
    loading,
    data?.id,
    data?.qr_code,
    data?.payment_status,
    data?.answers,
    data?.forms,
    user?.id,
    user?.email,
    hasKakaoUuid,
    questions,
    supabase,
    locale,
  ])

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      canvas.width = img.width + 40
      canvas.height = img.height + 40
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 20, 20)
        const pngUrl = canvas.toDataURL('image/png')
        const downloadLink = document.createElement('a')
        downloadLink.href = pngUrl
        downloadLink.download = `LangBuddy-QR-${id?.slice(0, 8)}.png`
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
      }
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const handleReconnectKakao = async () => {
    if (!data?.id || typeof window === 'undefined') return
    const next = `/apply/complete?id=${encodeURIComponent(data.id)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: 'profile_nickname profile_image account_email talk_message',
      },
    })
    if (error) {
      alert(
        locale === 'en'
          ? `Could not start Kakao login: ${error.message}`
          : `카카오 로그인을 시작하지 못했습니다: ${error.message}`
      )
    }
  }

  const handleSendToKakao = async () => {
    if (!data || sendingToKakao) return
    
    setSendingToKakao(true)
    try {
      setKakaoReconnectNeeded(false)
      if (!user || !hasKakaoUuid) {
        alert(locale === 'en' ? 'Please login with Kakao to send QR' : '카카오 로그인이 필요합니다')
        return
      }

      // Get user's kakao_uuid from database
      const { data: userData } = await supabase
        .from('users')
        .select('kakao_uuid, name')
        .eq('id', user.id)
        .single()

      if (!userData?.kakao_uuid) {
        alert(locale === 'en' ? 'Kakao UUID not found' : '카카오 정보를 찾을 수 없습니다')
        return
      }

      const nameQuestion = questions.find(q => q.system_key === 'name')
      const userName = nameQuestion ? data.answers?.[nameQuestion.id] : userData.name || 'User'

      // Call server API to send via Kakao Channel Message
      const response = await fetch('/api/send-kakao-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kakaoId: userData.kakao_uuid,
          qrCode: data.qr_code,
          formTitle: formTitle,
          name: userName,
          responseId: data.id,
          userId: user.id,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        if (kakaoSendNeedsParticipantKakaoReconnect(result.kakaoSendStatus)) {
          setKakaoReconnectNeeded(true)
          return
        }
        const msg =
          locale === 'en'
            ? result.messageEn || result.message || 'Could not send via KakaoTalk.'
            : result.message || '카카오톡으로 보내지 못했습니다.'
        alert(msg)
        return
      }

      setKakaoReconnectNeeded(false)
      setKakaoSent(true)
      alert(locale === 'en' ? 'Check your KakaoTalk chat with yourself (memo).' : '카카오톡 「나와의 채팅」에서 메모를 확인해 주세요.')
    } catch (error) {
      console.error('Error sending to Kakao:', error)
      alert(locale === 'en' ? 'Failed to send to KakaoTalk' : '카카오톡 전송에 실패했습니다')
    } finally {
      setSendingToKakao(false)
    }
  }

  const handleSendQrEmail = async () => {
    if (!data || !user?.email || sendingEmail) return
    setSendingEmail(true)
    try {
      const response = await fetch('/api/send-qr-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseId: data.id,
          locale: locale === 'en' ? 'en' : 'ko',
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) {
        if (result.error === 'email_not_configured') {
          setGmailNotConfigured(true)
        }
        mailDeliveryProblemToast(locale)
        return
      }
      setEmailSent(true)
      toast.success(
        locale === 'en'
          ? `We sent the QR to ${user.email}`
          : `${user.email} 으로 QR 안내 메일을 보냈습니다. 스팸함도 확인해 주세요.`
      )
    } catch (e) {
      console.error(e)
      mailDeliveryProblemToast(locale)
    } finally {
      setSendingEmail(false)
    }
  }

  const handleKakaoShare = () => {
    // Fallback: Use Kakao Share SDK for non-logged-in users
    if (typeof window !== 'undefined' && window.Kakao) {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: '🎉 LangBuddy 신청 완료!',
          description: `${formTitle}\n\nQR 코드를 확인하세요!`,
          imageUrl: 'https://via.placeholder.com/400x400.png?text=QR+Code',
          link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href,
          },
        },
        buttons: [
          {
            title: 'QR 코드 확인하기',
            link: {
              mobileWebUrl: window.location.href,
              webUrl: window.location.href,
            },
          },
        ],
      })
    } else {
      alert(locale === 'en' ? 'Kakao SDK not loaded' : '카카오톡 공유 기능을 사용할 수 없습니다')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  const formTitleRaw = locale === 'en' && data.forms?.title_en ? data.forms.title_en : data.forms?.title
  const participantInfo = extractParticipantInfoFromAnswers(data.answers || {}, questions)
  const displayName = participantInfo.name || data.answers?.name || data.answers?.이름 || 'Anonymous'
  const displayLanguage = data.answers?._selected_language || participantInfo.language || '-'
  const displayDay = data.answers?._selected_day || participantInfo.day || '-'
  const sessionYmd = data?.created_at
    ? resolveApplicationSessionYmd(
        displayDay !== '-' ? displayDay : '',
        data.answers?._event_date,
        data.created_at as string
      )
    : ''
  const sessionDateLabel =
    sessionYmd && sessionYmd.length >= 10
      ? formatSessionDateLabel(sessionYmd, locale === 'en' ? 'en' : 'ko')
      : ''
  const recurringKind = data?._recurring_kind as 'language' | 'study' | null | undefined
  const builtSessionTitles =
    recurringKind && sessionYmd.length >= 10
      ? buildRecurringSessionDisplayTitles(
          displayDay !== '-' ? displayDay : '',
          sessionYmd,
          recurringKind
        )
      : null
  const formTitle = builtSessionTitles
    ? locale === 'en'
      ? builtSessionTitles.title_en
      : builtSessionTitles.title
    : (typeof formTitleRaw === 'string' && formTitleRaw.trim()) || ''
  const displayPayment = data.answers?._payment_method || (locale === 'en' ? 'On-site' : '현장 결제')
  const isBankTransfer = displayPayment === '계좌송금'
  const isPaymentPending = isBankTransfer && data.payment_status === 'pending'

  return (
    <div className="min-h-screen bg-muted overflow-x-hidden">
      <MainNav />
      <main className="mx-auto max-w-2xl w-full px-4 md:px-6 py-12 md:py-20">
        <div className="text-center space-y-6 mb-10">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
              {locale === 'en' ? 'Application Confirmed!' : '신청이 완료되었습니다!'}
            </h1>
            {builtSessionTitles ? (
              <p className="text-lg font-black text-primary tracking-tight">{formTitle}</p>
            ) : sessionDateLabel ? (
              <p className="text-lg font-black text-primary tracking-tight">
                {locale === 'en' ? `Session: ${sessionDateLabel}` : `참석 예정: ${sessionDateLabel}`}
              </p>
            ) : null}
            {!builtSessionTitles && formTitle ? (
              <p className="text-lg text-muted-foreground font-medium">{formTitle}</p>
            ) : null}
          </div>
        </div>

        <Card className="border-none shadow-2xl rounded-[40px] overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-8 duration-700">
          <CardHeader className="p-8 pb-0 text-center">
            <CardTitle className="text-xl font-black flex items-center justify-center gap-2">
              <QrCode className="w-6 h-6 text-primary" />
              {locale === 'en' ? 'Your Personal QR Code' : '나의 입장용 QR 코드'}
            </CardTitle>
            <CardDescription className="text-muted-foreground font-bold pt-2">
              {locale === 'en'
                ? 'Please show this QR code to the staff at the venue.'
                : '행사 현장에서 운영진에게 이 QR 코드를 보여주세요.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 md:p-12 space-y-10">
            {isPaymentPending ? (
              <div className="p-6 rounded-3xl bg-amber-50 border-2 border-amber-200 text-center space-y-2">
                <p className="text-sm font-bold text-amber-900">
                  {locale === 'en' ? 'Bank transfer pending verification' : '계좌 이체 입금 확인 대기'}
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {locale === 'en'
                    ? 'Please complete the transfer below. Admin confirmation is for record-keeping only; your QR is available now and sent via Kakao or email if linked.'
                    : '아래 계좌로 입금해 주세요. 관리자 확인은 입금 기록용이며, QR은 아래·카카오·이메일로 바로 이용하실 수 있습니다.'}
                </p>
              </div>
            ) : null}
            <>
                {(sendingToKakao || sendingEmail) && !kakaoSent && !emailSent ? (
                  <p className="text-center text-sm font-bold text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {locale === 'en'
                      ? 'Sending your QR to Kakao or email…'
                      : 'QR 코드를 카카오톡 또는 이메일로 보내는 중…'}
                  </p>
                ) : null}
                {gmailNotConfigured && user?.email && !hasKakaoUuid ? (
                  <div
                    role="status"
                    className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-950 text-center leading-relaxed"
                  >
                    {locale === 'en'
                      ? 'Automatic email is off: set GMAIL_USER and GMAIL_APP_PASSWORD on the server (Gmail SMTP). You can still save the QR image below.'
                      : 'Gmail SMTP가 서버에 설정되지 않아 이메일 자동 발송을 할 수 없습니다. GMAIL_USER·GMAIL_APP_PASSWORD를 설정하거나 아래에서 QR을 저장해 주세요.'}
                  </div>
                ) : null}
                <div 
                  ref={qrRef}
                  className="relative aspect-square max-w-[280px] mx-auto p-6 bg-white rounded-3xl shadow-inner border-8 border-muted flex items-center justify-center"
                >
                  <QRCodeSVG 
                    value={data.qr_code || ""} 
                    size={240}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <div className="space-y-4">
                  {user && hasKakaoUuid && kakaoReconnectNeeded && (
                    <div
                      role="status"
                      className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 text-left space-y-3"
                    >
                      <p className="text-sm font-bold text-amber-950">
                        {locale === 'en'
                          ? 'Your Kakao connection expired or needs to be renewed.'
                          : '카카오 연결이 만료되었거나 다시 연결이 필요합니다.'}
                      </p>
                      <p className="text-sm text-amber-900/90 leading-relaxed">
                        {locale === 'en'
                          ? 'Sign in with Kakao again, then tap “Send to Kakao (me)” once more. You will return to this page after login.'
                          : '아래에서 카카오로 다시 로그인한 뒤「카카오톡 나에게 보내기」를 다시 눌러 주세요. 로그인 후 이 페이지로 돌아옵니다.'}
                      </p>
                      <Button
                        type="button"
                        onClick={handleReconnectKakao}
                        className="w-full h-12 rounded-xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#000000] font-black"
                      >
                        <MessageCircle className="w-5 h-5 mr-2" />
                        {locale === 'en' ? 'Reconnect Kakao' : '카카오 다시 연결'}
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button 
                      onClick={handleDownloadQR}
                      className="h-14 rounded-2xl bg-primary hover:bg-secondary font-black text-lg shadow-lg shadow-primary/20"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      {locale === 'en' ? 'Save QR' : 'QR 저장'}
                    </Button>
                    
                    {user && hasKakaoUuid ? (
                      <Button 
                        onClick={handleSendToKakao}
                        disabled={sendingToKakao || kakaoSent}
                        className="h-14 rounded-2xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#000000] font-black text-lg shadow-lg"
                      >
                        {sendingToKakao ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <MessageCircle className="w-5 h-5 mr-2" />
                        )}
                        {kakaoSent
                          ? locale === 'en'
                            ? 'Sent to Kakao'
                            : '카카오 전송 완료'
                          : locale === 'en'
                            ? 'Send to Kakao (me)'
                            : '카카오톡 나에게 보내기'}
                      </Button>
                    ) : user?.email && !hasKakaoUuid ? (
                      <Button
                        onClick={handleSendQrEmail}
                        disabled={sendingEmail || emailSent}
                        variant="secondary"
                        className="h-14 rounded-2xl font-black text-lg shadow-lg border-2 border-border"
                      >
                        {sendingEmail ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Mail className="w-5 h-5 mr-2" />
                        )}
                        {emailSent
                          ? locale === 'en'
                            ? 'Email sent'
                            : '메일 발송 완료'
                          : locale === 'en'
                            ? 'Email me the QR'
                            : 'QR을 이메일로 받기'}
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleKakaoShare}
                        className="h-14 rounded-2xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#000000] font-black text-lg shadow-lg"
                      >
                        <MessageCircle className="w-5 h-5 mr-2" />
                        {locale === 'en' ? 'Share to Kakao' : '카카오톡 공유'}
                      </Button>
                    )}
                  </div>
                </div>
            </>

            <div className="p-6 rounded-3xl bg-muted/50 border border-border space-y-4">
              {/* 선택 요일 */}
              {displayDay && displayDay !== '-' && (
                <div className="flex justify-between items-center text-sm border-b border-border pb-3">
                  <span className="text-muted-foreground font-bold">{locale === 'en' ? 'Day' : '선택 요일'}</span>
                  <span className="text-foreground font-black">{displayDay}</span>
                </div>
              )}
              {sessionDateLabel ? (
                <div className="flex justify-between items-center text-sm border-b border-border pb-3">
                  <span className="text-muted-foreground font-bold">
                    {locale === 'en' ? 'Session date' : '참석 예정일'}
                  </span>
                  <span className="text-foreground font-black">{sessionDateLabel}</span>
                </div>
              ) : null}
              
              {/* QR 표시 질문들 */}
              {questions.filter(q => q.show_in_qr || q.system_key).map((q, idx) => {
                const qText = locale === 'en' && q.question_text_en ? q.question_text_en : q.question_text
                const answer = data.answers?.[q.id]
                const displayAnswer = Array.isArray(answer) ? answer.join(', ') : (answer || '-')
                
                return (
                  <div key={q.id || idx} className="flex justify-between items-center text-sm border-b border-border pb-3">
                    <span className="text-muted-foreground font-bold">{qText}</span>
                    <span className="text-foreground font-black break-all">{displayAnswer}</span>
                  </div>
                )
              })}
              
              {/* 결제 상태 */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-bold">{locale === 'en' ? 'Status' : '결제 상태'}</span>
                <span className={cn(
                  "font-black",
                  isPaymentPending ? "text-amber-500" : "text-primary"
                )}>
                  {isPaymentPending 
                    ? (locale === 'en' ? 'Payment Pending' : '입금 확인중')
                    : displayPayment
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-12 text-center">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/')}
            className="text-muted-foreground font-bold hover:text-primary transition-colors"
          >
            {locale === 'en' ? 'Return to Home' : '홈으로 돌아가기'}
          </Button>
        </div>
      </main>
    </div>
  )
}
