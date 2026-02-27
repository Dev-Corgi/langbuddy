'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BasicInfoFields } from '@/components/admin/basic-info-fields'
import dynamic from 'next/dynamic'
import { TiptapEditorCard } from '@/components/admin/tiptap-editor-card'
import { useFormManager } from '@/hooks/use-form-manager'
import { FormBuilder, FormData as FormBuilderData } from '@/components/admin/form-builder'

const TiptapEditor = dynamic(() => import('@/components/admin/tiptap-editor').then(mod => mod.TiptapEditor), { 
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-xl border border-border flex items-center justify-center text-muted-foreground font-bold">에디터 로딩 중...</div>
})

import { DatePickerField } from '@/components/admin/date-picker-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, Loader2, Upload, Trash2, Link as LinkIcon, ClipboardList, Clock, Calendar, Wallet, Crown } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export default function EditPostingPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const supabase = createClient()
  const locale = useLocale()
  
  const [loading, setLoading] = useState(true)
  const [issubmitting, setIsSubmitting] = useState(false)
  const [forms, setForms] = useState<any[]>([])
  const [showInlineBuilder, setShowInlineBuilder] = useState(false)
  const [inlineFormData, setInlineFormData] = useState<FormBuilderData | null>(null)
  const [isBankAccountEnabled, setIsBankAccountEnabled] = useState(false)

  const [formData, setFormData] = useState({
    id: '',
    category: '스터디',
    title: '',
    title_en: '',
    subtitle: '',
    subtitle_en: '',
    description: '',
    description_en: '',
    location: '',
    location_en: '',
    date: '',
    start_time: '19:00',
    end_time: '21:00',
    is_date_undecided: false,
    is_time_undecided: false,
    is_location_undecided: false,
    cost: '',
    cost_en: '',
    host: '',
    host_en: '',
    bank_account: '',
    image_url: '',
    rich_content: '',
    rich_content_en: '',
    apply_type: 'link',
    apply_link: '',
    form_id: '',
    status: 'active',
    is_recurring: false,
    recurring_days: [] as string[],
    deadline: '',
    max_participants: '',
  })

  const { 
    formDetails: currentFormDetails, 
    setFormDetails: setCurrentFormDetails, 
    saveForm, 
    loadingForm 
  } = useFormManager(formData?.form_id || null)

  useEffect(() => {
    if (currentFormDetails) {
      setInlineFormData(currentFormDetails)
    }
  }, [currentFormDetails])

  useEffect(() => {
    async function fetchForms() {
      const { data } = await supabase.from('forms').select('id, title').eq('is_active', true)
      if (data) setForms(data)
    }
    fetchForms()
  }, [supabase])

  useEffect(() => {
    async function fetchPosting() {
      const { data, error } = await supabase
        .from('postings')
        .select('*')
        .eq('id', id)
        .single()
      
      if (data) {
        const [start, end] = (data.time || '').split(' ~ ')
        setFormData({
          ...data,
          subtitle: data.subtitle || '',
          subtitle_en: data.subtitle_en || '',
          start_time: start === '미정' ? '19:00' : (start || '19:00'),
          end_time: start === '미정' ? '' : (end || ''),
          is_date_undecided: data.date === '미정',
          is_time_undecided: data.time === '미정',
          is_location_undecided: data.location === '미정',
          is_recurring: data.is_recurring || false,
          recurring_days: data.recurring_days || [],
          deadline: data.deadline ? new Date(new Date(data.deadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
        })
        setIsBankAccountEnabled(!!data.bank_account)

        if (data.form_id) {
          // Form data is now handled by useFormManager
        }
      } else {
        alert('포스팅을 찾을 수 없습니다.')
        router.push('/admin/postings')
      }
      setLoading(false)
    }
    fetchPosting()
  }, [id, supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const submissionData = {
      ...formData,
      date: formData.is_date_undecided ? '미정' : formData.date,
      time: formData.is_time_undecided ? '미정' : (`${formData.start_time} ~ ${formData.end_time}`),
      location: formData.is_location_undecided ? '미정' : formData.location,
      location_en: formData.is_location_undecided ? 'TBD' : formData.location_en,
      bank_account: isBankAccountEnabled ? formData.bank_account : null,
      form_id: formData.form_id === '' || formData.form_id === 'none' ? null : formData.form_id,
      deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
      is_date_undecided: formData.is_date_undecided,
      is_time_undecided: formData.is_time_undecided,
      is_location_undecided: formData.is_location_undecided,
      start_time: formData.start_time,
      end_time: formData.end_time
    }

    if (formData.apply_type === 'form' && showInlineBuilder && inlineFormData) {
      const newFormId = await saveForm(inlineFormData, formData.form_id)
      if (newFormId) {
        submissionData.form_id = newFormId
      } else {
        alert('폼 저장에 실패했습니다. 다시 시도해주세요.')
        setIsSubmitting(false)
        return
      }
    }

    const { 
      id: postingId, 
      created_at, 
      ...updateData 
    } = submissionData as any;
    
    const { error } = await supabase
      .from('postings')
      .update(updateData)
      .eq('id', id)

    if (error) {
      alert(error.message)
      setIsSubmitting(false)
    } else {
      const redirectPath = '/admin/meetups'
      router.push(redirectPath)
      router.refresh()
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const { error } = await supabase.from('postings').delete().eq('id', id)
    if (error) {
      alert(error.message)
    } else {
      const redirectPath = '/admin/meetups'
      router.push(redirectPath)
      router.refresh()
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
    <div className="min-h-screen bg-muted p-4 md:p-10 pb-32">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors">
            <ChevronLeft className="w-5 h-5" />
            {locale === 'en' ? 'Back' : '뒤로가기'}
          </button>
          <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10 font-bold gap-2">
            <Trash2 className="w-4 h-4" />
            {locale === 'en' ? 'Delete' : '삭제'}
          </Button>
        </div>

        <h1 className="text-3xl font-black text-foreground">
          {locale === 'en' ? 'Edit Posting' : '포스팅 수정'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
            <CardHeader className="p-8 pb-0">
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <BasicInfoFields
                title={formData.title}
                titleEn={formData.title_en}
                subtitle={formData.subtitle}
                subtitleEn={formData.subtitle_en}
                date={formData.date}
                startTime={formData.start_time}
                endTime={formData.end_time}
                location={formData.location}
                maxParticipants={formData.max_participants}
                imageUrl={formData.image_url}
                isDateUndecided={formData.is_date_undecided}
                isTimeUndecided={formData.is_time_undecided}
                isLocationUndecided={formData.is_location_undecided}
                onTitleChange={(val) => setFormData({...formData, title: val})}
                onTitleEnChange={(val) => setFormData({...formData, title_en: val})}
                onSubtitleChange={(val) => setFormData({...formData, subtitle: val})}
                onSubtitleEnChange={(val) => setFormData({...formData, subtitle_en: val})}
                onDateChange={(val) => setFormData({...formData, date: val})}
                onStartTimeChange={(val) => setFormData({...formData, start_time: val})}
                onEndTimeChange={(val) => setFormData({...formData, end_time: val})}
                onLocationChange={(val) => setFormData({...formData, location: val})}
                onMaxParticipantsChange={(val) => setFormData({...formData, max_participants: val})}
                onImageUrlChange={(val) => setFormData({...formData, image_url: val})}
                onDateUndecidedChange={(checked) => setFormData({...formData, is_date_undecided: checked})}
                onTimeUndecidedChange={(checked) => setFormData({...formData, is_time_undecided: checked})}
                onLocationUndecidedChange={(checked) => setFormData({...formData, is_location_undecided: checked})}
              />

              <div className="grid grid-cols-2 gap-6">
                <DatePickerField
                  label="신청 마감 기한"
                  value={formData.deadline}
                  onChange={(val) => setFormData({...formData, deadline: val})}
                  type="datetime-local"
                  className="space-y-2"
                />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">
                * 마감 기한이 지나면 해당 번개 모임은 목록에서 자동으로 사라집니다.
              </p>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    비용 (KO)
                  </Label>
                  <Input value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})} className="h-12 rounded-xl border-border text-sm font-medium focus:ring-primary" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-primary flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    비용 (EN)
                  </Label>
                  <Input value={formData.cost_en} onChange={(e) => setFormData({...formData, cost_en: e.target.value})} className="h-12 rounded-xl border-primary/30 bg-primary/5 text-sm font-medium focus:ring-primary" />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      입금 계좌 정보 (선택)
                    </Label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={isBankAccountEnabled}
                        onChange={(e) => setIsBankAccountEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                    <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">활성화</span>
                  </label>
                </div>
                {isBankAccountEnabled && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <Input
                      placeholder="예: 카카오뱅크 3333-01-1234567 홍길동"
                      value={formData.bank_account || ''}
                      onChange={(e) => setFormData({...formData, bank_account: e.target.value})}
                      className="h-12 rounded-xl border-border focus:ring-primary text-sm font-medium"
                    />
                    <p className="text-[11px] text-muted-foreground font-medium mt-2">
                      * 계좌 정보를 입력하면 신청 완료 팝업에서 신청자에게 계좌 번호가 노출됩니다.
                    </p>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
            <CardHeader className="p-8 pb-0">
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                신청 방식 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3">
                <Label className="font-black text-foreground/70 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  신청 타입 선택
                </Label>
                <Select value={formData.apply_type} onValueChange={(v) => setFormData({...formData, apply_type: v})}>
                  <SelectTrigger className="h-14 w-full md:w-[400px] rounded-2xl border-border bg-muted/50 focus:ring-primary text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">외부 링크 (구글 폼 등)</SelectItem>
                    <SelectItem value="form">커스텀 폼 (내부 구현)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.apply_type === 'link' ? (
                <div className="space-y-4 pt-4">
                  <Label className="font-black text-foreground/70 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-primary" />
                    신청 링크 (URL)
                  </Label>
                  <Input placeholder="https://docs.google.com/forms/..." value={formData.apply_link} onChange={(e) => setFormData({...formData, apply_link: e.target.value})} className="h-14 rounded-2xl border-border bg-muted/50 focus:ring-primary text-sm font-medium" />
                </div>
              ) : (
                <div className="space-y-6 pt-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="font-black text-foreground/70 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-primary" />
                        신청 폼 설정
                      </Label>
                      <p className="text-xs text-muted-foreground font-medium">연결할 신청 폼을 선택하거나 새로 만듭니다.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => setShowInlineBuilder(!showInlineBuilder)} className={cn("rounded-2xl font-black h-12 px-6", showInlineBuilder ? "text-muted-foreground border-border" : "text-primary border-primary bg-surface/10")}>
                      {showInlineBuilder ? '기존 폼 선택' : '새 폼 만들기'}
                    </Button>
                  </div>
                  {!showInlineBuilder ? (
                    <Select value={formData.form_id} onValueChange={(v) => setFormData({...formData, form_id: v})}>
                      <SelectTrigger className="h-14 w-full rounded-2xl border-border bg-muted/50 focus:ring-primary text-sm font-medium"><SelectValue placeholder="연결할 기존 폼 선택" /></SelectTrigger>
                      <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-4 border-2 border-dashed border-primary/20 rounded-[40px] p-2 bg-surface/5 transition-all">
                      <div className="p-4 md:p-8">
                        <FormBuilder initialData={currentFormDetails || undefined} onChange={(data) => setInlineFormData(data)} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <TiptapEditorCard 
            title="상세 콘텐츠 (한국어)" 
            value={formData.rich_content} 
            onChange={(html) => setFormData({...formData, rich_content: html})} 
          />
          <TiptapEditorCard 
            title="Detailed Content (English)" 
            value={formData.rich_content_en} 
            onChange={(html) => setFormData({...formData, rich_content_en: html})} 
            isEnglish
          />

          <div className="mt-12">
            <Button type="submit" disabled={issubmitting} className="w-full h-16 rounded-2xl bg-primary hover:bg-secondary text-xl font-black shadow-xl transition-all active:scale-[0.98]">
              {issubmitting ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : '수정 완료'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
