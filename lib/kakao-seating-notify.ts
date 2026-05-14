import { ensureValidKakaoAccessToken } from '@/lib/kakao-token-ensure'
import type { SupabaseClient } from '@supabase/supabase-js'

const MEMO_SEND_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send'

export async function sendSeatingTableKakaoMemo(opts: {
  admin: SupabaseClient
  userId: string
  name: string
  round: number
  tableLabel: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  linkUrl: string
}): Promise<{ ok: true } | { ok: false; code: string; detail?: unknown }> {
  const ensured = await ensureValidKakaoAccessToken(opts.admin, opts.userId)
  if (!ensured.ok) {
    return { ok: false, code: ensured.code, detail: ensured }
  }

  const templateObject = {
    object_type: 'feed',
    content: {
      title: `${opts.round}라운드 · 테이블 ${opts.tableLabel}`,
      description: `${opts.name}님\n나의 테이블: ${opts.tableLabel}\n이미지에서 테이블 모식도를 확인해 주세요.`,
      image_url: opts.imageUrl,
      image_width: opts.imageWidth,
      image_height: opts.imageHeight,
      link: {
        web_url: opts.linkUrl,
        mobile_web_url: opts.linkUrl,
      },
    },
    buttons: [
      {
        title: 'LangBuddy 열기',
        link: {
          web_url: opts.linkUrl,
          mobile_web_url: opts.linkUrl,
        },
      },
    ],
  }

  const kakaoRes = await fetch(MEMO_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ensured.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      template_object: JSON.stringify(templateObject),
    }),
  })

  const body = await kakaoRes.json().catch(() => ({}))
  if (!kakaoRes.ok) {
    return { ok: false, code: 'kakao_api', detail: body }
  }
  return { ok: true }
}
