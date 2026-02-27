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
  ClipboardList
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useLocale } from '@/hooks/use-locale'

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
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="grid gap-8 md:grid-cols-2">
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
