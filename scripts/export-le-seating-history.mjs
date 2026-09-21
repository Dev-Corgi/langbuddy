/**
 * le_participation_archive → Excel export
 * Usage: node scripts/export-le-seating-history.mjs [outputPath]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

function matesToString(mates) {
  if (!Array.isArray(mates)) return ''
  return mates
    .map((m) => (typeof m === 'object' && m ? m.name || '?' : '?'))
    .filter(Boolean)
    .join(', ')
}

function formatKst(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace('T', ' ')
}

async function fetchArchiveRows(supabase) {
  const pageSize = 1000
  let from = 0
  const all = []

  while (true) {
    const { data, error } = await supabase
      .from('le_participation_archive')
      .select(
        'session_date, day_label, round, table_label, user_id, self_snapshot, mates, checked_in_at, applied_at, archived_at, posting_id, form_id, response_id'
      )
      .order('session_date', { ascending: false })
      .order('round', { ascending: true })
      .order('table_label', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    if (!data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return all
}

function toExportRow(row) {
  const snap = row.self_snapshot || {}
  const userName = snap.name || ''
  return {
    세션일: row.session_date || '',
    요일: row.day_label || '',
    라운드: row.round,
    테이블: row.table_label || '',
    이름: userName,
    성별: snap.gender || '',
    국적: snap.nationality || '',
    언어: snap.language || '',
    동석자: matesToString(row.mates),
    체크인_KST: formatKst(row.checked_in_at),
    신청일_KST: formatKst(row.applied_at),
    아카이브_KST: formatKst(row.archived_at),
    user_id: row.user_id || '',
    posting_id: row.posting_id || '',
    form_id: row.form_id || '',
    response_id: row.response_id || '',
  }
}

function buildSummary(rows) {
  const bySession = new Map()
  for (const r of rows) {
    const key = r.session_date || '(미정)'
    bySession.set(key, (bySession.get(key) || 0) + 1)
  }
  return [...bySession.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([session_date, count]) => ({ 세션일: session_date, 배정건수: count }))
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const raw = await fetchArchiveRows(supabase)
  const rows = raw.map(toExportRow)
  const summary = buildSummary(raw)

  const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const defaultOut = path.join(projectRoot, 'exports', `le-seating-history-${stamp}.xlsx`)
  const outPath = path.resolve(process.argv[2] || defaultOut)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '자리히스토리')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), '세션별집계')

  const meta = [
    { 항목: '생성일(KST)', 값: formatKst(new Date().toISOString()) },
    { 항목: '총 배정건수', 값: rows.length },
    { 항목: '세션 수', 값: summary.length },
    {
      항목: '가장 오래된 세션',
      값: summary.length ? summary[summary.length - 1].세션일 : '',
    },
    { 항목: '가장 최근 세션', 값: summary.length ? summary[0].세션일 : '' },
    { 항목: '출처', 값: 'le_participation_archive (최대 2개월 보관)' },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), '메타')

  XLSX.writeFile(wb, outPath)
  console.log(`Exported ${rows.length} rows → ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
