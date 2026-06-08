'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { FormData as FormBuilderData } from '@/components/admin/form-builder'

export function useFormManager(formId: string | null) {
  const supabase = createClient()
  const [formDetails, setFormDetails] = useState<FormBuilderData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchForm = useCallback(async () => {
    if (!formId) {
      setFormDetails(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data: fData } = await supabase.from('forms').select('*').eq('id', formId).single()
    const { data: qData } = await supabase.from('form_questions').select('*').eq('form_id', formId).order('display_order', { ascending: true })

    if (fData && qData) {
      setFormDetails({
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
          options_en: q.options_en || [''],
          system_key: q.system_key || undefined
        }))
      })
    } else {
      setFormDetails(null)
    }
    setLoading(false)
  }, [formId, supabase])

  useEffect(() => {
    fetchForm()
  }, [fetchForm])

  const saveForm = async (formDataToSave: FormBuilderData, existingFormId?: string | null): Promise<string | null> => {
    const targetFormId = existingFormId !== undefined ? existingFormId : formId
    
    if (targetFormId) {
      // Update existing form
      await supabase.from('forms').update({
        title: formDataToSave.title,
        title_en: formDataToSave.title_en,
        description: formDataToSave.description,
        description_en: formDataToSave.description_en,
        webhook_url: formDataToSave.webhook_url
      }).eq('id', targetFormId)

      await supabase.from('form_questions').delete().eq('form_id', targetFormId)

      const questionData = formDataToSave.questions.map((q, idx) => ({
        id: q.id || crypto.randomUUID(),
        form_id: targetFormId,
        question_text: q.question_text,
        question_text_en: q.question_text_en,
        question_type: q.question_type,
        is_required: q.is_required,
        options: q.options,
        options_en: q.options_en,
        display_order: idx,
        system_key: q.system_key || null,
      }))

      const { error: insertErr } = await supabase.from('form_questions').insert(questionData)
      if (insertErr) throw insertErr
      return targetFormId
    } else {
      // Create new form
      const { data: newForm } = await supabase
        .from('forms')
        .insert([{
          title: formDataToSave.title,
          title_en: formDataToSave.title_en,
          description: formDataToSave.description,
          description_en: formDataToSave.description_en,
          webhook_url: formDataToSave.webhook_url
        }])
        .select()
        .single()

      if (newForm) {
        const newFormId = newForm.id
        const questionData = formDataToSave.questions.map((q, idx) => ({
          form_id: newFormId,
          question_text: q.question_text,
          question_text_en: q.question_text_en,
          question_type: q.question_type,
          is_required: q.is_required,
          options: q.options,
          options_en: q.options_en,
          display_order: idx,
          system_key: q.system_key || null
        }))
        await supabase.from('form_questions').insert(questionData)
        return newFormId
      }
    }
    return null
  }

  return { formDetails, setFormDetails, saveForm, loadingForm: loading, refetchForm: fetchForm }
}
