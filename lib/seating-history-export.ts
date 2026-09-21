import type { SupabaseClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { extractParticipantInfoFromAnswers } from '@/lib/utils'

export type SeatingHistorySource = 'archive' | 'live'

export type SeatingHistoryRow = {
  session_date: string
  day_label: string
  round: number
  table_label: string
  participant_name: string
  gender: string
  nationality: string
  language: string
  table_mates: string
  checked_in_kst: string
  applied_kst: string
  recorded_kst: string
  source: SeatingHistorySource
  user_id: string
  posting_id: string
  form_id: string
  response_id: string
}

export type SessionDateSummary = {
  session_date: string
  archive_count: number
  live_count: number
  total_count: number
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidYmd(value: string): boolean {
  return YMD_RE.test(value)
}

export function formatKst(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace('T', ' ')
}

function matesToString(mates: unknown): string {
  if (!Array.isArray(mates)) return ''
  return mates
    .map((m) => (typeof m === 'object' && m && 'name' in m ? String((m as { name?: string }).name || '?') : '?'))
    .join(', ')
}

function pickFromAnswers(answers: Record<string, unknown> | null | undefined) {
  const info = extractParticipantInfoFromAnswers(answers, [])
  return {
    name:
      info.name ||
      (typeof answers?.name === 'string' ? answers.name : '') ||
      (typeof answers?.이름 === 'string' ? answers.이름 : '') ||
      (typeof answers?._participant_name === 'string' ? answers._participant_name : '') ||
      '',
    gender:
      info.gender ||
      (typeof answers?.gender === 'string' ? answers.gender : '') ||
      (typeof answers?.성별 === 'string' ? answers.성별 : '') ||
      '',
    nationality:
      info.nationality ||
      (typeof answers?.nationality === 'string' ? answers.nationality : '') ||
      (typeof answers?.국적 === 'string' ? answers.국적 : '') ||
      '',
    language:
      info.language ||
      (typeof answers?._selected_language === 'string' ? answers._selected_language : '') ||
      (typeof answers?.language === 'string' ? answers.language : '') ||
      (typeof answers?.언어 === 'string' ? answers.언어 : '') ||
      '',
    day:
      (typeof answers?._selected_day === 'string' ? answers._selected_day : '') || '',
  }
}

async function fetchLanguageExchangeFormIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.from('language_exchange_schedules').select('form_id')
  if (error) throw new Error(error.message)
  return [...new Set((data || []).map((r) => r.form_id as string).filter(Boolean))]
}

async function fetchArchiveRows(
  admin: SupabaseClient,
  formIds: string[],
  from: string,
  to: string
) {
  if (formIds.length === 0) return []

  const pageSize = 1000
  let offset = 0
  const all: Array<Record<string, unknown>> = []

  while (true) {
    const { data, error } = await admin
      .from('le_participation_archive')
      .select(
        'session_date, day_label, round, table_label, user_id, self_snapshot, mates, checked_in_at, applied_at, archived_at, posting_id, form_id, response_id'
      )
      .in('form_id', formIds)
      .gte('session_date', from)
      .lte('session_date', to)
      .order('session_date', { ascending: false })
      .order('round', { ascending: true })
      .order('table_label', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(error.message)
    if (!data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  return all
}

async function fetchLiveRows(
  admin: SupabaseClient,
  formIds: string[],
  from: string,
  to: string
) {
  if (formIds.length === 0) return []

  const { data: assignments, error: assignErr } = await admin
    .from('seating_assignments')
    .select('posting_id, session_date, round, table_label, participant_id')
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: false })

  if (assignErr) throw new Error(assignErr.message)
  if (!assignments?.length) return []

  const participantIds = [...new Set(assignments.map((a) => a.participant_id as string))]
  const { data: responses, error: respErr } = await admin
    .from('form_responses')
    .select('id, user_id, form_id, answers, checked_in_at, created_at')
    .in('id', participantIds)
    .in('form_id', formIds)

  if (respErr) throw new Error(respErr.message)

  const responseById = new Map((responses || []).map((r) => [r.id as string, r]))

  const tableMap = new Map<string, string[]>()
  for (const a of assignments) {
    const key = `${a.posting_id}|${a.session_date ?? ''}|${a.round}|${a.table_label}`
    const list = tableMap.get(key) || []
    list.push(a.participant_id as string)
    tableMap.set(key, list)
  }

  const rows: Array<Record<string, unknown>> = []

  for (const a of assignments) {
    const fr = responseById.get(a.participant_id as string)
    if (!fr) continue

    const answers = (fr.answers || {}) as Record<string, unknown>
    const picked = pickFromAnswers(answers)
    const tableKey = `${a.posting_id}|${a.session_date ?? ''}|${a.round}|${a.table_label}`
    const mateNames = (tableMap.get(tableKey) || [])
      .filter((pid) => pid !== a.participant_id)
      .map((pid) => {
        const mate = responseById.get(pid)
        if (!mate) return '?'
        return pickFromAnswers((mate.answers || {}) as Record<string, unknown>).name || '?'
      })

    rows.push({
      session_date: a.session_date || '',
      day_label: picked.day,
      round: a.round,
      table_label: a.table_label,
      user_id: fr.user_id,
      self_snapshot: {
        name: picked.name,
        gender: picked.gender,
        nationality: picked.nationality,
        language: picked.language,
      },
      mates: mateNames.map((name) => ({ name })),
      checked_in_at: fr.checked_in_at,
      applied_at: fr.created_at,
      archived_at: null,
      posting_id: a.posting_id,
      form_id: fr.form_id,
      response_id: fr.id,
      source: 'live',
    })
  }

  return rows
}

function archiveToRow(row: Record<string, unknown>): SeatingHistoryRow {
  const snap = (row.self_snapshot || {}) as Record<string, string>
  return {
    session_date: String(row.session_date || ''),
    day_label: String(row.day_label || ''),
    round: Number(row.round),
    table_label: String(row.table_label || ''),
    participant_name: snap.name || '',
    gender: snap.gender || '',
    nationality: snap.nationality || '',
    language: snap.language || '',
    table_mates: matesToString(row.mates),
    checked_in_kst: formatKst(row.checked_in_at as string | null),
    applied_kst: formatKst(row.applied_at as string | null),
    recorded_kst: formatKst(row.archived_at as string | null),
    source: 'archive',
    user_id: String(row.user_id || ''),
    posting_id: String(row.posting_id || ''),
    form_id: String(row.form_id || ''),
    response_id: String(row.response_id || ''),
  }
}

function liveToRow(row: Record<string, unknown>): SeatingHistoryRow {
  const snap = (row.self_snapshot || {}) as Record<string, string>
  return {
    session_date: String(row.session_date || ''),
    day_label: String(row.day_label || ''),
    round: Number(row.round),
    table_label: String(row.table_label || ''),
    participant_name: snap.name || '',
    gender: snap.gender || '',
    nationality: snap.nationality || '',
    language: snap.language || '',
    table_mates: matesToString(row.mates),
    checked_in_kst: formatKst(row.checked_in_at as string | null),
    applied_kst: formatKst(row.applied_at as string | null),
    recorded_kst: formatKst(new Date().toISOString()),
    source: 'live',
    user_id: String(row.user_id || ''),
    posting_id: String(row.posting_id || ''),
    form_id: String(row.form_id || ''),
    response_id: String(row.response_id || ''),
  }
}

function dedupeKey(row: SeatingHistoryRow): string {
  return `${row.session_date}|${row.round}|${row.table_label}|${row.response_id}`
}

export async function fetchSeatingHistoryRows(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<SeatingHistoryRow[]> {
  const formIds = await fetchLanguageExchangeFormIds(admin)
  const [archiveRaw, liveRaw] = await Promise.all([
    fetchArchiveRows(admin, formIds, from, to),
    fetchLiveRows(admin, formIds, from, to),
  ])

  const merged = new Map<string, SeatingHistoryRow>()
  for (const row of archiveRaw) {
    const mapped = archiveToRow(row)
    merged.set(dedupeKey(mapped), mapped)
  }
  for (const row of liveRaw) {
    const mapped = liveToRow(row)
    merged.set(dedupeKey(mapped), mapped)
  }

  return [...merged.values()].sort((a, b) => {
    const dateCmp = b.session_date.localeCompare(a.session_date)
    if (dateCmp !== 0) return dateCmp
    if (a.round !== b.round) return a.round - b.round
    return a.table_label.localeCompare(b.table_label)
  })
}

export async function fetchSeatingHistorySessionSummaries(
  admin: SupabaseClient
): Promise<SessionDateSummary[]> {
  const formIds = await fetchLanguageExchangeFormIds(admin)
  if (formIds.length === 0) return []

  const map = new Map<string, SessionDateSummary>()

  const bump = (date: string, source: 'archive' | 'live') => {
    if (!date) return
    const existing = map.get(date) || {
      session_date: date,
      archive_count: 0,
      live_count: 0,
      total_count: 0,
    }
    if (source === 'archive') existing.archive_count += 1
    else existing.live_count += 1
    existing.total_count = existing.archive_count + existing.live_count
    map.set(date, existing)
  }

  const pageSize = 1000
  let offset = 0
  while (true) {
    const { data, error } = await admin
      .from('le_participation_archive')
      .select('session_date')
      .in('form_id', formIds)
      .not('session_date', 'is', null)
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(error.message)
    if (!data?.length) break
    for (const row of data) bump(String(row.session_date), 'archive')
    if (data.length < pageSize) break
    offset += pageSize
  }

  const { data: liveRows, error: liveErr } = await admin
    .from('seating_assignments')
    .select('session_date, participant_id')
    .not('session_date', 'is', null)

  if (liveErr) throw new Error(liveErr.message)

  if (liveRows?.length) {
    const participantIds = [...new Set(liveRows.map((r) => r.participant_id as string))]
    const { data: responses } = await admin
      .from('form_responses')
      .select('id, form_id')
      .in('id', participantIds)
      .in('form_id', formIds)

    const validIds = new Set((responses || []).map((r) => r.id as string))
    for (const row of liveRows) {
      if (!validIds.has(row.participant_id as string)) continue
      bump(String(row.session_date), 'live')
    }
  }

  return [...map.values()].sort((a, b) => b.session_date.localeCompare(a.session_date))
}

function toSheetRow(row: SeatingHistoryRow) {
  return {
    세션일: row.session_date,
    요일: row.day_label,
    라운드: row.round,
    테이블: row.table_label,
    이름: row.participant_name,
    성별: row.gender,
    국적: row.nationality,
    언어: row.language,
    동석자: row.table_mates,
    체크인_KST: row.checked_in_kst,
    신청일_KST: row.applied_kst,
    기록_KST: row.recorded_kst,
    출처: row.source === 'archive' ? '아카이브' : '현재주',
    user_id: row.user_id,
    posting_id: row.posting_id,
    form_id: row.form_id,
    response_id: row.response_id,
  }
}

function buildSummarySheet(rows: SeatingHistoryRow[]) {
  const bySession = new Map<string, number>()
  for (const r of rows) {
    bySession.set(r.session_date, (bySession.get(r.session_date) || 0) + 1)
  }
  return [...bySession.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([session_date, count]) => ({ 세션일: session_date, 배정건수: count }))
}

export function buildSeatingHistoryWorkbook(
  rows: SeatingHistoryRow[],
  meta: { from: string; to: string }
): Buffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(toSheetRow)), '자리히스토리')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSummarySheet(rows)), '세션별집계')

  const summary = buildSummarySheet(rows)
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { 항목: '조회 시작일', 값: meta.from },
      { 항목: '조회 종료일', 값: meta.to },
      { 항목: '생성일(KST)', 값: formatKst(new Date().toISOString()) },
      { 항목: '총 배정건수', 값: rows.length },
      { 항목: '세션 수', 값: summary.length },
      {
        항목: '출처',
        값: 'le_participation_archive + seating_assignments (언어교환)',
      },
    ]),
    '메타'
  )

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
