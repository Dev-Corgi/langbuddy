import type { SupabaseClient } from '@supabase/supabase-js'
import type { Assignment, RoundData } from '@/lib/seating-algorithm'
import {
  buildRoundsFromAssignmentRows,
  inferTableLanguages,
  type SeatingConfigPayload,
} from '@/lib/seating-live-sync'
import { orderedTableLabels } from '@/lib/seating-table-ops'

export type HistoryParticipant = {
  id: string
  user_id: string | null
  name: string
  gender: string
  nationality: string
  language: string
  table_label: string
  checked_in_at: string | null
  applied_at: string | null
  payment_method: string | null
  payment_status: string | null
}

export type HistoryRoundView = {
  session_date: string
  round: number
  posting_id: string | null
  posting_title: string | null
  day_label: string
  source: 'archive' | 'live'
  roundData: RoundData
  participants: HistoryParticipant[]
  stats: {
    total: number
    checkedIn: number
    tableCount: number
  }
}

type ArchiveRow = {
  response_id: string
  user_id: string | null
  posting_id: string | null
  day_label: string | null
  table_label: string
  self_snapshot: {
    name?: string
    gender?: string
    nationality?: string
    language?: string
  } | null
  checked_in_at: string | null
  applied_at: string | null
}

async function fetchLanguageExchangeFormIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.from('language_exchange_schedules').select('form_id')
  if (error) throw new Error(error.message)
  return [...new Set((data || []).map((r) => r.form_id as string).filter(Boolean))]
}

