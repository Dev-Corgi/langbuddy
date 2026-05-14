import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshKakaoTokens } from '@/lib/kakao-oauth'

/** 액세스 토큰 만료 전 이 여유(초) 안이면 갱신 시도 */
const REFRESH_MARGIN_SEC = 120

export type EnsureKakaoTokenResult =
  | { ok: true; accessToken: string }
  | {
      ok: false
      code: 'user_not_found' | 'no_access_token' | 'no_refresh_token' | 'refresh_failed'
      message?: string
      kakao?: unknown
    }

/**
 * service role 클라이언트로 users 행을 읽고, 필요 시 refresh_token으로 액세스 토큰만 갱신해 DB에 반영.
 */
export async function ensureValidKakaoAccessToken(
  admin: SupabaseClient,
  userId: string
): Promise<EnsureKakaoTokenResult> {
  const { data: row, error } = await admin
    .from('users')
    .select('kakao_access_token, kakao_token_expires_at, kakao_refresh_token')
    .eq('id', userId)
    .single()

  if (error || !row) {
    return { ok: false, code: 'user_not_found' }
  }

  const access = row.kakao_access_token as string | null
  const expRaw = row.kakao_token_expires_at as string | null
  const refresh = row.kakao_refresh_token as string | null

  const now = Date.now()
  const expMs = expRaw ? new Date(expRaw).getTime() : NaN
  const hasKnownExpiry = Number.isFinite(expMs)
  const marginMs = REFRESH_MARGIN_SEC * 1000

  if (access && (!hasKnownExpiry || expMs > now + marginMs)) {
    return { ok: true, accessToken: access }
  }

  if (!refresh) {
    return { ok: false, code: 'no_refresh_token' }
  }

  const refreshed = await refreshKakaoTokens(refresh)
  if (!refreshed.ok) {
    await admin
      .from('users')
      .update({
        kakao_access_token: null,
        kakao_refresh_token: null,
        kakao_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    return {
      ok: false,
      code: 'refresh_failed',
      message: refreshed.error,
      kakao: refreshed.kakao,
    }
  }

  const newRefresh = refreshed.refresh_token ?? refresh
  const newExp = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  await admin
    .from('users')
    .update({
      kakao_access_token: refreshed.access_token,
      kakao_refresh_token: newRefresh,
      kakao_token_expires_at: newExp,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  return { ok: true, accessToken: refreshed.access_token }
}
