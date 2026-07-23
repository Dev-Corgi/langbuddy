import type { CoreFormQuestion } from '@/lib/utils'

export type CanonicalFormQuestion = CoreFormQuestion & {
  question_type?: string | null
  options?: string[] | null
  options_en?: string[] | null
}

const GENDER_ALIASES: Record<string, string> = {
  남: '남',
  남자: '남',
  male: '남',
  m: '남',
  여: '여',
  여자: '여',
  female: '여',
  f: '여',
}

const NATIONALITY_ALIASES: Record<string, string> = {
  한국인: '한국인',
  한국: '한국인',
  korean: '한국인',
  kor: '한국인',
  kr: '한국인',
  외국인: '외국인',
  외국: '외국인',
  foreigner: '외국인',
  intl: '외국인',
  'non-korean': '외국인',
}

const LANGUAGE_ALIASES: Record<string, string> = {
  영어: '영어',
  english: '영어',
  en: '영어',
  일본어: '일본어',
  japanese: '일본어',
  ja: '일본어',
  '日本語': '일본어',
}

const DRINK_ALIASES: Record<string, string> = {
  아메리카노: '아메리카노',
  americano: '아메리카노',
  라떼: '라떼',
  latte: '라떼',
  차: '차',
  tea: '차',
  기타: '기타',
  other: '기타',
  etc: '기타',
}

function normKey(value: string): string {
  return value.trim().toLowerCase()
}

function aliasLookup(map: Record<string, string>, raw: string): string | null {
  const hit = map[normKey(raw)]
  return hit ?? null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v ?? ''))
}

function matchOptionIndex(raw: string, options: string[], optionsEn: string[]): number {
  const trimmed = raw.trim()
  const koIdx = options.findIndex((o) => String(o).trim() === trimmed)
  if (koIdx >= 0) return koIdx
  return optionsEn.findIndex((o) => String(o).trim() === trimmed)
}

function canonicalFromOptions(raw: string, options: string[], optionsEn: string[]): string | null {
  const idx = matchOptionIndex(raw, options, optionsEn)
  if (idx < 0) return null
  const ko = options[idx]
  return ko != null && String(ko).trim() ? String(ko).trim() : null
}

export function normalizeGender(raw: string): string {
  if (!raw || raw === '?') return raw
  return aliasLookup(GENDER_ALIASES, raw) ?? raw.trim()
}

export function normalizeNationality(raw: string): string {
  if (!raw || raw === '?' || raw === '—' || raw === '-') return raw
  const alias = aliasLookup(NATIONALITY_ALIASES, raw)
  if (alias) return alias
  const t = raw.trim()
  if (/foreign/i.test(t) || t.includes('외국')) return '외국인'
  if (/korean/i.test(t) || t.includes('한국')) return '한국인'
  return t
}

export function normalizeLanguage(raw: string): string {
  if (!raw || raw === '-') return raw
  return aliasLookup(LANGUAGE_ALIASES, raw) ?? raw.trim()
}

export function normalizeDrink(raw: string): string {
  if (!raw) return raw
  return aliasLookup(DRINK_ALIASES, raw) ?? raw.trim()
}

export function normalizeParticipantFields(fields: {
  gender?: string
  nationality?: string
  language?: string
  drink?: string
}): {
  gender?: string
  nationality?: string
  language?: string
  drink?: string
} {
  return {
    gender: fields.gender != null ? normalizeGender(fields.gender) : undefined,
    nationality: fields.nationality != null ? normalizeNationality(fields.nationality) : undefined,
    language: fields.language != null ? normalizeLanguage(fields.language) : undefined,
    drink: fields.drink != null ? normalizeDrink(fields.drink) : undefined,
  }
}

function systemKeyAlias(systemKey: string | null | undefined, raw: string): string | null {
  switch (systemKey) {
    case 'gender':
      return aliasLookup(GENDER_ALIASES, raw)
    case 'nationality': {
      const alias = aliasLookup(NATIONALITY_ALIASES, raw)
      if (alias) return alias
      return normalizeNationality(raw)
    }
    case 'language':
      return aliasLookup(LANGUAGE_ALIASES, raw)
    case 'drink':
      return aliasLookup(DRINK_ALIASES, raw)
    default:
      return null
  }
}