async function fetchActiveLanguagePosting(admin: SupabaseClient) {
  const { data } = await admin
    .from('postings')
    .select('id, title, seating_config')
    .eq('category', '언어교환')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

function snapshotToParticipant(row: ArchiveRow): HistoryParticipant {
  const snap = row.self_snapshot || {}
  return {
    id: row.response_id,
    user_id: row.user_id,
    name: snap.name || '?',
    gender: snap.gender || '',
    nationality: snap.nationality || '',
    language: snap.language || '',
    table_label: row.table_label,
    checked_in_at: row.checked_in_at,
    applied_at: row.applied_at,
    payment_method: null,
    payment_status: null,
  }
}

function buildRoundFromArchiveRows(rows: ArchiveRow[], round: number): HistoryRoundView | null {
  if (rows.length === 0) return null

  const participants = rows.map(snapshotToParticipant)
  const assignments: Assignment[] = rows.map((r) => ({
    participant_id: r.response_id,
    table_label: r.table_label,
  }))

  const participantLangs = participants.map((p) => ({ id: p.id, language: p.language }))
  const tableLanguages = inferTableLanguages(assignments, participantLangs)

  const roundData: RoundData = {
    round,
    assignments,
    tableLanguages,
  }

  const postingId = rows.find((r) => r.posting_id)?.posting_id ?? null
  const dayLabel = rows.find((r) => r.day_label)?.day_label ?? ''

  return {
    session_date: '',
    round,
    posting_id: postingId,
    posting_title: null,
    day_label: dayLabel || '',
    source: 'archive',
    roundData,
    participants,
    stats: {
      total: participants.length,
      checkedIn: participants.filter((p) => p.checked_in_at).length,
      tableCount: Object.keys(tableLanguages).length,
    },
  }
}

async function fetchArchiveRound(
  admin: SupabaseClient,
  formIds: string[],
  sessionDate: string,
  round: number
): Promise<HistoryRoundView | null> {
  const { data, error } = await admin
    .from('le_participation_archive')
    .select(
      'response_id, user_id, posting_id, day_label, table_label, self_snapshot, checked_in_at, applied_at'
    )
    .in('form_id', formIds)
    .eq('session_date', sessionDate)
    .eq('round', round)
    .order('table_label', { ascending: true })

  if (error) throw new Error(error.message)
  const built = buildRoundFromArchiveRows((data || []) as ArchiveRow[], round)
  if (!built) return null

  if (built.posting_id) {
    const { data: posting } = await admin
      .from('postings')
      .select('title')
      .eq('id', built.posting_id)
      .maybeSingle()
    built.posting_title = (posting?.title as string) || null
  }

  built.session_date = sessionDate
  return built
}

async function fetchLiveRound(
  admin: SupabaseClient,
  formIds: string[],
  sessionDate: string,
  round: number
): Promise<HistoryRoundView | null> {
  const posting = await fetchActiveLanguagePosting(admin)
  if (!posting?.id) return null

  const { data: assignmentRows, error: assignErr } = await admin
    .from('seating_assignments')
    .select('participant_id, table_label')
    .eq('posting_id', posting.id)
    .eq('session_date', sessionDate)
    .eq('round', round)

  if (assignErr) throw new Error(assignErr.message)
  if (!assignmentRows?.length) return null

  const participantIds = [...new Set(assignmentRows.map((a) => a.participant_id as string))]
  const { data: responses, error: respErr } = await admin
    .from('form_responses')
    .select('id, user_id, form_id, answers, checked_in_at, created_at, payment_status')
    .in('id', participantIds)
    .in('form_id', formIds)

  if (respErr) throw new Error(respErr.message)
  if (!responses?.length) return null

  const responseById = new Map(responses.map((r) => [r.id as string, r]))
  const participants: HistoryParticipant[] = []
  const assignments: Assignment[] = []

  for (const row of assignmentRows) {
    const fr = responseById.get(row.participant_id as string)
    if (!fr) continue
    const answers = (fr.answers || {}) as Record<string, unknown>
    participants.push({
      id: fr.id as string,
      user_id: (fr.user_id as string | null) ?? null,
      name:
        (typeof answers.name === 'string' && answers.name) ||
        (typeof answers.이름 === 'string' && answers.이름) ||
        (typeof answers._participant_name === 'string' && answers._participant_name) ||
        '?',
      gender:
        (typeof answers.gender === 'string' && answers.gender) ||
        (typeof answers.성별 === 'string' && answers.성별) ||
        '',
      nationality:
        (typeof answers.nationality === 'string' && answers.nationality) ||
        (typeof answers.국적 === 'string' && answers.국적) ||
        '',
      language:
        (typeof answers._selected_language === 'string' && answers._selected_language) ||
        (typeof answers.language === 'string' && answers.language) ||
        (typeof answers.언어 === 'string' && answers.언어) ||
        '',
      table_label: row.table_label as string,
      checked_in_at: (fr.checked_in_at as string | null) ?? null,
      applied_at: (fr.created_at as string | null) ?? null,
      payment_method:
        (typeof answers._payment_method === 'string' && answers._payment_method) || null,
      payment_status: (fr.payment_status as string | null) ?? null,
    })
    assignments.push({
      participant_id: fr.id as string,
      table_label: row.table_label as string,
    })
  }

  if (assignments.length === 0) return null

  const seatingConfig = (posting.seating_config || null) as SeatingConfigPayload | null
  const participantLangs = participants.map((p) => ({ id: p.id, language: p.language }))
  const rounds = buildRoundsFromAssignmentRows(
    assignmentRows.map((a) => ({
      round,
      participant_id: a.participant_id as string,
      table_label: a.table_label as string,
    })),
    participantLangs,
    seatingConfig
  )
  const roundData = rounds.find((r) => r.round === round)
  if (!roundData) return null

  const dayLabel =
    (typeof responses[0]?.answers === 'object' &&
      responses[0]?.answers &&
      typeof (responses[0].answers as Record<string, unknown>)._selected_day === 'string' &&
      String((responses[0].answers as Record<string, unknown>)._selected_day)) ||
    ''

  return {
    session_date: sessionDate,
    round,
    posting_id: posting.id as string,
    posting_title: (posting.title as string) || null,
    day_label: dayLabel,
    source: 'live',
    roundData,
    participants,
    stats: {
      total: participants.length,
      checkedIn: participants.filter((p) => p.checked_in_at).length,
      tableCount: Object.keys(roundData.tableLanguages || {}).length,
    },
  }
}

export async function fetchAvailableHistoryRounds(
  admin: SupabaseClient,
  sessionDate: string
): Promise<number[]> {
  const formIds = await fetchLanguageExchangeFormIds(admin)
  const rounds = new Set<number>()

  if (formIds.length > 0) {
    const { data: archiveRows } = await admin
      .from('le_participation_archive')
      .select('round')
      .in('form_id', formIds)
      .eq('session_date', sessionDate)

    for (const row of archiveRows || []) {
      rounds.add(Number(row.round))
    }
  }

  const posting = await fetchActiveLanguagePosting(admin)
  if (posting?.id) {
    const { data: liveRows } = await admin
      .from('seating_assignments')
      .select('round')
      .eq('posting_id', posting.id)
      .eq('session_date', sessionDate)

    for (const row of liveRows || []) {
      rounds.add(Number(row.round))
    }
  }

  return [...rounds].sort((a, b) => a - b)
}

export async function fetchHistoryRoundView(
  admin: SupabaseClient,
  sessionDate: string,
  round: number
): Promise<HistoryRoundView | null> {
  const formIds = await fetchLanguageExchangeFormIds(admin)

  const live = await fetchLiveRound(admin, formIds, sessionDate, round)
  if (live) return live

  return fetchArchiveRound(admin, formIds, sessionDate, round)
}

export function getHistoryTableLabels(roundData: RoundData): string[] {
  return orderedTableLabels(roundData.tableLanguages || {}, roundData.tableOrder)
}

export function getHistoryTableParticipants(
  roundData: RoundData,
  tableLabel: string,
  participants: HistoryParticipant[]
): HistoryParticipant[] {
  return roundData.assignments
    .filter((a) => a.table_label === tableLabel)
    .map((a) => participants.find((p) => p.id === a.participant_id))
    .filter(Boolean) as HistoryParticipant[]
}
