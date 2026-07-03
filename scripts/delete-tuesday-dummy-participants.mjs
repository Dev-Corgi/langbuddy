/**
 * 화요일 더미 참가자(test_dummy_tuesday) 전체 삭제
 *
 * Usage: node scripts/delete-tuesday-dummy-participants.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {
  console.error('Missing .env.local')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

const { data: rows, error: selErr } = await supabase
  .from('form_responses')
  .select('id, answers')
  .contains('answers', { _source: 'test_dummy_tuesday' })

if (selErr) {
  console.error(selErr.message)
  process.exit(1)
}

if (!rows?.length) {
  console.log('No test_dummy_tuesday rows found.')
  process.exit(0)
}

const ids = rows.map((r) => r.id)

const { data: posting } = await supabase
  .from('postings')
  .select('id')
  .eq('category', '언어교환')
  .is('day_of_week', null)
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

let seatRemoved = 0
if (posting?.id) {
  const { error: seatErr, count } = await supabase
    .from('seating_assignments')
    .delete({ count: 'exact' })
    .eq('posting_id', posting.id)
    .in('participant_id', ids)

  if (seatErr) {
    console.error('seating delete:', seatErr.message)
    process.exit(1)
  }
  seatRemoved = count ?? 0
}

const { error: delErr, count: deleted } = await supabase
  .from('form_responses')
  .delete({ count: 'exact' })
  .in('id', ids)

if (delErr) {
  console.error(delErr.message)
  process.exit(1)
}

console.log(`Deleted ${deleted ?? ids.length} dummy participant(s)`)
console.log(`Removed ${seatRemoved} seating assignment(s)`)
