'use client'

import { useEffect, useState, Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useLocale } from '@/hooks/use-locale'
import { 
  ChevronLeft,
  Globe,
  Loader2,
  Crown,
  Save,
  TypeOutline,
  Info,
  Clock,
  MapPin,
  Wallet,
  IdCard,
  User as UserIcon,
  ClipboardList,
  Calendar,
  Plus,
  Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { cn } from '@/lib/utils'
import { RecurringDays } from '@/components/admin/recurring-days'
import { TiptapEditorCard } from '@/components/admin/tiptap-editor-card'
import { BasicInfoFields } from '@/components/admin/basic-info-fields'
import { RecurringDaySettings } from '@/components/admin/recurring-day-settings'
import { BankAccountCard } from '@/components/admin/bank-account-card'
import { HostInfoCard } from '@/components/admin/host-info-card'
import { ApplyMethodCard } from '@/components/admin/apply-method-card'
import { useFormManager } from '@/hooks/use-form-manager'
import { FormBuilder, FormData as FormBuilderData } from '@/components/admin/form-builder'

function StudyManagementContent() {
  const locale = useLocale()
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<any>(null)
  const [inlineFormData, setInlineFormData] = useState<FormBuilderData | null>(null)
  const [loadedFormId, setLoadedFormId] = useState<string | null>(null)

  const { 
    formDetails: currentFormDetails, 
    setFormDetails: setCurrentFormDetails, 
    saveForm, 
    loadingForm 
  } = useFormManager(loadedFormId)

  useEffect(() => {
    if (currentFormDetails) {
      setInlineFormData(currentFormDetails)
    }
  }, [currentFormDetails])

  useEffect(() => {
    fetchStudyData()
  }, [])

  async function fetchStudyData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('postings')
      .select('*')
      .eq('category', '스터디')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (data) {
      // Ensure recurring_settings exists
      if (!data.recurring_settings) {
        data.recurring_settings = {}
      }
      const [start, end] = (data.time || '').split(' ~ ')
      setFormData({
        ...data,
        start_time: start === '미정' ? '19:00' : (start || '19:00'),
        end_time: start === '미정' ? '' : (end || ''),
        is_date_undecided: data.date === '미정',
        is_time_undecided: data.time === '미정',
        is_location_undecided: data.location === '미정',
        bank_account: data.bank_account || '',
      })

      if (data.form_id) {
        setLoadedFormId(data.form_id)
      }
    } else {
      setFormData({
        category: '스터디',
        title: '정기 영어 스터디',
        title_en: 'Regular English Study',
        description: '매주 진행되는 영어 스터디입니다.',
        description_en: 'Weekly English study session.',
        location: '강남역 인근',
        location_en: 'Near Gangnam Station',
        date: '매주',
        time: '19:00 - 21:00',
        cost: '10,000원',
        cost_en: '10,000 KRW',
        host: '팀장',
        host_en: 'Leader',
        is_recurring: true,
        recurring_days: ['월', '수'],
        status: 'active',
        image_url: '',
        bank_account: '',
        apply_type: 'form',
        recurring_settings: {}
      })
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!formData) return
    setSaving(true)
    
    let formId = formData.form_id

    if (inlineFormData) {
      const newFormId = await saveForm(inlineFormData, formData.form_id)
      if (newFormId) {
        formId = newFormId
      } else {
        alert(locale === 'en' ? 'Failed to save form. Please try again.' : '폼 저장에 실패했습니다. 다시 시도해주세요.')
        setSaving(false)
        return
      }
    }

    const updateData = {
      ...formData,
      date: formData.is_date_undecided ? '미정' : formData.date,
      time: formData.is_time_undecided ? '미정' : (formData.start_time + (formData.end_time ? ` ~ ${formData.end_time}` : '')),
      location: formData.is_location_undecided ? '미정' : formData.location,
      location_en: formData.is_location_undecided ? 'TBD' : formData.location_en,
      form_id: formId || null,
      apply_type: 'form',
      is_date_undecided: formData.is_date_undecided,
      is_time_undecided: formData.is_time_undecided,
      is_location_undecided: formData.is_location_undecided,
      start_time: formData.start_time,
      end_time: formData.end_time
    }
    
    // Remove temporary state fields that don't exist in the DB
    const { 
      id: postingId, 
      created_at, 
      start_time, 
      end_time, 
      is_date_undecided, 
      is_time_undecided, 
      is_location_undecided, 
      bank_account,
      max_participants,
      ...pureUpdateData 
    } = updateData;

    // bank_account and max_participants need to be included in pureUpdateData
    const finalUpdateData = {
      ...pureUpdateData,
      bank_account: bank_account,
      max_participants: max_participants,
      is_date_undecided: updateData.is_date_undecided,
      is_time_undecided: updateData.is_time_undecided,
      is_location_undecided: updateData.is_location_undecided,
      start_time: updateData.start_time,
      end_time: updateData.end_time
    };

    let error;
    if (formData.id) {
      const { error: e } = await supabase
        .from('postings')
        .update(finalUpdateData)
        .eq('id', formData.id)
      error = e;
    } else {
      const { error: e } = await supabase
        .from('postings')
        .insert([finalUpdateData])
      error = e;
    }
    
    if (error) {
      alert(error.message)
    } else {
      alert(locale === 'en' ? 'Settings saved successfully!' : '설정이 성공적으로 저장되었습니다!')
      fetchStudyData() 
    }
    setSaving(false)
  }

  if (loading || !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted p-4 md:p-10 pb-32">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader 
            title="스터디 설정" 
            titleEn="Study Settings" 
            description="매주 반복되는 정기 스터디 정보를 설정하세요." 
            descriptionEn="Configure the regular weekly study session information."
          />
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-primary hover:bg-secondary rounded-2xl h-14 px-8 font-black flex items-center justify-center gap-2 shadow-xl shadow-primary/30 w-full md:w-auto text-lg"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {locale === 'en' ? 'Save Changes' : '설정 저장하기'}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* 기본 정보 */}
          <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
            <CardHeader className="p-8 pb-0">
              <CardTitle className="text-lg font-black flex items-center gap-2 text-foreground">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                {locale === 'en' ? 'Basic Information' : '기본 정보'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <BasicInfoFields
                title={formData.title}
                titleEn={formData.title_en}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4 rounded-[24px]">
                  <Label className="font-black text-foreground/70 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    반복 요일 선택
                  </Label>
                  <RecurringDays 
                    recurringDays={formData.recurring_days || []}
                    onDayToggle={(day) => {
                      const currentDays = formData.recurring_days || [];
                      const newDays = currentDays.includes(day)
                        ? currentDays.filter((d: string) => d !== day)
                        : [...currentDays, day];
                      
                      const newSettings = { ...formData.recurring_settings };
                      if (newDays.includes(day)) {
                        if (!newSettings[day]) {
                          newSettings[day] = { location: formData.location || '', languages: [] };
                        }
                      } else {
                        // delete newSettings[day]; // Optional: decide if you want to clear settings on day de-selection
                      }
                      
                      setFormData({...formData, recurring_days: newDays, recurring_settings: newSettings});
                    }}
                  />
                </div>
              </div>

              <RecurringDaySettings
                recurringDays={formData.recurring_days || []}
                recurringSettings={formData.recurring_settings || {}}
                onSettingsChange={(settings) => setFormData({ ...formData, recurring_settings: settings })}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <BankAccountCard
              bankAccount={formData.bank_account || ''}
              onBankAccountChange={(val) => setFormData({...formData, bank_account: val})}
            />
            <HostInfoCard
              host={formData.host}
              hostEn={formData.host_en}
              onHostChange={(val) => setFormData({...formData, host: val})}
              onHostEnChange={(val) => setFormData({...formData, host_en: val})}
            />
          </div>

          <ApplyMethodCard
            locale={locale}
            currentFormDetails={currentFormDetails || undefined}
            onFormDataChange={(data) => setInlineFormData(data)}
            formId={loadedFormId}
            infoMessage="스터디 모임은 항상 커스텀 신청 폼을 통해 접수를 받습니다. 아래에서 질문 항목을 자유롭게 구성할 수 있습니다."
            infoMessageEn="Study sessions always use a custom application form. You can customize the questions below."
          />

          {/* 상세 콘텐츠 */}
          <TiptapEditorCard 
            title="스터디 상세 설명 및 공지" 
            value={formData.rich_content} 
            onChange={(html) => setFormData({...formData, rich_content: html})} 
          />
          <TiptapEditorCard 
            title="English Detailed Content" 
            value={formData.rich_content_en} 
            onChange={(html) => setFormData({...formData, rich_content_en: html})} 
            isEnglish
          />
        </div>
      </div>

      <div className="mt-12">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-16 rounded-2xl bg-primary hover:bg-secondary text-xl font-black shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : (locale === 'en' ? 'Save Settings' : '설정 저장 완료')}
        </Button>
      </div>
    </div>
  )
}

export default function StudyManagementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-muted"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <StudyManagementContent />
    </Suspense>
  )
}
