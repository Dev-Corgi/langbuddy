import type { SupabaseClient } from '@supabase/supabase-js'
import {
  formResponseMatchesTodaySession,
  koreanWeekdayLetterSeoul,
  todayYYYYMMDDSeoul,
} from '@/lib/session-event-date'
import {
  mapFormResponseToParticipant,
  type ArrangedParticipant,
} from '@/lib/walk-in-participant'
import type { CoreFormQuestion } from '@/lib/utils'

export type ArrangeParticipantLoadResult = {
  participants: ArrangedParticipant[]
  questionsByFormId: Record<string, CoreFormQuestion[]>
  scheduleQuestions: CoreFormQuestion[]
  userNamesById: Record<string, string>
  staffUserIds: Set<string>
}

export async function loadArrangeParticipantsForSession(
  supabase: SupabaseClient,
  params: {
    postingId: string
    scheduleFormId: string | null
    todayStr?: string
    currentDay?: string
  }
): Promise<ArrangeParticipantLoadResult> {
  const todayStr = params.todayStr ?? todayYYYYMMDDSeoul()
  const currentDay = params.currentDay ?? koreanWeekdayLetterSeoul()

  const { data: schedules } = await supabase
    .from('language_exchange_schedules')
    .select('form_id')
    .eq('posting_id', params.postingId)
    .eq('is_active', true)

  const formIds = [
    ...new Set(
      (schedules || [])
        .map((s) => s.form_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  if (params.scheduleFormId && !formIds.includes(params.scheduleFormId)) {
    formIds.push(params.scheduleFormId)
  }

  const questionsByFormId: Record<string, CoreFormQuestion[]> = {}
  if (formIds.length > 0) {
    const { data: qRows } = await supabase
      .from('form_questions')
      .select('*')
      .in('form_id', formIds)
      .order('display_order', { ascending: true })

    for (const q of qRows || []) {
      const fid = q.form_id as string
      if (!questionsByFormId[fid]) questionsByFormId[fid] = []
      questionsByFormId[fid].push(q as CoreFormQuestion)
    }
  }

  const scheduleQuestions = params.scheduleFormId
    ? questionsByFormId[params.scheduleFormId] ?? []
    : []

  if (formIds.length === 0) {
    return {
      participants: [],
      questionsByFormId,
      scheduleQuestions,
      userNamesById: {},
      staffUserIds: new Set(),
    }
  }

  const { data: responsesRaw } = await supabase
    .from('form_responses')
    .select('*')
    .in('form_id', formIds)

  const responses = (responsesRaw || []).filter((r) =>
    formResponseMatchesTodaySession(
      (r.answers || {}) as Record<string, unknown>,
      todayStr,
      currentDay
    )
  )

  const userIds = [
    ...new Set(
      responses.map((r) => r.user_id).filter((id): id is string => Boolean(id))
    ),
  ]

  const userNamesById: Record<string, string> = {}
  const staffUserIds = new Set<string>()
  if (userIds.length > 0) {
    const [{ data: users }, { data: staffProfiles }] = await Promise.all([
      supabase.from('users').select('id, name').in('id', userIds),
      supabase.from('profiles').select('id').in('id', userIds).eq('is_staff', true),
    ])
    for (const u of users || []) {
      const id = u.id as string
      const name = u.name as string | null
      if (name?.trim()) userNamesById[id] = name.trim()
    }
    for (const p of staffProfiles || []) {
      staffUserIds.add(p.id as string)
    }
  }

  const participants = responses.map((r) => {
    const fid = r.form_id as string
    const questions = questionsByFormId[fid] ?? scheduleQuestions
    return mapFormResponseToParticipant(r, questions, { userNamesById, staffUserIds })
  })

  return { participants, questionsByFormId, scheduleQuestions, userNamesById, staffUserIds }
}