/** 단일 선택값 → 한국어 canonical (options[i] 기준) */
export function canonicalizeOptionAnswer(
  question: CanonicalFormQuestion,
  raw: unknown
): unknown {
  if (raw == null || raw === '') return raw

  if (question.question_type === 'checkbox' && Array.isArray(raw)) {
    return raw.map((item) => canonicalizeOptionAnswer({ ...question, question_type: 'radio' }, item))
  }

  const str = String(raw).trim()
  if (!str) return raw

  const options = asStringArray(question.options)
  const optionsEn = asStringArray(question.options_en)

  const fromSystem = systemKeyAlias(question.system_key, str)
  if (fromSystem) return fromSystem

  const fromOptions = canonicalFromOptions(str, options, optionsEn)
  if (fromOptions) return fromOptions

  if (options.length === 1 && options[0] === '예' && /^yes$/i.test(str)) {
    return '예'
  }

  if (question.system_key === 'gender') return normalizeGender(str)
  if (question.system_key === 'nationality') return normalizeNationality(str)
  if (question.system_key === 'language') return normalizeLanguage(str)
  if (question.system_key === 'drink') return normalizeDrink(str)

  return str
}

export function deriveSelectedLanguage(
  questions: CanonicalFormQuestion[],
  answers: Record<string, unknown>
): string | null {
  const existing = answers._selected_language
  if (typeof existing === 'string' && existing.trim()) {
    return normalizeLanguage(existing)
  }

  const langQ = questions.find((q) => q.system_key === 'language' && q.id)
  if (langQ?.id) {
    const raw = answers[langQ.id]
    if (raw != null && raw !== '') {
      const canon = canonicalizeOptionAnswer(langQ, raw)
      if (typeof canon === 'string' && canon.trim()) return normalizeLanguage(canon)
    }
  }

  for (const key of ['language', '언어', '선택 언어', '희망 언어', '_selected_language']) {
    const raw = answers[key]
    if (typeof raw === 'string' && raw.trim()) return normalizeLanguage(raw)
  }

  return null
}

/** 신청 제출용: answers 내 선택형 값을 한국어 canonical로 통일 */
export function canonicalizeFormAnswers(
  questions: CanonicalFormQuestion[],
  answers: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...answers }

  for (const q of questions) {
    if (!q.id) continue
    if (q.question_type === 'text' || q.question_type === 'textarea') continue
    if (!(q.id in next)) continue
    next[q.id] = canonicalizeOptionAnswer(q, next[q.id])
  }

  const lang = deriveSelectedLanguage(questions, next)
  if (lang) {
    next._selected_language = lang
  } else if (typeof next._selected_language === 'string') {
    next._selected_language = normalizeLanguage(next._selected_language)
  }

  return next
}

/** legacy selectedLang / recurring_settings */
export function canonicalizeLegacySelectedLanguage(raw: string): string {
  return normalizeLanguage(raw)
}

export type FormDisplayLocale = 'ko' | 'en'

function displayOptionAt(
  question: CanonicalFormQuestion,
  index: number,
  locale: FormDisplayLocale
): string | null {
  const options = asStringArray(question.options)
  const optionsEn = asStringArray(question.options_en)
  if (index < 0) return null
  if (locale === 'en' && optionsEn[index]?.trim()) return optionsEn[index].trim()
  const ko = options[index]
  return ko != null && String(ko).trim() ? String(ko).trim() : null
}

