'use client'

import { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { MainNav } from "@/app/_components/main-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, Download, Loader2, QrCode } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useLocale } from "@/hooks/use-locale"
import { i18n } from "@/lib/i18n"
import { cn, extractParticipantInfoFromAnswers, type CoreFormQuestion } from "@/lib/utils"
import {
  formatSessionDateLabel,
  resolveApplicationSessionYmd,
  buildRecurringSessionDisplayTitles,
} from "@/lib/session-event-date"
import {
  formatPaymentMethodLabel,
  isBankTransferMethod,
} from "@/lib/supported-payment-methods"
import { buildOnboardingUrl, isOnboardingCompleted } from '@/lib/onboarding-gate'

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
  const qrRef = useRef<HTMLDivElement>(null)

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

      if (!authUser) {
        const next = `/apply/complete?id=${encodeURIComponent(responseId)}`
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`)
        setLoading(false)
        return
      }

      const onboarded = await isOnboardingCompleted(supabase, authUser.id)
      if (!onboarded) {
        router.replace(
          buildOnboardingUrl(`/apply/complete?id=${encodeURIComponent(responseId)}`)
        )
        setLoading(false)
        return
      }

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

      let recurringKind: 'language' | null = null
      if (response.form_id) {
        const { data: leRow } = await supabase
          .from('language_exchange_schedules')
          .select('form_id')
          .eq('form_id', response.form_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
        recurringKind = leRow ? 'language' : null
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
  const recurringKind = data?._recurring_kind as 'language' | null | undefined
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
  const displayPayment =
    formatPaymentMethodLabel(data.answers?._payment_method, data.payment_status) ||
    (locale === 'en' ? 'On-site' : '현장 결제')
  const isBankTransfer = isBankTransferMethod(data.answers?._payment_method)
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
                    ? 'Please complete the transfer below. Admin confirmation is for record-keeping only; your QR is available on this page.'
                    : '아래 계좌로 입금해 주세요. 관리자 확인은 입금 기록용이며, QR은 이 페이지에서 바로 확인하실 수 있습니다.'}
                </p>
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

            <Button
              onClick={handleDownloadQR}
              className="w-full h-14 rounded-2xl bg-primary hover:bg-secondary font-black text-lg shadow-lg shadow-primary/20"
            >
              <Download className="w-5 h-5 mr-2" />
              {locale === 'en' ? 'Save QR' : 'QR 저장'}
            </Button>

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
