'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { 
  ChevronLeft,
  ClipboardList,
  Loader2,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLocale } from '@/hooks/use-locale'

export default function AdminFormsPage() {
  const locale = useLocale()
  const [forms, setForms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchForms()
  }, [])

  async function fetchForms() {
    setLoading(true)
    const { data, error } = await supabase
      .from('forms')
      .select('*, form_questions(count)')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching forms:', error)
      alert(`Error: ${error.message}`)
    }
    
    if (data) {
      console.log('Fetched forms:', data)
      setForms(data)
    }
    setLoading(false)
  }

  async function deleteForm(id: string, formTitle: string) {
    // Prevent deletion of permanent forms
    // const permanentForms = ['언어교환 세션', 'Language Exchange Session']
    // if (permanentForms.some(name => formTitle.includes(name))) {
    //   alert(locale === 'en' ? 'This is a permanent form and cannot be deleted.' : '이 폼은 고정 폼으로 삭제할 수 없습니다.')
    //   return
    // }
    
    if (!confirm(locale === 'en' ? 'Are you sure you want to delete this form?' : '정말 삭제하시겠습니까?')) return
    const { error } = await supabase.from('forms').delete().eq('id', id)
    if (error) alert(error.message)
    else fetchForms()
  }

  return (
    <div className="min-h-screen bg-muted p-4 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors mb-2 text-sm">
              <ChevronLeft className="w-4 h-4" />
              {locale === 'en' ? 'Dashboard' : '대시보드'}
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
              {locale === 'en' ? 'Response Management' : '응답 관리'}
            </h1>
            <p className="text-muted-foreground font-medium text-sm md:text-base">
              {locale === 'en' ? 'View and manage application form responses.' : '신청 폼 응답을 확인하고 관리하세요.'}
            </p>
          </div>
        </div>

        {/* Postings List */}
        <div className="space-y-3 md:space-y-4">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin w-8 h-8 text-primary mx-auto mb-4" />
              <p className="font-bold text-muted-foreground">{locale === 'en' ? 'Loading forms...' : '폼 목록을 불러오는 중...'}</p>
            </div>
          ) : forms.length === 0 ? (
            <Card className="border-dashed border-2 border-border bg-transparent rounded-[32px]">
              <CardContent className="py-20 text-center space-y-4">
                <p className="font-bold text-muted-foreground">{locale === 'en' ? 'No forms available.' : '사용 가능한 폼이 없습니다.'}</p>
                <p className="text-sm text-muted-foreground">{locale === 'en' ? 'Forms are managed within posting pages.' : '폼은 포스팅 페이지에서 관리됩니다.'}</p>
              </CardContent>
            </Card>
          ) : (
            forms.map((form) => (
              <Card key={form.id} className="border-border shadow-sm rounded-[24px] overflow-hidden bg-card hover:border-primary/30 transition-all group">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row md:items-center p-4 md:p-6 gap-4 md:gap-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-6 h-6 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {form.is_active ? (
                          <Badge variant="outline" className="rounded-lg border-emerald-500 text-emerald-500 font-black text-[10px] md:text-[11px] px-2 py-0.5">
                            {locale === 'en' ? 'Active' : '활성'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-lg border-border text-muted-foreground font-black text-[10px] md:text-[11px] px-2 py-0.5">
                            {locale === 'en' ? 'Inactive' : '비활성'}
                          </Badge>
                        )}
                        {/* {['언어교환 세션', 'Language Exchange Session'].some(name => form.title.includes(name)) && (
                          <Badge variant="outline" className="rounded-lg border-primary text-primary font-black text-[10px] md:text-[11px] px-2 py-0.5">
                            {locale === 'en' ? 'PERMANENT' : '고정'}
                          </Badge>
                        )} */}
                        <span className="text-xs font-bold text-muted-foreground">
                          {locale === 'en' ? `Questions: ${form.form_questions?.[0]?.count || 0}` : `질문 수: ${form.form_questions?.[0]?.count || 0}개`}
                        </span>
                      </div>
                      <h3 className="text-lg md:text-xl font-black text-foreground line-clamp-1">{form.title}</h3>
                      <p className="text-sm font-medium text-muted-foreground line-clamp-1">{form.description || '-'}</p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-border/50 mt-2 md:mt-0">
                      <Button asChild className="flex-1 md:flex-none rounded-xl font-black h-10 px-6 bg-primary hover:bg-primary/90">
                        <Link href={`/admin/forms/${form.id}/responses`}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          {locale === 'en' ? 'View Responses' : '응답 확인'}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
