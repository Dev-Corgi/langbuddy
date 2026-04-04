'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Info } from 'lucide-react'
import { FormBuilder, FormData as FormBuilderData } from '@/components/admin/form-builder'
import { createClient } from '@/lib/supabase'

interface ApplyMethodCardProps {
  locale: string
  currentFormDetails?: FormBuilderData
  onFormDataChange: (data: FormBuilderData) => void
  infoMessage?: string
  infoMessageEn?: string
  formId?: string | null
}

export function ApplyMethodCard({
  locale,
  currentFormDetails,
  onFormDataChange,
  infoMessage,
  infoMessageEn,
  formId
}: ApplyMethodCardProps) {
  const supabase = createClient()
  const [loadedFormData, setLoadedFormData] = useState<FormBuilderData | undefined>(currentFormDetails)

  useEffect(() => {
    if (formId) {
      loadFormData(formId)
    }
  }, [formId])

  async function loadFormData(formIdToLoad: string) {
    if (!formIdToLoad) return
    
    const { data: fData } = await supabase.from('forms').select('*').eq('id', formIdToLoad).single()
    const { data: qData } = await supabase.from('form_questions').select('*').eq('form_id', formIdToLoad).order('display_order', { ascending: true })

    if (fData && qData) {
      const formData: FormBuilderData = {
        title: fData.title,
        title_en: fData.title_en || '',
        description: fData.description || '',
        description_en: fData.description_en || '',
        webhook_url: fData.webhook_url || '',
        questions: qData.map(q => ({
          id: q.id,
          question_text: q.question_text,
          question_text_en: q.question_text_en || '',
          question_type: q.question_type,
          is_required: q.is_required,
          options: q.options || [''],
          options_en: q.options_en || ['']
        }))
      }
      setLoadedFormData(formData)
      onFormDataChange(formData)
    }
  }


  return (
    <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
      <CardHeader className="p-8 pb-0">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          {locale === 'en' ? 'Application Form Settings' : '신청 폼 설정'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="border-2 border-dashed border-primary/20 rounded-[40px] p-2 bg-primary/5 transition-all">
          <div className="p-4 md:p-8">
            <FormBuilder 
              key={formId || 'new-form'}
              initialData={loadedFormData}
              onChange={onFormDataChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
