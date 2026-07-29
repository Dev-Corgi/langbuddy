import {
  canonicalizeOptionAnswer,
  normalizeLanguage,
  type CanonicalFormQuestion,
} from '@/lib/form-answer-canonical'
import {
  defaultPaymentStatusForMethod,
  isSupportedPaymentMethod,
  type PaymentMethod,
} from '@/lib/supported-payment-methods'

export type ParticipantFieldPatch = {
  name: string
  gender: '남' | '여'
  nationality: '한국인' | '외국인'
  language: string
  paymentMethod?: PaymentMethod
}

export type ParticipantPaymentPatchResult = {
  answers: Record<string, unknown>
  payment_status: string | null
}

/** form_responses.answers + payment_status 갱신 payload */
export function mergeParticipantFieldPatchIntoAnswers(
  prevAnswers: Record<string, unknown>,
  questions: CanonicalFormQuestion[],
  fields: ParticipantFieldPatch,
  options?: {
    hasReceipt?: boolean
    previousPaymentStatus?: string | null
  }
): ParticipantPaymentPatchResult {
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

  let payment_status: string | null = options?.previousPaymentStatus ?? null

  if (fields.paymentMethod && isSupportedPaymentMethod(fields.paymentMethod)) {
    next._payment_method = fields.paymentMethod
    const hasReceipt = Boolean(options?.hasReceipt)
    if (fields.paymentMethod === '계좌이체') {
      if (options?.previousPaymentStatus === 'confirmed' && hasReceipt) {
        payment_status = 'confirmed'
      } else {
        payment_status = defaultPaymentStatusForMethod(fields.paymentMethod, hasReceipt)
      }
    } else {
      payment_status = null
    }
  }

  return { answers: next, payment_status }
}
