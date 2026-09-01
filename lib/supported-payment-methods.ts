/** arrange·관리자 모달에서 쓰는 canonical 결제 수단 (DB answers._payment_method) */
export const PAYMENT_METHODS = [
  '계좌이체',
  '현장현금',
  '현장계좌',
  '스탭무료',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** 과거 응답(쿠폰 기능 폐지 이전)의 표시 호환용 — 신규 선택지에는 없음 */
const LEGACY_DISPLAY_ONLY: Record<string, string> = {
  무료쿠폰: '쿠폰사용',
  '무료쿠폰(10스탬프)': '쿠폰사용',
  쿠폰사용: '쿠폰사용',
}

const LEGACY_ALIASES: Record<string, PaymentMethod> = {
  계좌송금: '계좌이체',
  계좌이체: '계좌이체',
  현장결제: '현장현금',
  현장현금: '현장현금',
  현장계좌: '현장계좌',
  현장추가: '현장현금',
  테스트더미: '현장현금',
  스탭: '스탭무료',
  스탭무료: '스탭무료',
}

export function isSupportedPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value)
}

/** API body.paymentMethod — undefined면 미전달, 잘못된 값이면 undefined */
export function parseOptionalPaymentMethod(raw: unknown): PaymentMethod | undefined {
  if (raw === undefined) return undefined
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!isSupportedPaymentMethod(trimmed)) return undefined
  return trimmed
}

/** DB/레거시 문자열 → canonical (알 수 없으면 null) */
export function normalizePaymentMethod(raw: unknown): PaymentMethod | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t) return null
  if (isSupportedPaymentMethod(t)) return t
  return LEGACY_ALIASES[t] ?? null
}

export function isBankTransferMethod(raw: unknown): boolean {
  return normalizePaymentMethod(raw) === '계좌이체'
}

/** payment_status 초기값 (관리자 수동 변경) */
export function defaultPaymentStatusForMethod(
  method: PaymentMethod,
  hasReceipt: boolean
): string | null {
  if (method === '계좌이체') {
    return hasReceipt ? 'pending' : null
  }
  return null
}

export function formatPaymentMethodLabel(
  raw: unknown,
  paymentStatus?: string | null
): string {
  const method = normalizePaymentMethod(raw)
  if (!method) {
    if (typeof raw === 'string' && raw.trim()) {
      return LEGACY_DISPLAY_ONLY[raw.trim()] ?? raw.trim()
    }
    return '—'
  }
  if (method === '계좌이체') {
    if (paymentStatus === 'confirmed') return '계좌이체 (확인됨)'
    if (paymentStatus === 'pending') return '계좌이체 (입금 대기)'
    return '계좌이체'
  }
  if (method === '스탭무료') return '스탭'
  return method
}

/** 신청 폼 결제 선택 UI 값 → DB canonical */
export type ApplyPaymentChoice = 'bank' | 'on_site' | ''

export function paymentMethodFromApplyChoice(
  choice: ApplyPaymentChoice
): PaymentMethod {
  if (choice === 'bank') return '계좌이체'
  return '현장현금'
}
