import type { SupabaseClient } from '@supabase/supabase-js'
import { koreanWeekdayLetterSeoul } from '@/lib/session-event-date'
import {
  deriveArrangeStage,
  displayRoundForQr,
  type ArrangeRoundSnapshot,
} from '@/lib/arrange-stage'

export type TodayQrSessionInfo = {
  study: { postingId: string; formId: string } | null
  lang: { postingId: string; formId: string } | null
}

export async function loadTodayQrSessions(
  supabase: SupabaseClient
): Promise<TodayQrSessionInfo> {
  const currentDay = koreanWeekdayLetterSeoul()

  const { data: studyMaster } = await supabase
    .from('postings')
    .select('id')
    .eq('category', '스터디')
    .is('day_of_week', null)
    .maybeSingle()

  let study: TodayQrSessionInfo['study'] = null
  if (studyMaster?.id) {
    const { data: ss } = await supabase
      .from('study_schedules')
      .select('form_id')
      .eq('posting_id', studyMaster.id)
      .eq('day_of_week', currentDay)
      .eq('is_active', true)
      .maybeSingle()
    if (ss?.form_id) {
      study = { postingId: studyMaster.id, formId: ss.form_id }
    }
  }

  let lang: TodayQrSessionInfo['lang'] = null
  const { data: langRows } = await supabase
    .from('postings')
    .select('id')
    .eq('category', '언어교환')
    .is('day_of_week', null)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  const langMaster = langRows?.[0]
  if (langMaster?.id) {
    const { data: ls } = await supabase
      .from('language_exchange_schedules')
      .select('form_id')
      .eq('posting_id', langMaster.id)
      .eq('day_of_week', currentDay)
      .eq('is_active', true)
      .maybeSingle()
    if (ls?.form_id) {
      lang = { postingId: langMaster.id, formId: ls.form_id }
    }
  }

  return { study, lang }
}

export type SeatingAssignmentRow = {
  round: number
  participant_id: string
  table_label: string
}

export async function fetchSeatingRowsForToday(
  supabase: SupabaseClient,
  postingId: string,
  todayYmdSeoul: string
): Promise<SeatingAssignmentRow[]> {
  const { data: todayRows } = await supabase
    .from('seating_assignments')
    .select('round, participant_id, table_label')
    .eq('posting_id', postingId)
    .eq('session_date', todayYmdSeoul)

  if (todayRows && todayRows.length > 0) {
    return todayRows as SeatingAssignmentRow[]
  }

  const { data: legacy } = await supabase
    .from('seating_assignments')
    .select('round, participant_id, table_label')
    .eq('posting_id', postingId)
    .is('session_date', null)

  return (legacy ?? []) as SeatingAssignmentRow[]
}

/** DB 스냅샷만 사용. 자리배치 화면과 동일한 단계 규칙. */
export function tableLabelForParticipantFromDb(
  rows: SeatingAssignmentRow[],
  participantId: string
): { label: string | null; undecided: boolean } {
  const snapshots: ArrangeRoundSnapshot[] = [1, 2, 3].map((round) => ({
    round,
    assignments: rows
      .filter((r) => r.round === round)
      .map((r) => ({ participant_id: r.participant_id, table_label: r.table_label })),
  }))
  const stage = deriveArrangeStage(snapshots)
  const displayRound = displayRoundForQr(stage)
  if (displayRound === null) {
    return { label: null, undecided: true }
  }
  const hit = rows.find(
    (r) => r.participant_id === participantId && r.round === displayRound
  )
  if (!hit?.table_label) {
    return { label: null, undecided: true }
  }
  return { label: hit.table_label, undecided: false }
}
