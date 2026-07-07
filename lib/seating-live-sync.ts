import type { SupabaseClient } from '@supabase/supabase-js'
import type { Assignment, RoundData } from '@/lib/seating-algorithm'

export type SeatingConfigPayload = {
  langTableCounts?: Record<string, number>
  tableLanguagesByRound?: Record<string, Record<string, string>>
  /** arrange UI 테이블 표시 순서 (라운드별 라벨 배열) */
  tableOrderByRound?: Record<string, string[]>
}

export type SeatingAssignmentRow = {
  round: number
  participant_id: string
  table_label: string
}

type ParticipantLanguage = { id: string; language: string }

export function inferTableLanguages(
  assignments: Assignment[],
  participantsList: ParticipantLanguage[]
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const a of assignments) {
    if (map[a.table_label]) continue
    const p = participantsList.find((x) => x.id === a.participant_id)
    if (p) map[a.table_label] = p.language
  }
  return map
}

export function roundsToTableLanguagesByRound(rounds: RoundData[]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const r of rounds) {
    if (r.tableLanguages && Object.keys(r.tableLanguages).length > 0) {
      out[String(r.round)] = r.tableLanguages
    }
  }
  return out
}

export function roundsToTableOrderByRound(rounds: RoundData[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const r of rounds) {
    if (r.tableOrder?.length) {
      out[String(r.round)] = r.tableOrder
    }
  }
  return out
}

export function buildRoundsFromAssignmentRows(
  rows: SeatingAssignmentRow[],
  participants: ParticipantLanguage[],
  config?: SeatingConfigPayload | null
): RoundData[] {
  return [1, 2, 3].map((roundNum) => {
    const assignments = rows
      .filter((a) => a.round === roundNum)
      .map((a) => ({
        participant_id: a.participant_id,
        table_label: a.table_label,
      }))
    const fromConfig = config?.tableLanguagesByRound?.[String(roundNum)]
    const tableLanguages =
      fromConfig && Object.keys(fromConfig).length > 0
        ? fromConfig
        : inferTableLanguages(assignments, participants)

    const tableOrder = config?.tableOrderByRound?.[String(roundNum)]

    return { round: roundNum, assignments, tableLanguages, tableOrder }
  })
}

export async function fetchSeatingAssignmentRows(
  supabase: SupabaseClient,
  postingId: string,
  sessionDate: string
): Promise<SeatingAssignmentRow[]> {
  const { data: todayRows } = await supabase
    .from('seating_assignments')
    .select('round, participant_id, table_label')
    .eq('posting_id', postingId)
    .eq('session_date', sessionDate)

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

export async function loadSeatingLiveState(
  supabase: SupabaseClient,
  postingId: string,
  sessionDate: string,
  participants: ParticipantLanguage[],
  seatingConfig?: SeatingConfigPayload | null,
  checkedParticipantIds?: Set<string>
): Promise<{ rounds: RoundData[]; langTableCounts: Record<string, number> }> {
  const rows = await fetchSeatingAssignmentRows(supabase, postingId, sessionDate)
  const filtered =
    checkedParticipantIds && checkedParticipantIds.size > 0
      ? rows.filter((a) => checkedParticipantIds.has(a.participant_id))
      : rows

  const langTableCounts = seatingConfig?.langTableCounts ?? {}
  const rounds = buildRoundsFromAssignmentRows(filtered, participants, seatingConfig)

  return { rounds, langTableCounts }
}

export async function persistSeatingLive(params: {
  postingId: string
  sessionDate: string
  rounds: RoundData[]
  langTableCounts: Record<string, number>
  checkedParticipantIds: Set<string>
}): Promise<void> {
  const { postingId, sessionDate, rounds, langTableCounts, checkedParticipantIds } = params

  const res = await fetch('/api/admin/seating-live/persist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postingId,
      sessionDate,
      rounds,
      langTableCounts,
      checkedParticipantIds: [...checkedParticipantIds],
    }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    const err = new Error(body.error || 'persist_failed') as Error & { message: string }
    throw err
  }
}
