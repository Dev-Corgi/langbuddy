import { createClient } from '@/lib/supabase'
import type { FormData as FormBuilderData } from '@/components/admin/form-builder'
import { buildAutoRecurringFormTitles } from '@/lib/session-event-date'

export async function fetchFormBuilderData(formId: string): Promise<FormBuilderData | null> {
  const supabase = createClient()
  const { data: fData } = await supabase.from('forms').select('*').eq('id', formId).single()
  const { data: qData } = await supabase
    .from('form_questions')
    .select('*')
    .eq('form_id', formId)
    .order('display_order', { ascending: true })

  if (!fData || !qData) return null

  return {
    title: fData.title,
    title_en: fData.title_en || '',
    description: fData.description || '',
    description_en: fData.description_en || '',
    webhook_url: fData.webhook_url || '',
    questions: qData.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      question_text_en: q.question_text_en || '',
      question_type: q.question_type,
      is_required: q.is_required,
      options: Array.isArray(q.options) ? q.options : q.options ? [String(q.options)] : [''],
      options_en: Array.isArray(q.options_en)
        ? q.options_en
        : q.options_en
          ? [String(q.options_en)]
          : [''],
      system_key: q.system_key || undefined,
    })),
  }
}

export function buildDefaultLanguageFormData(dayKo: string): FormBuilderData {
  const auto = buildAutoRecurringFormTitles(dayKo, 'language')
  return {
    ...auto,
    description: '',
    description_en: '',
    webhook_url: '',
    questions: [
      {
        id: crypto.randomUUID(),
        question_text: '이름',
        question_text_en: 'Name',
        question_type: 'text',
        is_required: true,
        options: [''],
        options_en: [''],
        is_new: true,
        system_key: 'name',
      },
      {
        id: crypto.randomUUID(),
        question_text: '성별',
        question_text_en: 'Gender',
        question_type: 'radio',
        is_required: true,
        options: ['남', '여'],
        options_en: ['Male', 'Female'],
        is_new: true,
        system_key: 'gender',
      },
      {
        id: crypto.randomUUID(),
        question_text: '한국인 / 외국인 여부',
        question_text_en: 'Nationality',
        question_type: 'radio',
        is_required: true,
        options: ['한국인', '외국인'],
        options_en: ['Korean', 'Foreigner'],
        is_new: true,
        system_key: 'nationality',
      },
      {
        id: crypto.randomUUID(),
        question_text: '카카오톡 ID',
        question_text_en: 'KakaoTalk ID',
        question_type: 'text',
        is_required: true,
        options: [''],
        options_en: [''],
        is_new: true,
        system_key: 'kakao_id',
      },
      {
        id: crypto.randomUUID(),
        question_text: '신청 음료',
        question_text_en: 'Preferred Drink',
        question_type: 'select',
        is_required: false,
        options: ['아메리카노', '라떼', '차', '기타'],
        options_en: ['Americano', 'Latte', 'Tea', 'Other'],
        is_new: true,
        system_key: 'drink',
      },
    ],
  }
}
