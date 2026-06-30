/**
 * 화요일 언어교환 테스트용 더미 form_responses 30명 삽입
 * - 한국 이름 15, 영어 이름 15
 * - _source: test_dummy_tuesday (주간 리셋·수동 삭제 시 식별용)
 *
 * Usage: node scripts/seed-tuesday-dummy-participants.mjs
 *        node scripts/seed-tuesday-dummy-participants.mjs --dry-run
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
const supabase = createClient(url, key)

const SUN_START = ['일', '월', '화', '수', '목', '금', '토']
const KO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  weekday: 'short',
})
const EN_TO_KO = { Sun: '일', Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토' }

function todayYmdSeoul() {
  return KO_DATE.format(new Date())
}

function koreanWeekdayLetterSeoul() {
  return EN_TO_KO[WEEKDAY_SHORT.format(new Date())]
}

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number)
  const utcMs = Date.UTC(y, m - 1, d, 3, 0, 0) + delta * 86_400_000
  return KO_DATE.format(new Date(utcMs))
}

function isoDateForKoreanWeekdayInSunWeekSeoul(weekdayKo) {
  const wantIdx = SUN_START.indexOf(weekdayKo)
  const todayYmd = todayYmdSeoul()
  const todayIdx = SUN_START.indexOf(koreanWeekdayLetterSeoul())
  const sundayYmd = addDaysYmd(todayYmd, -todayIdx)
  return addDaysYmd(sundayYmd, wantIdx)
}

const LANGUAGES = ['영어', '일본어']
const GENDERS = ['남', '여']

const KOREAN_NAMES = [
  '김민준', '이서연', '박지훈', '최유나', '정도현',
  '강하은', '조민서', '윤재원', '임수빈', '한지우',
  '오예린', '신동혁', '권소율', '황민재', '배서진',
]

const ENGLISH_NAMES = [
  'James Wilson', 'Emily Chen', 'Michael Brown', 'Sarah Kim', 'David Lee',
  'Jessica Park', 'Robert Taylor', 'Amanda Johnson', 'Christopher Davis', 'Rachel Miller',
  'Daniel White', 'Olivia Martinez', 'Matthew Anderson', 'Sophia Thomas', 'Andrew Jackson',
]

function buildParticipant(name, nationality, index) {
  const gender = GENDERS[index % 2]
  const language = LANGUAGES[index % LANGUAGES.length]
  const sessionDate = isoDateForKoreanWeekdayInSunWeekSeoul('화')
  return {
    form_id: null, // filled later
    qr_code: randomUUID(),
    user_id: null,
    checked_in_at: null,
    payment_status: null,
    answers: {
      _source: 'test_dummy_tuesday',
      _event_date: sessionDate,
      _selected_day: '화',
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
  const sessionDate = isoDateForKoreanWeekdayInSunWeekSeoul('화')
  console.log(`Target: 화요일 ${sessionDate}`)

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
    .eq('day_of_week', '화')
    .maybeSingle()

  const formId = schedule?.form_id
  if (!formId) throw new Error('Tuesday (화) language_exchange_schedule form_id not found')

  const { data: existing } = await supabase
    .from('form_responses')
    .select('id, answers')
    .eq('form_id', formId)
    .contains('answers', { _source: 'test_dummy_tuesday' })

  if (existing?.length) {
    console.log(`Already have ${existing.length} test_dummy_tuesday rows for this form. Skipping insert.`)
    console.log('Delete them first if you want a fresh batch.')
    return
  }

  const rows = [
    ...KOREAN_NAMES.map((name, i) => buildParticipant(name, '한국인', i)),
    ...ENGLISH_NAMES.map((name, i) => buildParticipant(name, '외국인', i + 15)),
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
