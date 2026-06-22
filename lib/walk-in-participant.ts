import {
  extractParticipantInfoFromAnswers,
  type CoreFormQuestion,
} from '@/lib/utils'
import { normalizeLanguage, normalizeParticipantFields } from '@/lib/form-answer-canonical'

export const WALK_IN_SOURCE = 'admin_manual' as const

export type WalkInParticipantInput = {
  name: string
  gender: '남' | '여'
  nationality: '한국인' | '외국인'
  language: string
  sessionDate: string
  selectedDay: string
}

export function isWalkInAnswers(answers: Record<string, unknown> | null | undefined): boolean {
  return answers?._source === WALK_IN_SOURCE
}

export function buildWalkInAnswers(input: WalkInParticipantInput): Record<string, unknown> {
  const name = input.name.trim()
  const language = input.language.trim() || '영어'
  const languageKo = normalizeLanguage(language)

  return {
    _source: WALK_IN_SOURCE,
    _event_date: input.sessionDate,
    _selected_day: input.selectedDay,
    _selected_language: languageKo,
    _payment_method: '현장추가',
    name,
    gender: input.gender,
    nationality: input.nationality,
    language: languageKo,
  }
}

export type ArrangedParticipant = {
  id: string
  name: string
  gender: '남' | '여' | string
  nationality: '한국인' | '외국인' | string
  language: string
  checked_in_at: string | null
  /** form_responses.created_at — 미배정 목록 정렬 보조 */
  created_at?: string | null
  /** 회원 신청 시 profiles 연결 */
  userId?: string | null
  isWalkIn?: boolean
}

export type WalkInParticipant = ArrangedParticipant & { isWalkIn: true }

export function mapFormResponseToParticipant(
  row: {
    id: string
    user_id?: string | null
    answers?: Record<string, unknown> | null
    checked_in_at?: string | null
    created_at?: string | null
  },
  questions: CoreFormQuestion[] = []
): ArrangedParticipant {
  const answers = (row.answers || {}) as Record<string, unknown>
  const info = extractParticipantInfoFromAnswers(answers, questions)
  const normalized = normalizeParticipantFields({
    gender: info.gender || String(answers.gender || answers.성별 || '?'),
    nationality: info.nationality || String(answers.nationality || answers.국적 || '?'),
    language: String(answers._selected_language || info.language || '-'),
  })

  return {
    id: row.id,
    name: info.name || String(answers.name || answers.이름 || 'Anonymous'),
    gender: normalized.gender || '?',
    nationality: normalized.nationality || '?',
    language: normalized.language || '-',
    checked_in_at: row.checked_in_at ?? null,
    created_at: row.created_at ?? null,
    userId: row.user_id ?? null,
    isWalkIn: isWalkInAnswers(answers) || undefined,
  }
}

export function mapFormResponseToWalkInParticipant(
  row: {
    id: string
    answers?: Record<string, unknown> | null
    checked_in_at?: string | null
  },
  questions: CoreFormQuestion[] = []
): WalkInParticipant {
  return {
    ...mapFormResponseToParticipant(row, questions),
    isWalkIn: true,
  }
}
