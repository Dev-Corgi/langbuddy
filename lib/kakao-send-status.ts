/**
 * POST /api/send-kakao-qr 응답의 kakaoSendStatus 값.
 * participant reconnect: 카카오 토큰 갱신 불가 → 본인 재로그인 필요.
 */

import type { Locale } from '@/lib/i18n'

export const KAKAO_SEND_PARTICIPANT_RECONNECT_STATUSES = new Set([
  'token_expired',
  'refresh_failed',
  'no_token',
])

export function kakaoSendNeedsParticipantKakaoReconnect(status: unknown): boolean {
  return typeof status === 'string' && KAKAO_SEND_PARTICIPANT_RECONNECT_STATUSES.has(status)
}

/** 관리자·운영자용: 참가자에게 전달할 안내 */
export function kakaoParticipantReconnectAdminHint(locale: Locale): string {
  return locale === 'en'
    ? 'Ask the participant to open their application complete page and tap "Reconnect Kakao" to sign in with Kakao again.'
    : '참가자에게 신청 완료 페이지에서「카카오 다시 연결」을 눌러 카카오로 다시 로그인하도록 안내해 주세요.'
}
