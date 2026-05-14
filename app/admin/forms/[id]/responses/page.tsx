'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { 
  ChevronLeft, 
  Loader2, 
  Download,
  User,
  Calendar,
  ClipboardList,
  CreditCard,
  CheckCircle2,
  ImageIcon,
  MessageCircle,
  Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useLocale } from '@/hooks/use-locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  kakaoParticipantReconnectAdminHint,
  kakaoSendNeedsParticipantKakaoReconnect,
} from '@/lib/kakao-send-status'

export default function FormResponsesPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const locale = useLocale()
  const supabase = createClient()
  
  const [form, setForm] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [responses, setResponses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [sendingQR, setSendingQR] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch form info
      const { data: formData } = await supabase
        .from('forms')
        .select('*')
        .eq('id', id)
        .single()
      
      if (formData) {
        setForm(formData)
        
        // 2. Fetch questions
        const { data: questionData } = await supabase
          .from('form_questions')
          .select('*')
          .eq('form_id', id)
          .order('display_order', { ascending: true })
        
        if (questionData) setQuestions(questionData)

        // 3. Fetch responses
        const { data: responseData } = await supabase
          .from('form_responses')
          .select('*')
          .eq('form_id', id)
          .order('created_at', { ascending: false })
        
        if (responseData) setResponses(responseData)
      }
      setLoading(false)
    }
    fetchData()
  }, [id, supabase])

  // Confirm payment and send QR via KakaoTalk
  const handleConfirmPayment = async (response: any) => {
    setConfirmingId(response.id)
    
    try {
      // 1. Update payment status to confirmed
      const { error: updateError } = await supabase
        .from('form_responses')
        .update({ 
          payment_status: 'confirmed'
        })
        .eq('id', response.id)

      if (updateError) {
        toast.error(locale === 'en' ? 'Failed to confirm payment' : '입금 확인에 실패했습니다')
        return
      }

      // 2. Send QR to KakaoTalk
      setSendingQR(response.id)
      
      // Get user's kakao_uuid from database
      const { data: userData } = await supabase
        .from('users')
        .select('id, kakao_uuid, name, kakao_access_token, kakao_token_expires_at')
        .eq('id', response.user_id)
        .single()

      if (!userData?.kakao_uuid) {
        toast.warning(locale === 'en' ? 'User has no Kakao UUID' : '사용자의 카카오 UUID가 없습니다')
        setSendingQR(null)
        setConfirmingId(null)
        // Refresh data
        const { data: updatedResponses } = await supabase
          .from('form_responses')
          .select('*')
          .eq('form_id', id)
          .order('created_at', { ascending: false })
        if (updatedResponses) setResponses(updatedResponses)
        return
      }

      const nameQuestion = questions.find(q => q.system_key === 'name')
      const userName = nameQuestion ? response.answers?.[nameQuestion.id] : userData.name || 'User'

      // Call server API to send via Kakao
      const kakaoResponse = await fetch('/api/send-kakao-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kakaoId: userData.kakao_uuid,
          qrCode: response.qr_code,
          formTitle: form?.title || 'LangBuddy',
          name: userName,
          responseId: response.id,
          userId: userData.id,
        }),
      })

      const result = await kakaoResponse.json()

      if (result.success) {
        toast.success(locale === 'en' ? 'Payment confirmed and QR sent!' : '입금 확인 완료 및 QR 전송됨!')
      } else {
        const detail = typeof result.message === 'string' ? result.message : ''
        const reconnect = kakaoSendNeedsParticipantKakaoReconnect(result.kakaoSendStatus)
        const hint = reconnect ? ` ${kakaoParticipantReconnectAdminHint(locale)}` : ''
        toast.warning(
          (locale === 'en'
            ? 'Payment confirmed but Kakao send failed.'
            : '입금은 확인되었으나 카카오 전송에 실패했습니다.') +
            (detail ? `: ${detail}` : '') +
            (hint ? ` ${hint}` : '')
        )
      }

      // Refresh data
      const { data: updatedResponses } = await supabase
        .from('form_responses')
        .select('*')
        .eq('form_id', id)
        .order('created_at', { ascending: false })
      if (updatedResponses) setResponses(updatedResponses)

    } catch (error) {
      console.error('Error confirming payment:', error)
      toast.error(locale === 'en' ? 'Failed to confirm payment' : '입금 확인에 실패했습니다')
    } finally {
      setSendingQR(null)
      setConfirmingId(null)
    }
  }

  const exportToCSV = () => {
    if (responses.length === 0) return

    // Header: Date, UserID, Questions...
    const headers = [
      locale === 'en' ? 'Date' : '신청일시',
      locale === 'en' ? 'Selected Day' : '선택한 요일',
      locale === 'en' ? 'Selected Language' : '선택한 언어',
      ...questions.map(q => q.question_text)
    ]

    const rows = responses.map(r => {
      const date = new Date(r.created_at).toLocaleString()
      const day = r.answers?._selected_day || ''
      const lang = r.answers?._selected_language || ''
      const answers = questions.map(q => {
        const val = r.answers[q.id]
        if (Array.isArray(val)) return val.join(', ')
        return val || ''
      })
      return [date, day, lang, ...answers]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `responses_${form.title}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted p-4 md:p-10 pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors mb-2 text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              {locale === 'en' ? 'Back' : '뒤로가기'}
            </button>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
              {locale === 'en' ? 'Form Responses' : '신청 응답 확인'}
            </h1>
            <p className="text-muted-foreground font-medium text-sm md:text-base">
              {form?.title}
            </p>
          </div>
          
          <Button 
            onClick={exportToCSV}
            disabled={responses.length === 0}
            className="bg-emerald-500 hover:bg-emerald-600 rounded-2xl h-12 px-6 font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 w-full md:w-auto"
          >
            <Download className="w-5 h-5" />
            {locale === 'en' ? 'Export CSV' : '엑셀(CSV) 다운로드'}
          </Button>
        </div>

        {responses.length === 0 ? (
          <Card className="border-dashed border-2 border-border bg-transparent rounded-[32px]">
            <CardContent className="py-32 text-center">
              <p className="text-xl font-black text-muted-foreground/60">
                {locale === 'en' ? 'No responses yet.' : '아직 접수된 신청이 없습니다.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-muted-foreground font-bold px-2">
              <ClipboardList className="w-5 h-5" />
              <span>{locale === 'en' ? `Total ${responses.length} responses` : `총 ${responses.length}건의 응답`}</span>
            </div>

            <div className="grid gap-6">
              {responses.map((res, rIdx) => (
                <Card key={res.id} className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
                  <CardHeader className="bg-muted/50 border-b border-border px-8 py-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-foreground">
                            {locale === 'en' ? `Response #${responses.length - rIdx}` : `응답 #${responses.length - rIdx}`}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold">
                            <Calendar className="w-3 h-3" />
                            {new Date(res.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {/* Payment Status Badge */}
                      {res.answers?._payment_method === '계좌송금' && (
                        <div className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5",
                          res.payment_status === 'confirmed' 
                            ? "bg-emerald-100 text-emerald-700" 
                            : "bg-amber-100 text-amber-700"
                        )}>
                          {res.payment_status === 'confirmed' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {locale === 'en' ? 'Confirmed' : '입금 확인됨'}
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              {locale === 'en' ? 'Pending' : '입금 대기중'}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="grid gap-8 md:grid-cols-2">
                      {/* Payment Info Section */}
                      {res.answers?._payment_method && (
                        <div className="md:col-span-2 p-5 rounded-2xl bg-muted border border-border space-y-4">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold text-foreground">
                              {locale === 'en' ? 'Payment Information' : '결제 정보'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">{locale === 'en' ? 'Method' : '결제 방식'}</p>
                              <p className="font-black text-foreground">{res.answers._payment_method}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">{locale === 'en' ? 'Status' : '결제 상태'}</p>
                              <p className={cn(
                                "font-black",
                                res.payment_status === 'confirmed' ? "text-emerald-600" : "text-amber-600"
                              )}>
                                {res.payment_status === 'confirmed' 
                                  ? (locale === 'en' ? 'Confirmed' : '확인 완료')
                                  : (locale === 'en' ? 'Pending' : '확인 대기중')
                                }
                              </p>
                            </div>
                          </div>

                          {/* Payment Receipt */}
                          {res.payment_receipt_url && (
                            <div className="space-y-2 pt-3 border-t border-border">
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                {locale === 'en' ? 'Payment Receipt' : '입금 영수증'}
                              </p>
                              <a 
                                href={res.payment_receipt_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block relative aspect-video max-w-sm rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={res.payment_receipt_url} 
                                  alt="Payment receipt" 
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            </div>
                          )}

                          {/* Confirm Payment Button - only for bank transfer + pending */}
                          {res.answers._payment_method === '계좌송금' && res.payment_status !== 'confirmed' && (
                            <div className="pt-2">
                              <Button
                                onClick={() => handleConfirmPayment(res)}
                                disabled={confirmingId === res.id}
                                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                              >
                                {confirmingId === res.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {sendingQR === res.id 
                                      ? (locale === 'en' ? 'Sending QR...' : 'QR 전송중...')
                                      : (locale === 'en' ? 'Confirming...' : '확인중...')
                                    }
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    {locale === 'en' ? 'Confirm Payment & Send QR' : '입금 확인 및 QR 전송'}
                                  </>
                                )}
                              </Button>
                              <p className="text-xs text-muted-foreground mt-2 text-center">
                                {locale === 'en' 
                                  ? 'Click to verify payment and send QR code via KakaoTalk'
                                  : '클릭하면 입금이 확인되고 카카오톡으로 QR이 전송됩니다'}
                              </p>
                            </div>
                          )}

                          {/* Already confirmed message */}
                          {res.answers._payment_method === '계좌송금' && res.payment_status === 'confirmed' && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span className="text-sm font-bold text-emerald-700">
                                {locale === 'en' ? 'Payment verified & QR sent' : '입금 확인 완료 및 QR 전송됨'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <Separator className="md:col-span-2 my-2 opacity-50" />

                      {/* Special Study Fields */}
                      {res.answers?._selected_day && (
                        <div className="space-y-2 p-4 rounded-2xl bg-accent border border-border">
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                            {locale === 'en' ? 'Selected Day' : '선택한 요일'}
                          </p>
                          <p className="font-black text-accent-foreground text-lg">
                            {res.answers._selected_day}{locale === 'ko' ? '요일' : ''}
                          </p>
                        </div>
                      )}
                      {res.answers?._selected_language && (
                        <div className="space-y-2 p-4 rounded-2xl bg-zinc-950 border border-border">
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                            {locale === 'en' ? 'Selected Language' : '선택한 언어'}
                          </p>
                          <p className="font-black text-white text-lg">
                            {res.answers._selected_language}
                          </p>
                        </div>
                      )}

                      <Separator className="md:col-span-2 my-2 opacity-50" />

                      {questions.map((q) => {
                        const answer = res.answers[q.id]
                        return (
                          <div key={q.id} className="space-y-2">
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">{q.question_text}</p>
                            <div className="p-4 rounded-2xl bg-muted border border-border min-h-[56px] flex items-center">
                              <p className="font-bold text-foreground/70 leading-relaxed">
                                {Array.isArray(answer) ? answer.join(', ') : (answer || '-')}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
