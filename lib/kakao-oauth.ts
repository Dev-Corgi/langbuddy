/**
 * Kakao OAuth 토큰 갱신 (https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#refresh-token)
 *
 * 서버 환경 변수:
 * - KAKAO_REST_API_KEY (또는 NEXT_PUBLIC_KAKAO_APP_KEY 폴백): 앱 REST API 키를 client_id로 사용
 * - KAKAO_CLIENT_SECRET: 카카오 콘솔 앱 시크릿 (토큰 갱신 필수)
 */

export type KakaoRefreshOk = {
  ok: true
  access_token: string
  /** 교체 시 갱신 후 저장 */
  refresh_token?: string
  expires_in: number
}

export type KakaoRefreshErr = {
  ok: false
  error: string
  kakao?: unknown
}

export type KakaoRefreshResult = KakaoRefreshOk | KakaoRefreshErr

function kakaoClientId(): string | null {
  const rest = process.env.KAKAO_REST_API_KEY?.trim()
  if (rest) return rest
  const pub = process.env.NEXT_PUBLIC_KAKAO_APP_KEY?.trim()
  return pub || null
}

/** access_token이 JWT 형태면 exp(ms)로 만료 시각 추정 */
export function expiryIsoFromKakaoAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken || typeof accessToken !== 'string' || !accessToken.includes('.')) return null
  try {
    const mid = accessToken.split('.')[1]
    const json = Buffer.from(mid.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const payload = JSON.parse(json) as { exp?: number }
    if (typeof payload.exp === 'number') {
      return new Date(payload.exp * 1000).toISOString()
    }
  } catch {
    /* not a JWT */
  }
  return null
}

export async function refreshKakaoTokens(refreshToken: string): Promise<KakaoRefreshResult> {
  const clientId = kakaoClientId()
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      error:
        'Missing KAKAO_REST_API_KEY (or NEXT_PUBLIC_KAKAO_APP_KEY) / KAKAO_CLIENT_SECRET for Kakao token refresh',
    }
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    client_secret: clientSecret,
  })

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

  if (!res.ok) {
    const desc =
      (typeof json.error_description === 'string' && json.error_description) ||
      (typeof json.error === 'string' && json.error) ||
      'kakao_token_error'
    return { ok: false, error: desc, kakao: json }
  }

  const access_token = json.access_token
  const expires_in = json.expires_in
  if (typeof access_token !== 'string' || typeof expires_in !== 'number') {
    return { ok: false, error: 'invalid_kakao_token_response', kakao: json }
  }

  const refresh_token_out = typeof json.refresh_token === 'string' ? json.refresh_token : undefined

  return {
    ok: true,
    access_token,
    expires_in,
    ...(refresh_token_out ? { refresh_token: refresh_token_out } : {}),
  }
}
