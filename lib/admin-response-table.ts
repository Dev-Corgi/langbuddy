import { CoreFormQuestion, extractParticipantInfoFromAnswers } from '@/lib/utils'
import { normalizePaymentMethod } from '@/lib/supported-payment-methods'

export type FormResponseRecord = {
  id: string
  created_at: string
  answers?: Record<string, unknown> | null
  payment_status?: string | null
  payment_receipt_url?: string | null
  checked_in_at?: string | null
}

export type FormQuestionRecord = CoreFormQuestion & {
  display_order?: number | null
}

export type ResponseTableRow = {
  id: string
  index: number
  createdAt: string
  name: string
  gender: string
  nationality: string
  language: string
  kakaoId: string
  drink: string
  paymentMethod: string
  paymentStatus: string | null
  checkedInAt: string | null
  receiptUrl: string | null
  customAnswers: Record<string, string>
}

export function formatAnswerDisplay(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '—'
  if (Array.isArray(raw)) return raw.join(', ')
  return String(raw)
}

export function getCustomFormQuestions(questions: FormQuestionRecord[]): FormQuestionRecord[] {
  return questions.filter((q) => !q.system_key)
}

export function buildResponseTableRows(
  responses: FormResponseRecord[],
  questions: FormQuestionRecord[]
): ResponseTableRow[] {
  const customQuestions = getCustomFormQuestions(questions)

  return responses.map((res, idx) => {
    const answers = res.answers ?? {}
    const info = extractParticipantInfoFromAnswers(answers, questions)
    const paymentMethod =
      normalizePaymentMethod(answers._payment_method) ??
      (typeof answers._payment_method === 'string' && answers._payment_method.trim()
        ? answers._payment_method.trim()
        : null)

    const customAnswers: Record<string, string> = {}
    for (const q of customQuestions) {
      if (!q.id) continue
      customAnswers[q.id] = formatAnswerDisplay(answers[q.id])
    }

    return {
      id: res.id,
      index: responses.length - idx,
      createdAt: res.created_at,
      name: info.name || '—',
      gender: info.gender || '—',
      nationality: info.nationality || '—',
      language: info.language || '—',
      kakaoId: info.kakaoId || '—',
      drink: info.drink || '—',
      paymentMethod: paymentMethod || '—',
      paymentStatus: res.payment_status ?? null,
      checkedInAt: res.checked_in_at ?? null,
      receiptUrl: res.payment_receipt_url ?? null,
      customAnswers,
    }
  })
}

export function getQuestionLabel(q: FormQuestionRecord, locale: 'ko' | 'en'): string {
  if (locale === 'en' && q.question_text_en) return q.question_text_en
  return q.question_text || q.question_text_en || '—'
}
