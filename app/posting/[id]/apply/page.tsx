'use client'

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { MainNav } from "@/app/_components/main-nav"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { ChevronLeft, Loader2, CheckCircle2, X, MapPin, Wallet } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { i18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Basic Radio Group Implementation
function RadioGroup({ value, onValueChange, children, className }: any) {
  return <div className={className}>{children}</div>
}

function RadioGroupItem({ value, id, className, checked, onChange }: any) {
  return (
    <input
      type="radio"
      id={id}
      value={value}
      checked={checked}
      onChange={onChange}
      className={cn("w-4 h-4 text-primary border-border focus:ring-primary", className)}
    />
  )
}

// Basic Checkbox Implementation
function Checkbox({ id, checked, onCheckedChange, className }: any) {
  return (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className={cn("w-4 h-4 rounded border-border text-primary focus:ring-primary", className)}
    />
  )
}

export default function ApplicationFormPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const supabase = createClient()
  const locale = useLocale()
  const tDict = i18n[locale]

  const [posting, setPosting] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "on_site" | "">("")
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  
  const [selectedDay, setSelectedDay] = useState<string>("")
  const [availableLangs, setAvailableLangs] = useState<string[]>([])
  const [selectedLang, setSelectedLang] = useState<string>("")

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch posting to get form_id
      let query = supabase.from('postings').select('*')
      
      if (id === 'study') {
        query = query.eq('category', '스터디').order('created_at', { ascending: false }).limit(1)
      } else if (id === 'language') {
        query = query.eq('category', '언어교환').order('created_at', { ascending: false }).limit(1)
      } else {
        query = query.eq('id', id)
      }

      const { data: postingDataList, error: pError } = await query
      const postingData = postingDataList && postingDataList.length > 0 ? postingDataList[0] : null
      
      if (pError) {
        console.error('Error fetching posting:', pError)
      }

      if (!postingData || !postingData.form_id) {
        console.error('Invalid posting or missing form_id', { id, postingData })
        router.push(`/posting/${id}`)
        return
      }
      
      // Category check - Study and Language Exchange always allowed to use form
      const isCustomFormAllowed = postingData.apply_type === 'form' || 
                                 postingData.category === '스터디' || 
                                 postingData.category === '언어교환';
      
      if (!isCustomFormAllowed) {
        router.push(`/posting/${id}`)
        return
      }

      setPosting(postingData)

      // 2. Fetch form and questions
      const { data: formData, error: fError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', postingData.form_id)
        .maybeSingle()
      
      if (fError) {
        console.error('Error fetching form:', fError)
      }
      
      if (formData) {
        setForm(formData)
        const { data: questionData, error: qError } = await supabase
          .from('form_questions')
          .select('*')
          .eq('form_id', formData.id)
          .order('display_order', { ascending: true })
        
        if (qError) {
          console.error('Error fetching questions:', qError)
        }

        if (questionData) {
          setQuestions(questionData)
          // Initialize answers
          const initialAnswers: Record<string, any> = {}
          questionData.forEach(q => {
            if (q.question_type === 'checkbox') initialAnswers[q.id] = []
            else initialAnswers[q.id] = ''
          })
          setAnswers(initialAnswers)
        }
      } else {
        console.error('Form not found for id:', postingData.form_id)
        router.push(`/posting/${id}`)
        return
      }
      setLoading(false)
    }
    fetchData()
  }, [id, supabase, router])

  const handleInputChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const current = prev[questionId] || []
      if (checked) return { ...prev, [questionId]: [...current, option] }
      else return { ...prev, [questionId]: current.filter((o: string) => o !== option) }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    // Validate Meeting specific selections
    if ((posting?.category === '스터디' || posting?.category === '언어교환') && posting?.is_recurring) {
      if (!selectedDay) {
        alert(locale === 'en' ? 'Please select a meeting day' : '참여 요일을 선택해주세요')
        setSubmitting(false)
        return
      }
      if (availableLangs.length > 0 && !selectedLang) {
        alert(locale === 'en' ? 'Please select a language' : '희망 언어를 선택해주세요')
        setSubmitting(false)
        return
      }
    }

    // Validate required questions
    for (const q of questions) {
      if (q.is_required) {
        const answer = answers[q.id]
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          const qText = locale === 'en' && q.question_text_en ? q.question_text_en : q.question_text
          alert(locale === 'en' ? `Please answer: ${qText}` : `필수 질문에 답변해주세요: ${qText}`)
          setSubmitting(false)
          return
        }
      }
    }

    const { data: responseData, error } = await supabase
      .from('form_responses')
      .insert([
        {
          form_id: form.id,
          answers: {
            ...answers,
            _selected_day: selectedDay,
            _selected_language: selectedLang,
            _payment_method: paymentMethod === "bank" ? "계좌송금" : "현장결제"
          }
        }
      ])
      .select()
      .single()

    if (error) {
      alert(error.message)
    } else {
      // 3. Trigger Webhook if exists
      if (form.webhook_url) {
        try {
          // Prepare data for webhook
          const webhookData = {
            form_title: form.title,
            submitted_at: new Date(responseData.created_at).toLocaleString(),
            responses: [
              ...questions.map(q => ({
                question: q.question_text,
                answer: Array.isArray(answers[q.id]) ? answers[q.id].join(', ') : answers[q.id]
              })),
              { question: "선택 요일", answer: selectedDay },
              { question: "선택 언어", answer: selectedLang },
              { question: "결제 방식", answer: paymentMethod === "bank" ? "계좌송금" : "현장결제" }
            ]
          }

          // Send to webhook (non-blocking)
          fetch(form.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookData),
            mode: 'no-cors'
          }).catch(err => console.error('Webhook fetch error:', err))
        } catch (webhookErr) {
          console.error('Webhook trigger error:', webhookErr)
        }
      }
      setShowSuccessModal(true)
      setShowPaymentModal(false)
    }
    setSubmitting(false)
  }

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate Meeting specific selections
    if ((posting?.category === '스터디' || posting?.category === '언어교환') && posting?.is_recurring) {
      if (!selectedDay) {
        alert(locale === 'en' ? 'Please select a meeting day' : '참여 요일을 선택해주세요')
        return
      }
      if (availableLangs.length > 0 && !selectedLang) {
        alert(locale === 'en' ? 'Please select a language' : '희망 언어를 선택해주세요')
        return
      }
    }

    // Validate required questions
    for (const q of questions) {
      if (q.is_required) {
        const answer = answers[q.id]
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          const qText = locale === 'en' && q.question_text_en ? q.question_text_en : q.question_text
          alert(locale === 'en' ? `Please answer: ${qText}` : `필수 질문에 답변해주세요: ${qText}`)
          return
        }
      }
    }

    const hasBankAccount = !!posting?.bank_account;

    if (posting?.category === '스터디' || posting?.category === '언어교환' || hasBankAccount) {
      setShowPaymentModal(true)
    } else {
      handleSubmit(e)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert(locale === 'en' ? 'Account number copied!' : '계좌 번호가 복사되었습니다!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <MainNav />
        <main className="mx-auto max-w-4xl w-full px-4 md:px-6 py-8 md:py-16">
          <div className="mb-8">
            <Skeleton className="h-10 w-10 rounded-full mb-4" />
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-96" />
          </div>

          <div className="space-y-6">
            <Card className="rounded-[32px]">
              <CardHeader>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px]">
              <CardHeader>
                <Skeleton className="h-8 w-48" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
              </CardContent>
            </Card>

            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </main>
      </div>
    )
  }

  const displayTitle = locale === 'en' && posting?.title_en ? posting.title_en : posting?.title;
  const displayCost = locale === 'en' && posting?.cost_en ? posting.cost_en : posting?.cost;

  return (
    <div className="min-h-screen bg-muted overflow-x-hidden">
      <MainNav />
      <main className="mx-auto max-w-3xl w-full px-4 md:px-6 py-12">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors mb-8"
        >
          <ChevronLeft className="w-5 h-5" />
          {locale === 'en' ? 'Back' : '뒤로가기'}
        </button>

        <div className="space-y-8">
          <header className="space-y-4">
            <div className="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase">
              {posting.category}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight leading-tight">
              {locale === 'en' && form.title_en ? form.title_en : form.title}
            </h1>
            <div className="flex items-center gap-2 text-primary font-black">
              <Wallet className="w-5 h-5" />
              <span className="text-xl">{displayCost || (locale === 'en' ? 'Free' : '무료 참여')}</span>
            </div>
            {(form.description || form.description_en) && (
              <p className="text-lg text-muted-foreground font-medium whitespace-pre-line">
                {locale === 'en' && form.description_en ? form.description_en : form.description}
              </p>
            )}
          </header>

          <form onSubmit={handlePreSubmit} className="space-y-8">
            {/* 스터디 및 언어교환 요일/언어 선택 */}
            {(posting?.category === '스터디' || posting?.category === '언어교환') && posting?.is_recurring && (
              <Card className="border-primary/20 shadow-lg rounded-[32px] overflow-hidden bg-surface/10">
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-4">
                    <Label className="text-lg font-black text-foreground flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-primary rounded-full" />
                      {locale === 'en' ? 'Select Meeting Day' : '참여 요일 선택'} *
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {posting.recurring_days?.map((day: string) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={cn(
                            "px-6 py-3 rounded-2xl font-black transition-all border-2",
                            selectedDay === day 
                              ? "bg-primary text-white border-primary shadow-lg scale-105" 
                              : "bg-card text-muted-foreground border-border hover:border-primary/30"
                          )}
                        >
                          {day}{locale === 'en' ? '' : '요일'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedDay && (
                    <div className="space-y-4 pt-6 border-t border-primary/10 animate-in fade-in slide-in-from-top-4 duration-500">
                      <Label className="text-lg font-black text-foreground flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-primary rounded-full" />
                        {locale === 'en' ? 'Select Language' : '희망 언어 선택'} *
                      </Label>
                      {availableLangs.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {availableLangs.map((lang) => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => setSelectedLang(lang)}
                              className={cn(
                                "px-5 py-2.5 rounded-xl font-bold transition-all border-2 text-sm",
                                selectedLang === lang 
                                  ? "bg-foreground text-background border-foreground shadow-md" 
                                  : "bg-card text-muted-foreground border-border hover:border-border"
                              )}
                            >
                              {lang}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground font-medium">
                          {locale === 'en' ? 'No specific languages configured for this day.' : '이 요일에 설정된 언어가 없습니다.'}
                        </p>
                      )}
                      
                      {posting.recurring_settings?.[selectedDay]?.location && (
                        <div className="mt-4 p-4 rounded-2xl bg-card border border-primary/10 flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-primary" />
                          <div className="text-sm">
                            <span className="font-bold text-muted-foreground mr-2">{locale === 'en' ? 'Location' : '장소'}:</span>
                            <span className="font-black text-foreground">{posting.recurring_settings[selectedDay].location}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {questions.map((q, idx) => {
              const qText = locale === 'en' && q.question_text_en ? q.question_text_en : q.question_text
              const qOptions = locale === 'en' && q.options_en ? q.options_en : q.options

              return (
                <Card key={q.id} className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-2">
                      <Label className="text-lg font-black text-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">{idx + 1}.</span>
                        {qText}
                        {q.is_required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                    </div>

                    <div className="mt-4">
                      {q.question_type === 'text' && (
                        <Input 
                          placeholder={locale === 'en' ? 'Short answer' : '답변을 입력하세요'}
                          value={answers[q.id] || ''}
                          onChange={(e) => handleInputChange(q.id, e.target.value)}
                          className="h-12 rounded-xl border-border bg-muted/50 focus:bg-card focus:ring-primary transition-all font-medium"
                          required={q.is_required}
                        />
                      )}

                      {q.question_type === 'textarea' && (
                        <Textarea 
                          placeholder={locale === 'en' ? 'Long answer' : '상세한 답변을 입력하세요'}
                          value={answers[q.id] || ''}
                          onChange={(e) => handleInputChange(q.id, e.target.value)}
                          className="min-h-[120px] rounded-2xl border-border bg-muted/50 focus:bg-card focus:ring-primary transition-all font-medium resize-none"
                          required={q.is_required}
                        />
                      )}

                      {q.question_type === 'radio' && (
                        <div className="space-y-3">
                          {qOptions?.map((opt: string, optIdx: number) => (
                            <div key={optIdx} className="flex items-center space-x-3 p-4 rounded-2xl border border-border bg-muted/30 hover:bg-muted transition-colors cursor-pointer group">
                              <input
                                type="radio"
                                name={q.id}
                                value={opt}
                                id={`${q.id}-${optIdx}`}
                                checked={answers[q.id] === opt}
                                onChange={(e) => handleInputChange(q.id, e.target.value)}
                                className="w-4 h-4 text-primary border-border focus:ring-primary"
                              />
                              <Label htmlFor={`${q.id}-${optIdx}`} className="flex-1 font-bold text-foreground/70 cursor-pointer">
                                {opt}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}

                      {q.question_type === 'checkbox' && (
                        <div className="space-y-3">
                          {qOptions?.map((opt: string, optIdx: number) => (
                            <div key={optIdx} className="flex items-center space-x-3 p-4 rounded-2xl border border-border bg-muted/30 hover:bg-muted transition-colors cursor-pointer group">
                              <Checkbox 
                                id={`${q.id}-${optIdx}`}
                                checked={(answers[q.id] || []).includes(opt)}
                                onCheckedChange={(checked: boolean) => handleCheckboxChange(q.id, opt, !!checked)}
                                className="border-border data-[state=checked]:bg-primary"
                              />
                              <Label htmlFor={`${q.id}-${optIdx}`} className="flex-1 font-bold text-foreground/70 cursor-pointer">
                                {opt}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}

                      {q.question_type === 'select' && (
                        <Select 
                          value={answers[q.id] || ''} 
                          onValueChange={(v) => handleInputChange(q.id, v)}
                        >
                          <SelectTrigger className="h-12 rounded-xl border-border bg-muted/50 font-bold">
                            <SelectValue placeholder={locale === 'en' ? 'Select an option' : '옵션을 선택하세요'} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border">
                            {qOptions?.map((opt: string, optIdx: number) => (
                              <SelectItem key={optIdx} value={opt} className="font-bold">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            <div className="pt-6">
              <Button 
                type="submit" 
                disabled={submitting}
                className="w-full h-16 rounded-[24px] bg-primary hover:bg-secondary text-xl font-black shadow-2xl shadow-primary/30 transition-all active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin mr-3" />
                    {locale === 'en' ? 'Submitting...' : '제출 중...'}
                  </>
                ) : (
                  locale === 'en' ? 'Submit Application' : '참여 신청하기'
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>

      {/* Payment Selection & Info Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-md border-none shadow-2xl rounded-[32px] overflow-hidden bg-card animate-in zoom-in-95 duration-300">
            <CardHeader className="p-8 pb-4 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-black text-foreground">
                {locale === 'en' ? 'Payment Method' : '결제 방식 선택'}
              </CardTitle>
              <div className="mt-2 text-xl font-black text-primary">
                {displayCost || (locale === 'en' ? 'Free' : '무료')}
              </div>
              <CardDescription className="text-muted-foreground font-medium pt-2">
                {locale === 'en' 
                  ? 'Choose how you would like to pay for the session.' 
                  : '모임 참가를 위해 결제 방식을 선택해주세요.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-6">
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("bank")}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all group",
                    paymentMethod === "bank" 
                      ? "bg-primary border-primary text-white shadow-lg scale-[1.02]" 
                      : "bg-card border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <span className="text-lg font-black">{locale === 'en' ? 'Bank Transfer' : '계좌 송금'}</span>
                  <span className={cn("text-xs font-medium", paymentMethod === "bank" ? "text-white/80" : "text-muted-foreground")}>
                    {locale === 'en' ? 'Pay now via bank transfer' : '지금 바로 계좌로 이체'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("on_site")}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all group",
                    paymentMethod === "on_site" 
                      ? "bg-foreground border-foreground text-background shadow-lg scale-[1.02]" 
                      : "bg-card border-border text-muted-foreground hover:border-border"
                  )}
                >
                  <span className="text-lg font-black">{locale === 'en' ? 'Pay on Site' : '현장 결제'}</span>
                  <span className={cn("text-xs font-medium", paymentMethod === "on_site" ? "text-white/80" : "text-muted-foreground")}>
                    {locale === 'en' ? 'Pay at the venue' : '모임 장소에서 직접 결제'}
                  </span>
                </button>
              </div>

              {paymentMethod === "bank" && posting?.bank_account && (
                <div className="p-5 rounded-2xl bg-muted border border-border space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Account Info</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => copyToClipboard(posting.bank_account)}
                      className="h-8 px-3 rounded-lg text-primary font-bold hover:bg-primary/10"
                    >
                      {locale === 'en' ? 'Copy' : '복사'}
                    </Button>
                  </div>
                  <div className="text-[17px] font-black text-foreground break-all leading-relaxed">
                    {posting.bank_account}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium leading-tight">
                    {locale === 'en' 
                      ? '* Please complete the transfer within 24 hours.' 
                      : '* 24시간 이내에 입금을 완료해주세요.'}
                  </p>
                </div>
              )}

              {paymentMethod === "on_site" && (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 animate-in slide-in-from-top-2 duration-300">
                  <p className="text-sm text-emerald-700 font-bold leading-relaxed">
                    {locale === 'en' 
                      ? 'Please prepare the exact amount for on-site payment. Thank you!' 
                      : '원활한 진행을 위해 현장 결제 금액을 미리 준비해 주시면 감사하겠습니다.'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentMethod("");
                  }}
                  className="flex-1 h-14 rounded-2xl border-border text-muted-foreground font-bold hover:bg-muted"
                >
                  {locale === 'en' ? 'Cancel' : '취소'}
                </Button>
                <Button 
                  onClick={handleSubmit as any}
                  disabled={!paymentMethod || submitting}
                  className="flex-2 h-14 rounded-2xl bg-primary hover:bg-secondary text-lg font-black shadow-lg shadow-primary/20"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (locale === 'en' ? 'Complete' : '신청 완료하기')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-md border-none shadow-2xl rounded-[32px] overflow-hidden bg-card animate-in zoom-in-95 duration-300">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-foreground">
                  {locale === 'en' ? 'Application Submitted!' : '신청이 완료되었습니다!'}
                </h3>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  {locale === 'en' 
                    ? 'Thank you for your interest. We will contact you soon.' 
                    : '참여 신청이 정상적으로 접수되었습니다.\n곧 담당자가 연락드리겠습니다.'}
                </p>
              </div>
              <Button 
                onClick={() => router.push(`/posting/${id}`)}
                className="w-full h-14 rounded-2xl bg-primary hover:bg-secondary font-black text-lg shadow-lg shadow-primary/20 mt-4"
              >
                {locale === 'en' ? 'Confirm' : '확인'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
