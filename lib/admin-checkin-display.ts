import {
  extractParticipantInfoFromAnswers,
  type CoreFormQuestion,
} from '@/lib/utils'
import { normalizeNationality } from '@/lib/form-answer-canonical'
import { isCouponApplication, storedStampToSlider } from '@/lib/le-stamp'
import { formatPaymentMethodLabel as formatCanonicalPaymentMethodLabel } from '@/lib/supported-payment-methods'
import {
  fetchSeatingRowsForToday,
  tableLabelForParticipantFromDb,
} from '@/lib/admin-qr-sessions'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminCheckinModalPayload = {
  name: string
  nationalityLabel: string
  paymentMethod: string
  drink: string
  tableUndecided: boolean
  tableLabel: string | null
  /** 자리배치 화면 등에서만 표시 */
  showTable: boolean
  userId: string | null
  /** DB 0~9 → 모달 슬라이더 초기값 */
  stampSlider: number | null
  sessionUsedCoupon: boolean
  stampEditable: boolean
}

export function normalizeNationalityLabel(raw: string): string {
  const t = raw.trim()
  if (!t || t === '—' || t === '-' || t === '?') return '—'
  return normalizeNationality(t)
}

export function formatPaymentMethodLabel(
  answers: Record<string, unknown> | null | undefined,
  paymentStatus: string | null | undefined
): string {
  const method =
    answers && typeof answers._payment_method === 'string'
      ? answers._payment_method
      : null
  return formatCanonicalPaymentMethodLabel(method, paymentStatus)
}

type FormResponseRow = {
  id: string
  user_id?: string | null
  answers?: Record<string, unknown> | null
  payment_status?: string | null
}

export function buildCheckinModalPayloadFromResponse(
  row: FormResponseRow,
  questions: CoreFormQuestion[],
  table: { label: string | null; undecided: boolean },
  options?: {
    showTable?: boolean
    stampProgress?: number | null
  }
): AdminCheckinModalPayload {
  const answers = (row.answers || {}) as Record<string, unknown>
  const info = extractParticipantInfoFromAnswers(answers, questions)
  const ans = answers as Record<string, string>
  const name = info.name || ans.name || ans.이름 || 'Anonymous'
  const nationalityRaw =
    info.nationality || ans.nationality || ans.국적 || '—'
  const drink = info.drink || ans.drink || ans.음료 || '—'
  const userId = row.user_id ?? null
  const stampProgress = options?.stampProgress ?? null

  return {
    name,
    nationalityLabel: normalizeNationalityLabel(nationalityRaw),
    paymentMethod: formatPaymentMethodLabel(answers, row.payment_status),
    drink: drink || '—',
    tableUndecided: table.undecided,
    tableLabel: table.label,
    showTable: options?.showTable ?? true,
    userId,
    stampSlider:
      userId != null && stampProgress != null
        ? storedStampToSlider(stampProgress)
        : null,
    sessionUsedCoupon: isCouponApplication(answers),
    stampEditable: userId != null,
  }
}

export async function buildLangCheckinModalPayload(
  supabase: SupabaseClient,
  row: FormResponseRow,
  questions: CoreFormQuestion[],
  postingId: string,
  todayYmdSeoul: string
): Promise<AdminCheckinModalPayload> {
  const rows = await fetchSeatingRowsForToday(supabase, postingId, todayYmdSeoul)
  const table = tableLabelForParticipantFromDb(rows, row.id)

  let stampProgress: number | null = null
  if (row.user_id) {
    const { data: userRow } = await supabase
      .from('users')
      .select('le_stamp_progress')
      .eq('id', row.user_id)
      .maybeSingle()
    if (userRow) {
      stampProgress = Number(userRow.le_stamp_progress ?? 0)
    }
  }

  return buildCheckinModalPayloadFromResponse(row, questions, table, {
    showTable: true,
    stampProgress,
  })
}
