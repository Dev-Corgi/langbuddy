/** DB 저장값: 0~9 */
export const STAMP_STORED_MAX = 9

/** 체크인 모달 슬라이더: 0~10 (10 = 실물 쿠폰 사용 → 저장 시 0) */
export const STAMP_SLIDER_MAX = 10

export function storedStampToSlider(stored: number | null | undefined): number {
  const n = Math.round(Number(stored ?? 0))
  if (!Number.isFinite(n)) return 0
  return Math.min(STAMP_SLIDER_MAX, Math.max(0, n))
}

export function sliderStampToStored(slider: number): number {
  const n = Math.round(Number(slider))
  if (!Number.isFinite(n) || n >= STAMP_SLIDER_MAX) return 0
  return Math.min(STAMP_STORED_MAX, Math.max(0, n))
}

import { isCouponPaymentMethod } from '@/lib/supported-payment-methods'

export function isCouponApplication(
  answers: Record<string, unknown> | null | undefined
): boolean {
  if (!answers) return false
  if (answers._le_free_coupon === true) return true
  return isCouponPaymentMethod(answers._payment_method)
}