function remapSingleAnswerToLocale(
  question: CanonicalFormQuestion,
  raw: unknown,
  locale: FormDisplayLocale
): unknown {
  if (raw == null || raw === '') return raw
  if (question.question_type === 'checkbox' && Array.isArray(raw)) {
    return raw.map((item) =>
      remapSingleAnswerToLocale({ ...question, question_type: 'radio' }, item, locale)
    )
  }
  if (question.question_type === 'text' || question.question_type === 'textarea') {
    return raw
  }

  const str = String(raw).trim()
  const options = asStringArray(question.options)
  const optionsEn = asStringArray(question.options_en)

  const idx = matchOptionIndex(str, options, optionsEn)
  if (idx >= 0) {
    return displayOptionAt(question, idx, locale) ?? str
  }

  const canon = canonicalizeOptionAnswer(question, str)
  if (typeof canon === 'string') {
    const canonIdx = options.findIndex((o) => String(o).trim() === canon)
    if (canonIdx >= 0) {
      return displayOptionAt(question, canonIdx, locale) ?? canon
    }
    return canon
  }

  return raw
}

/** UI locale 전환 시 선택값 유지 (옵션 인덱스 기준으로 표시 라벨만 교체) */
export function remapAnswersForLocale(
  questions: CanonicalFormQuestion[],
  answers: Record<string, unknown>,
  locale: FormDisplayLocale
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...answers }
  for (const q of questions) {
    if (!q.id || !(q.id in next)) continue
    next[q.id] = remapSingleAnswerToLocale(q, next[q.id], locale)
  }
  return next
}

export function normalizeLangTableCounts(
  counts: Record<string, number>
): Record<string, number> {
  const next: Record<string, number> = {}
  for (const [lang, count] of Object.entries(counts)) {
    const key = normalizeLanguage(lang)
    next[key] = count
  }
  return next
}

function isEmptyAnswer(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

/** UI state의 answers를 DB에서 확정한 target form question UUID로 재매핑 (요일별 form race 방지) */
export function remapAnswersBySystemKey(
  sourceQuestions: CanonicalFormQuestion[],
  targetQuestions: CanonicalFormQuestion[],
  answers: Record<string, unknown>,
  userProfile?: {
    name?: string | null
    gender?: string | null
    nationality?: string | null
    kakao_id?: string | null
  } | null
): Record<string, unknown> {
  const bySystemKey: Record<string, unknown> = {}

  for (const q of sourceQuestions) {
    if (!q.id || !q.system_key) continue
    const val = answers[q.id]
    if (!isEmptyAnswer(val)) bySystemKey[q.system_key] = val
  }

  const topLevelSystemKeys = ['name', 'gender', 'nationality', 'kakao_id', 'drink', 'language', 'day'] as const
  for (const key of topLevelSystemKeys) {
    if (key in bySystemKey) continue
    const raw = answers[key]
    if (!isEmptyAnswer(raw)) bySystemKey[key] = raw
  }
  if (!bySystemKey.name) {
    const participantName = answers._participant_name
    if (!isEmptyAnswer(participantName)) bySystemKey.name = participantName
  }

  if (userProfile) {
    if (!bySystemKey.name && userProfile.name) bySystemKey.name = userProfile.name
    if (!bySystemKey.gender && userProfile.gender) bySystemKey.gender = userProfile.gender
    if (!bySystemKey.nationality && userProfile.nationality) {
      bySystemKey.nationality = userProfile.nationality
    }
    if (!bySystemKey.kakao_id && userProfile.kakao_id) {
      bySystemKey.kakao_id = userProfile.kakao_id
    }
  }

  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(answers)) {
    if (key.startsWith('_')) next[key] = value
  }

  for (const q of targetQuestions) {
    if (!q.id) continue
    if (q.system_key && q.system_key in bySystemKey) {
      next[q.id] = bySystemKey[q.system_key]
      continue
    }
    if (q.id in answers && !isEmptyAnswer(answers[q.id])) {
      next[q.id] = answers[q.id]
      continue
    }
    for (const sq of sourceQuestions) {
      if (sq.system_key || !sq.id) continue
      if (
        sq.question_text &&
        q.question_text &&
        sq.question_text === q.question_text &&
        sq.id in answers &&
        !isEmptyAnswer(answers[sq.id])
      ) {
        next[q.id] = answers[sq.id]
        break
      }
    }
  }

  for (const q of targetQuestions) {
    if (!q.id || q.id in next) continue
    next[q.id] = q.question_type === 'checkbox' ? [] : ''
  }

  return next
}
