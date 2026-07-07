/** arrange·관리자 모달에서 쓰는 canonical 결제 수단 (DB answers._payment_method) */
export const PAYMENT_METHODS = [
  '계좌이체',
  '현장현금',
  '현장계좌',
  '쿠폰사용',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

const LEGACY_ALIASES: Record<string, PaymentMethod> = {
  계좌송금: '계좌이체',
  계좌이체: '계좌이체',
  현장결제: '현장현금',
  현장현금: '현장현금',
  현장계좌: '현장계좌',
  현장추가: '현장현금',
  테스트더미: '현장현금',
  무료쿠폰: '쿠폰사용',
  '무료쿠폰(10스탬프)': '쿠폰사용',
  쿠폰사용: '쿠폰사용',
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

export function isCouponPaymentMethod(raw: unknown): boolean {
  return normalizePaymentMethod(raw) === '쿠폰사용'
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

/** answers._le_free_coupon 플래그 (디지털 쿠폰 차감 없음 — 표시용만) */
export function couponFlagForMethod(method: PaymentMethod): boolean {
  return method === '쿠폰사용'
}

export function formatPaymentMethodLabel(
  raw: unknown,
  paymentStatus?: string | null
): string {
  const method = normalizePaymentMethod(raw)
  if (!method) {
    return typeof raw === 'string' && raw.trim() ? raw.trim() : '—'
  }
  if (method === '계좌이체') {
    if (paymentStatus === 'confirmed') return '계좌이체 (확인됨)'
    if (paymentStatus === 'pending') return '계좌이체 (입금 대기)'
    return '계좌이체'
  }
  return method
}

/** 신청 폼 결제 선택 UI 값 → DB canonical */
export type ApplyPaymentChoice = 'bank' | 'on_site' | 'coupon' | ''

export function paymentMethodFromApplyChoice(
  choice: ApplyPaymentChoice,
  options?: { leCouponWaived?: boolean }
): PaymentMethod {
  if (choice === 'coupon' || options?.leCouponWaived) return '쿠폰사용'
  if (choice === 'bank') return '계좌이체'
  return '현장현금'
}
