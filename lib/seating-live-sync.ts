import type { SupabaseClient } from '@supabase/supabase-js'
import type { Assignment, RoundData } from '@/lib/seating-algorithm'

export type SeatingConfigPayload = {
  langTableCounts?: Record<string, number>
  tableLanguagesByRound?: Record<string, Record<string, string>>
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

    return { round: roundNum, assignments, tableLanguages }
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

export async function persistSeatingLive(
  supabase: SupabaseClient,
  params: {
    postingId: string
    sessionDate: string
    rounds: RoundData[]
    langTableCounts: Record<string, number>
    checkedParticipantIds: Set<string>
  }
): Promise<void> {
  const { postingId, sessionDate, rounds, langTableCounts, checkedParticipantIds } = params

  const seating_config: SeatingConfigPayload = {
    langTableCounts,
    tableLanguagesByRound: roundsToTableLanguagesByRound(rounds),
  }

  const { error: postingErr } = await supabase
    .from('postings')
    .update({ seating_config })
    .eq('id', postingId)
  if (postingErr) throw postingErr

  const { error: delTodayErr } = await supabase
    .from('seating_assignments')
    .delete()
    .eq('posting_id', postingId)
    .eq('session_date', sessionDate)
  if (delTodayErr) throw delTodayErr

  const { error: delLegacyErr } = await supabase
    .from('seating_assignments')
    .delete()
    .eq('posting_id', postingId)
    .is('session_date', null)
  if (delLegacyErr) throw delLegacyErr

  const rawRows = rounds.flatMap((r) =>
    r.assignments
      .filter(
        (a) =>
          a.table_label &&
          String(a.table_label).trim() &&
          checkedParticipantIds.has(a.participant_id)
      )
      .map((a) => ({
        posting_id: postingId,
        session_date: sessionDate,
        round: r.round,
        table_label: String(a.table_label).trim(),
        participant_id: a.participant_id,
      }))
  )

  const dedupedMap = new Map<string, (typeof rawRows)[0]>()
  for (const row of rawRows) {
    dedupedMap.set(`${row.round}:${row.participant_id}`, row)
  }
  const allAssignments = [...dedupedMap.values()]

  if (allAssignments.length > 0) {
    const { error: insErr } = await supabase.from('seating_assignments').insert(allAssignments)
    if (insErr) throw insErr
  }
}
