export const EARLY_REWARD_HOURS = 24
export const STAMPS_PER_COUPON = 10

export type RewardAccount = {
  stamp_count: number
  coupon_count: number
  updated_at?: string
}

export type RewardLedgerEntry = {
  id: string
  entry_type: 'early_stamp' | 'coupon_used' | 'coupon_refunded' | 'legacy_migration'
  stamp_delta: number
  coupon_delta: number
  stamp_balance: number
  coupon_balance: number
  session_date: string | null
  created_at: string
}

export const EMPTY_REWARD_ACCOUNT: RewardAccount = {
  stamp_count: 0,
  coupon_count: 0,
}

function normalizeTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}

export function getEarlyRewardTiming(
  eventYmd: string,
  scheduleTime: string,
  now: Date = new Date()
): { eligible: boolean; eventAt: Date; deadlineAt: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventYmd)) return null
  const time = normalizeTime(scheduleTime)
  if (!time) return null
  const eventAt = new Date(`${eventYmd}T${time}+09:00`)
  if (Number.isNaN(eventAt.getTime())) return null
  const deadlineAt = new Date(eventAt.getTime() - EARLY_REWARD_HOURS * 60 * 60 * 1000)
  return { eligible: now.getTime() <= deadlineAt.getTime(), eventAt, deadlineAt }
}

export function formatRewardDeadline(date: Date, locale: 'ko' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}
