/**
 * language_exchange_schedules: 동일 form_id 를 공유하는 요일을 요일별 독립 form 으로 분리.
 * (멱등: 이미 분리된 경우 splitGroups=0)
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
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
} catch {
  /* optional */
}

const METADATA_KEYS = new Set([
  '_event_date',
  '_selected_day',
  '_payment_method',
  '_le_free_coupon',
  '_study_bundle_free',
])

function remapAnswers(answers, questionIdMap) {
  const next = {}
  for (const [key, value] of Object.entries(answers || {})) {
    if (METADATA_KEYS.has(key) || key.startsWith('_')) next[key] = value
    else next[questionIdMap[key] || key] = value
  }
  return next
}

async function cloneForm(supabase, sourceFormId, dayKo) {
  const { data: sourceForm, error: formErr } = await supabase
    .from('forms')
    .select('*')
    .eq('id', sourceFormId)
    .single()
  if (formErr || !sourceForm) throw new Error(`Source form not found: ${sourceFormId}`)

  const { data: sourceQuestions, error: qErr } = await supabase
    .from('form_questions')
    .select('*')
    .eq('form_id', sourceFormId)
    .order('display_order', { ascending: true })
  if (qErr) throw qErr

  const { data: newForm, error: insertFormErr } = await supabase
    .from('forms')
    .insert({
      title: sourceForm.title,
      title_en: sourceForm.title_en,
      description: sourceForm.description,
      description_en: sourceForm.description_en,
      webhook_url: sourceForm.webhook_url,
    })
    .select()
    .single()
  if (insertFormErr || !newForm) throw insertFormErr || new Error('Failed to clone form')

  const questionIdMap = {}
  if (sourceQuestions?.length) {
    const rows = sourceQuestions.map((q, idx) => {
      const newId = randomUUID()
      if (q.id) questionIdMap[q.id] = newId
      return {
        id: newId,
        form_id: newForm.id,
        question_text: q.question_text,
        question_text_en: q.question_text_en,
        question_type: q.question_type,
        is_required: q.is_required,
        options: q.options,
        options_en: q.options_en,
        display_order: idx,
        system_key: q.system_key,
      }
    })
    const { error: insertQErr } = await supabase.from('form_questions').insert(rows)
    if (insertQErr) throw insertQErr
  }

  return { newFormId: newForm.id, questionIdMap }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const { data: schedules, error } = await supabase
  .from('language_exchange_schedules')
  .select('id, day_of_week, form_id')
  .not('form_id', 'is', null)
if (error) throw error

const byFormId = new Map()
for (const row of schedules || []) {
  const list = byFormId.get(row.form_id) || []
  list.push(row)
  byFormId.set(row.form_id, list)
}

let splitGroups = 0
let clonedForms = 0
let migratedResponses = 0

for (const [sharedFormId, rows] of byFormId.entries()) {
  if (rows.length <= 1) continue
  splitGroups++

  const sorted = [...rows].sort((a, b) => a.day_of_week.localeCompare(b.day_of_week, 'ko'))
  const [, ...duplicates] = sorted

  console.log(
    `Split ${sharedFormId}: keep ${sorted[0].day_of_week}, clone ${duplicates.map((d) => d.day_of_week).join(', ')}`
  )

  for (const schedule of duplicates) {
    const { newFormId, questionIdMap } = await cloneForm(supabase, sharedFormId, schedule.day_of_week)
    clonedForms++

    const { error: schedErr } = await supabase
      .from('language_exchange_schedules')
      .update({ form_id: newFormId })
      .eq('id', schedule.id)
    if (schedErr) throw schedErr

    const { data: responses, error: respErr } = await supabase
      .from('form_responses')
      .select('id, answers')
      .eq('form_id', sharedFormId)
      .filter('answers->>_selected_day', 'eq', schedule.day_of_week)
    if (respErr) throw respErr

    for (const res of responses || []) {
      const answers = remapAnswers(res.answers, questionIdMap)
      const { error: updErr } = await supabase
        .from('form_responses')
        .update({ form_id: newFormId, answers })
        .eq('id', res.id)
      if (updErr) throw updErr
      migratedResponses++
    }

    console.log(`  ${schedule.day_of_week} → ${newFormId} (${responses?.length || 0} responses)`)
  }
}

console.log(JSON.stringify({ splitGroups, clonedForms, migratedResponses }, null, 2))
