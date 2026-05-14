import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type CoreFormQuestion = {
  id: string
  system_key?: string | null
  question_text?: string | null
  question_text_en?: string | null
  show_in_qr?: boolean | null
}

export type ParticipantInfo = {
  name: string
  gender: string
  nationality: string
  kakaoId: string
  drink: string
  day: string
  language: string
}

export function extractParticipantInfoFromAnswers(
  answers: Record<string, unknown> | null | undefined,
  questions: CoreFormQuestion[]
): ParticipantInfo {
  const bySystemKey: Record<string, string> = {}
  if (Array.isArray(questions)) {
    for (const q of questions) {
      const key = q.system_key
      if (!key || !q.id) continue
      const raw = answers && typeof answers === "object" ? (answers as Record<string, unknown>)[q.id] : undefined
      if (raw === undefined || raw === null || raw === '') continue
      const value = Array.isArray(raw) ? raw.join(", ") : String(raw)
      bySystemKey[key] = value
    }
  }

  const pick = (key: string, fallbacks: string[], questionTextMatches?: string[]): string => {
    if (bySystemKey[key]) return bySystemKey[key]
    for (const f of fallbacks) {
      const raw = answers && typeof answers === "object" ? (answers as Record<string, unknown>)[f] : undefined
      if (raw !== undefined && raw !== null && raw !== '') {
        return Array.isArray(raw) ? raw.join(", ") : String(raw)
      }
    }
    if (questionTextMatches && answers && typeof answers === "object") {
      for (const q of questions) {
        if (!q.question_text && !q.question_text_en) continue
        const matchesText = questionTextMatches.some(match => 
          q.question_text?.includes(match) || q.question_text_en?.toLowerCase().includes(match.toLowerCase())
        )
        if (matchesText && q.id) {
          const raw = (answers as Record<string, unknown>)[q.id]
          if (raw !== undefined && raw !== null && raw !== '') {
            return Array.isArray(raw) ? raw.join(", ") : String(raw)
          }
        }
      }
    }
    return ""
  }

  const name = pick("name", ["name", "이름"], ["이름", "Name"])
  const gender = pick("gender", ["gender", "성별"], ["성별", "Gender"])
  const nationality = pick("nationality", ["nationality", "국적", "한국인", "외국인"], ["한국인", "외국인", "국적", "Nationality"])
  const kakaoId = pick("kakao_id", ["kakao_id", "카카오ID", "카카오", "카카오톡", "카카오톡ID"], ["카카오", "Kakao"])
  const drink = pick("drink", ["drink", "음료", "신청 음료"], ["음료", "Drink"])
  const day = pick("day", ["_selected_day", "day", "요일"], [])
  const language = pick("language", ["_selected_language", "language", "언어", "선택 언어", "희망 언어"], ["언어", "Language"])

  return { name, gender, nationality, kakaoId, drink, day, language }
}

/** 브라우저 `crypto.randomUUID()` 우선, 없으면 v4 형식 난수 문자열 */
export function randomUuidV4(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
