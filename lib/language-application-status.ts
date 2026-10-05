import type { SupabaseClient } from '@supabase/supabase-js'
import {
  formatSessionDateLabel,
  isoDateForKoreanWeekdayInSunWeekSeoul,
} from '@/lib/session-event-date'
import { KOREAN_WEEKDAY_ORDER } from '@/lib/language-exchange-schedule'
import { isBankTransferMethod } from '@/lib/supported-payment-methods'
import { extractParticipantInfoFromAnswers, type CoreFormQuestion } from '@/lib/utils'

export type LanguageDayApplicationStatus = {
  day: string
  sessionDate: string
  sessionDateLabel: string
  time: string
  location: string
  formId: string
  maxParticipants: number | null
  totalApplications: number
  koreanCount: number
  foreignerCount: number
  checkedInCount: number
  pendingPaymentCount: number
}

export function getCurrentSunWeekRangeSeoul(from: Date = new Date()) {
  return {
    start: isoDateForKoreanWeekdayInSunWeekSeoul('일', from),
    end: isoDateForKoreanWeekdayInSunWeekSeoul('토', from),
  }
}

export async function fetchLanguageApplicationStatusByDay(
  supabase: SupabaseClient,
  locale: 'ko' | 'en'
): Promise<{ weekStart: string; weekEnd: string; rows: LanguageDayApplicationStatus[] }> {
  const week = getCurrentSunWeekRangeSeoul()

  const { data: master } = await supabase
    .from('postings')
    .select('id')
    .eq('category', '언어교환')
    .is('day_of_week', null)
    .maybeSingle()

  if (!master?.id) {
    return { weekStart: week.start, weekEnd: week.end, rows: [] }
  }

  const { data: schedules } = await supabase
    .from('language_exchange_schedules')
    .select('day_of_week, time, location, max_participants, is_active, form_id')
    .eq('posting_id', master.id)
    .eq('is_active', true)
    .not('form_id', 'is', null)

  if (!schedules?.length) {
    return { weekStart: week.start, weekEnd: week.end, rows: [] }
  }

  const formIds = schedules.map((s) => String(s.form_id))

  const [{ data: responses }, { data: questionRows }] = await Promise.all([
    supabase
      .from('form_responses')
      .select('id, form_id, payment_status, checked_in_at, answers')
      .in('form_id', formIds)
      .gte('answers->>_event_date', week.start)
      .lte('answers->>_event_date', week.end),
    supabase
      .from('form_questions')
      .select('id, form_id, system_key, question_text, question_text_en')
      .in('form_id', formIds),
  ])

  const questionsByFormId = new Map<string, CoreFormQuestion[]>()
  for (const q of questionRows || []) {
    const formId = String(q.form_id)
    const bucket = questionsByFormId.get(formId)
    const item: CoreFormQuestion = {
      id: String(q.id),
      system_key: q.system_key ?? undefined,
      question_text: q.question_text ?? undefined,
      question_text_en: q.question_text_en ?? undefined,
    }
    if (bucket) bucket.push(item)
    else questionsByFormId.set(formId, [item])
  }

  const byFormId = new Map<string, NonNullable<typeof responses>>()
  for (const row of responses || []) {
    const formId = String(row.form_id)
    const bucket = byFormId.get(formId)
    if (bucket) bucket.push(row)
    else byFormId.set(formId, [row])
  }

  const rows: LanguageDayApplicationStatus[] = schedules.map((schedule) => {
    const day = String(schedule.day_of_week)
    const formId = String(schedule.form_id)
    const sessionDate = isoDateForKoreanWeekdayInSunWeekSeoul(day)
    const list = byFormId.get(formId) || []
    const pendingPaymentCount = list.filter(
      (r) =>
        isBankTransferMethod(
          (r.answers as Record<string, unknown> | null | undefined)?._payment_method
        ) && r.payment_status !== 'confirmed'
    ).length

    const formQuestions = questionsByFormId.get(formId) || []
    let koreanCount = 0
    let foreignerCount = 0
    for (const r of list) {
      const info = extractParticipantInfoFromAnswers(
        (r.answers as Record<string, unknown> | null | undefined) ?? null,
        formQuestions
      )
      if (info.nationality === '한국인') koreanCount++
      else if (info.nationality === '외국인') foreignerCount++
    }

    return {
      day,
      sessionDate,
      sessionDateLabel: formatSessionDateLabel(sessionDate, locale),
      time: String(schedule.time || ''),
      location: String(schedule.location || ''),
      formId,
      maxParticipants:
        typeof schedule.max_participants === 'number' ? schedule.max_participants : null,
      totalApplications: list.length,
      koreanCount,
      foreignerCount,
      checkedInCount: list.filter((r) => r.checked_in_at).length,
      pendingPaymentCount,
    }
  })

  rows.sort(
    (a, b) =>
      KOREAN_WEEKDAY_ORDER.indexOf(a.day as (typeof KOREAN_WEEKDAY_ORDER)[number]) -
      KOREAN_WEEKDAY_ORDER.indexOf(b.day as (typeof KOREAN_WEEKDAY_ORDER)[number])
  )

  return { weekStart: week.start, weekEnd: week.end, rows }
}
