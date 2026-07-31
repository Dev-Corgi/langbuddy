import { SupabaseClient } from '@supabase/supabase-js'
import { buildAutoRecurringFormTitles } from '@/lib/session-event-date'

export type QuestionIdMap = Record<string, string>

const METADATA_ANSWER_KEYS = new Set([
  '_event_date',
  '_selected_day',
  '_payment_method',
  '_le_free_coupon',
])

export function remapFormResponseAnswers(
  answers: Record<string, unknown>,
  questionIdMap: QuestionIdMap
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(answers || {})) {
    if (METADATA_ANSWER_KEYS.has(key) || key.startsWith('_')) {
      next[key] = value
      continue
    }
    next[questionIdMap[key] || key] = value
  }
  return next
}

/** forms + form_questions 를 복제하고 oldQuestionId → newQuestionId 매핑을 반환 */
export async function cloneFormWithQuestionMap(
  supabase: SupabaseClient,
  sourceFormId: string,
  dayKo: string,
  kind: 'language' = 'language'
): Promise<{ newFormId: string; questionIdMap: QuestionIdMap }> {
  const { data: sourceForm, error: formErr } = await supabase
    .from('forms')
    .select('*')
    .eq('id', sourceFormId)
    .single()
  if (formErr || !sourceForm) {
    throw new Error(`Source form not found: ${sourceFormId}`)
  }

  const { data: sourceQuestions, error: qErr } = await supabase
    .from('form_questions')
    .select('*')
    .eq('form_id', sourceFormId)
    .order('display_order', { ascending: true })
  if (qErr) throw qErr

  const auto = buildAutoRecurringFormTitles(dayKo, kind)
  const { data: newForm, error: insertFormErr } = await supabase
    .from('forms')
    .insert({
      title: auto.title,
      title_en: auto.title_en,
      description: sourceForm.description,
      description_en: sourceForm.description_en,
      webhook_url: sourceForm.webhook_url,
    })
    .select()
    .single()
  if (insertFormErr || !newForm) throw insertFormErr || new Error('Failed to clone form')

  const questionIdMap: QuestionIdMap = {}
  if (sourceQuestions?.length) {
    const rows = sourceQuestions.map((q, idx) => {
      const newId = crypto.randomUUID()
      if (q.id) questionIdMap[q.id] = newId
      return {
        id: newId,
        form_id: newForm.id,
        question_text: q.question_text,
        question_text_en: q.question_text_en,
        question_type: q.question_type,
        is_required: q.is_required,
        options: q.options,
        options_en: q.options_en,
        display_order: idx,
        system_key: q.system_key,
      }
    })
    const { error: insertQErr } = await supabase.from('form_questions').insert(rows)
    if (insertQErr) throw insertQErr
  }

  return { newFormId: newForm.id, questionIdMap }
}
