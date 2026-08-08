/** 카카오톡·인스타 등 인앱 WebView — file input / clipboard 등 제한이 많음 */
export type InAppBrowserKind = 'kakao' | 'instagram' | 'facebook' | 'line' | 'naver' | 'other'

export type InAppBrowserInfo = {
  isInApp: boolean
  kind: InAppBrowserKind | null
  /** 카카오톡 인앱 (Android Galaxy 포함) */
  isKakaoTalk: boolean
  userAgent: string
}

function detectKind(ua: string): InAppBrowserKind | null {
  if (/KAKAOTALK/i.test(ua)) return 'kakao'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV|Facebook/i.test(ua)) return 'facebook'
  if (/Line\//i.test(ua)) return 'line'
  if (/NAVER/i.test(ua) && /INAPP/i.test(ua)) return 'naver'
  return null
}

export function detectInAppBrowser(userAgent?: string): InAppBrowserInfo {
  const ua =
    userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '')

  const kind = detectKind(ua)
  const isInApp = kind !== null

  return {
    isInApp,
    kind,
    isKakaoTalk: kind === 'kakao',
    userAgent: ua,
  }
}
