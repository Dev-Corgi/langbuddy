/**
 * 금요일 언어교환 테스트용 더미 form_responses 20명 삽입
 * - 한국 이름 10, 영어 이름 10
 * - _source: test_dummy_friday (주간 리셋·수동 삭제 시 식별용)
 *
 * Usage: node scripts/seed-friday-dummy-participants.mjs
 *        node scripts/seed-friday-dummy-participants.mjs --dry-run
 *        node scripts/seed-friday-dummy-participants.mjs --date=2026-07-03
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
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

const dryRun = process.argv.includes('--dry-run')
const dateArg = process.argv.find((a) => a.startsWith('--date='))
const SESSION_DATE = dateArg ? dateArg.slice('--date='.length).slice(0, 10) : '2026-07-03'
const SELECTED_DAY = '금'
const DUMMY_SOURCE = 'test_dummy_friday'

const supabase = createClient(url, key)

const LANGUAGES = ['영어', '일본어']
const GENDERS = ['남', '여']

const KOREAN_NAMES = [
  '김도윤', '이하린', '박준서', '최지아', '정민호',
  '강서윤', '조현우', '윤채원', '임태양', '한소희',
]

const ENGLISH_NAMES = [
  'Alex Turner', 'Emma Brooks', 'Ryan Cooper', 'Lily Nguyen', 'Chris Evans',
  'Hannah Scott', 'Kevin Moore', 'Grace Patel', 'Brian Clark', 'Nina Foster',
]

function buildParticipant(name, nationality, index) {
  const gender = GENDERS[index % 2]
  const language = LANGUAGES[index % LANGUAGES.length]
  return {
    form_id: null,
    qr_code: randomUUID(),
    user_id: null,
    checked_in_at: null,
    payment_status: null,
    answers: {
      _source: DUMMY_SOURCE,
      _event_date: SESSION_DATE,
      _selected_day: SELECTED_DAY,
      _selected_language: language,
      _payment_method: '테스트더미',
      name,
      gender,
      nationality,
      language,
    },
  }
}

async function main() {
  console.log(`Target: ${SELECTED_DAY}요일 ${SESSION_DATE}`)

  const { data: langRows } = await supabase
    .from('postings')
    .select('id')
    .eq('category', '언어교환')
    .is('day_of_week', null)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  const postingId = langRows?.[0]?.id
  if (!postingId) throw new Error('Active language exchange posting not found')

  const { data: schedule } = await supabase
    .from('language_exchange_schedules')
    .select('form_id')
    .eq('posting_id', postingId)
    .eq('day_of_week', SELECTED_DAY)
    .maybeSingle()

  const formId = schedule?.form_id
  if (!formId) throw new Error('Friday (금) language_exchange_schedule form_id not found')

  const { data: existing } = await supabase
    .from('form_responses')
    .select('id, answers')
    .eq('form_id', formId)
    .contains('answers', { _source: DUMMY_SOURCE })
    .filter('answers->>_event_date', 'eq', SESSION_DATE)

  if (existing?.length) {
    console.log(`Already have ${existing.length} ${DUMMY_SOURCE} rows for ${SESSION_DATE}. Skipping insert.`)
    console.log('Delete them first if you want a fresh batch.')
    return
  }

  const rows = [
    ...KOREAN_NAMES.map((name, i) => buildParticipant(name, '한국인', i)),
    ...ENGLISH_NAMES.map((name, i) => buildParticipant(name, '외국인', i + 10)),
  ].map((r) => ({ ...r, form_id: formId }))

  console.log(`Prepared ${rows.length} dummy participants for form ${formId}`)
  if (dryRun) {
    rows.slice(0, 3).forEach((r) => console.log(' sample:', r.answers.name, r.qr_code.slice(0, 8)))
    return
  }

  const { data, error } = await supabase.from('form_responses').insert(rows).select('id, answers')

  if (error) {
    console.error('Insert failed:', error.message)
    process.exit(1)
  }

  console.log(`Inserted ${data?.length ?? 0} dummy participants.`)
  console.log('Korean:', KOREAN_NAMES.join(', '))
  console.log('English:', ENGLISH_NAMES.join(', '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
