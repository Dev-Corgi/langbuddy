import {
  canonicalizeOptionAnswer,
  normalizeLanguage,
  type CanonicalFormQuestion,
} from '@/lib/form-answer-canonical'

export type ParticipantFieldPatch = {
  name: string
  gender: '남' | '여'
  nationality: '한국인' | '외국인'
  language: string
}

/** form_responses.answers에 이름·성별·국적·언어 변경 반영 (flat key + question id) */
export function mergeParticipantFieldPatchIntoAnswers(
  prevAnswers: Record<string, unknown>,
  questions: CanonicalFormQuestion[],
  fields: ParticipantFieldPatch
): Record<string, unknown> {
  const language = normalizeLanguage(fields.language)
  const next: Record<string, unknown> = {
    ...prevAnswers,
    name: fields.name.trim(),
    gender: fields.gender,
    nationality: fields.nationality,
    language,
    _selected_language: language,
  }

  for (const q of questions) {
    if (!q.id || !q.system_key) continue
    switch (q.system_key) {
      case 'name':
        next[q.id] = fields.name.trim()
        break
      case 'gender':
        next[q.id] = fields.gender
        break
      case 'nationality':
        next[q.id] = fields.nationality
        break
      case 'language': {
        const canon = canonicalizeOptionAnswer(q, language)
        next[q.id] = typeof canon === 'string' && canon.trim() ? canon : language
        break
      }
    }
  }

  return next
}
