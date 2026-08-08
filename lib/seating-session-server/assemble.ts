import type { SupabaseClient } from '@supabase/supabase-js'
import { loadArrangeParticipantsForSession } from '@/lib/arrange-participants'
import { buildRoundsFromRows } from '@/lib/seating-session/build-rounds'
import { reconcileSnapshot } from '@/lib/seating-session/reconcile'
import type { SeatingSessionSnapshot } from '@/lib/seating-session/types'
import type { SeatingConfigPayload } from '@/lib/seating-live-sync'

export type AssembleSessionParams = {
  postingId: string
  sessionDate: string
  formId: string
  dayOfWeek: string
  epoch: number
  revision: number
  seatingConfig: SeatingConfigPayload | null
}

export async function assembleSeatingSessionSnapshot(
  supabase: SupabaseClient,
  params: AssembleSessionParams
): Promise<SeatingSessionSnapshot> {
  const loaded = await loadArrangeParticipantsForSession(supabase, {
    postingId: params.postingId,
    scheduleFormId: params.formId,
    todayStr: params.sessionDate,
    currentDay: params.dayOfWeek,
  })

  const { data: assignmentRows } = await supabase
    .from('seating_assignments')
    .select('round, participant_id, table_label')
    .eq('posting_id', params.postingId)
    .eq('session_date', params.sessionDate)

  const rows = (assignmentRows ?? []) as {
    round: number
    participant_id: string
    table_label: string
  }[]

  const rounds = buildRoundsFromRows(rows, loaded.participants, params.seatingConfig)

  const raw: SeatingSessionSnapshot = {
    key: {
      postingId: params.postingId,
      sessionDate: params.sessionDate,
      formId: params.formId,
      dayOfWeek: params.dayOfWeek,
      epoch: params.epoch,
    },
    revision: params.revision,
    updatedAt: new Date().toISOString(),
    participants: loaded.participants,
    rounds,
    config: params.seatingConfig ?? {},
  }

  return reconcileSnapshot(raw).snapshot
}

export async function resolveTodayLanguageExchangeSession(
  supabase: SupabaseClient,
  sessionDate: string,
  dayOfWeek: string
): Promise<{
  postingId: string
  formId: string
  epoch: number
  revision: number
  seatingConfig: SeatingConfigPayload | null
} | null> {
  const { data: sessions } = await supabase
    .from('postings')
    .select('id, seating_config, seating_session_epoch, seating_session_revision')
    .eq('category', '언어교환')
    .is('day_of_week', null)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!sessions?.length) return null
  const posting = sessions[0]

  const { data: schedule } = await supabase
    .from('language_exchange_schedules')
    .select('form_id')
    .eq('posting_id', posting.id)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .maybeSingle()

  if (!schedule?.form_id) return null

  return {
    postingId: posting.id as string,
    formId: schedule.form_id as string,
    epoch: Number(posting.seating_session_epoch ?? 0),
    revision: Number(posting.seating_session_revision ?? 0),
    seatingConfig: (posting.seating_config as SeatingConfigPayload | null) ?? null,
  }
}
