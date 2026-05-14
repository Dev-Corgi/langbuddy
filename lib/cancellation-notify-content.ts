function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** bilingual: 한국어 | English 구역 (이메일 본문) */
export function cancellationEmailHtml(opts: {
  displayName: string
  eventTitle: string
  siteUrl: string
}): string {
  const name = escapeHtml(opts.displayName)
  const title = escapeHtml(opts.eventTitle)
  const home = escapeHtml(opts.siteUrl.replace(/\/$/, ''))

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e4e4e7;box-shadow:0 8px 30px rgba(0,0,0,.08);">
<tr><td style="padding:28px 28px 20px;background:linear-gradient(135deg,#4f46e5,#7c3aed);">
<p style="margin:0;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:700;">LANGBUDDY</p>
<h1 style="margin:10px 0 0;font-size:20px;font-weight:800;color:#fff;line-height:1.35;">신청 취소 안내 · Application update</h1>
</td></tr>
<tr><td style="padding:26px 28px;">
<p style="margin:0 0 8px;font-size:11px;font-weight:800;color:#71717a;letter-spacing:.06em;">한국어</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#3f3f46;">
안녕하세요, <strong style="color:#18181b;">${name}</strong>님.<br/><br/>
<strong style="color:#18181b;">${title}</strong> 신청 건이 운영자에 의해 <strong style="color:#18181b;">취소 처리</strong>되었습니다.
더 이상 본 신청으로는 참가가 확정되지 않습니다. 착오가 있으셨다면 모임 페이지에서 다시 신청해 주시거나, 문의 채널을 이용해 주세요.
</p>
<hr style="border:none;border-top:1px solid #f4f4f5;margin:22px 0;"/>
<p style="margin:0 0 8px;font-size:11px;font-weight:800;color:#71717a;letter-spacing:.06em;">English</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#3f3f46;">
Hello <strong style="color:#18181b;">${name}</strong>,<br/><br/>
Your application for <strong style="color:#18181b;">${title}</strong> has been <strong style="color:#18181b;">cancelled by an administrator</strong>.
This registration is no longer valid. If this was unexpected, you may submit a new application from our site or reach out through our usual contact channels.
</p>
<a href="${home}" style="display:inline-block;padding:14px 26px;background:#18181b;color:#fff!important;text-decoration:none;font-weight:800;font-size:14px;border-radius:12px;">LangBuddy 홈으로 · Visit LangBuddy</a>
</td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid #f4f4f5;background:#fafafa;">
<p style="margin:0;font-size:11px;line-height:1.55;color:#a1a1aa;">본 메일은 신청 상태 변경을 안내하기 위해 발송되었습니다. / This message was sent to notify you of a registration status change.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

/** 카카오 feed (이미지 URL 필요) — 설명에 한·영 병기 */
export function cancellationKakaoFeed(opts: {
  displayName: string
  eventTitle: string
  imageUrl: string
  siteUrl: string
}) {
  const descKo = `${opts.displayName}님, 「${opts.eventTitle}」 신청이 운영 취소되었습니다. 더 이상 본 건으로 참가 확정되지 않습니다. 착오 시 사이트에서 재신청해 주세요.`
  const descEn = `${opts.displayName}, your application for 「${opts.eventTitle}」 was cancelled by an admin. This sign-up is no longer valid. Please re-apply on the site if needed.`
  return {
    object_type: 'feed' as const,
    content: {
      title: 'LangBuddy — 신청 취소 · Application cancelled',
      description: `${descKo}\n\n—\n\n${descEn}`,
      image_url: opts.imageUrl,
      image_width: 400,
      image_height: 400,
      link: {
        web_url: opts.siteUrl,
        mobile_web_url: opts.siteUrl,
      },
    },
    buttons: [
      {
        title: 'LangBuddy 열기 · Open site',
        link: {
          web_url: opts.siteUrl,
          mobile_web_url: opts.siteUrl,
        },
      },
    ],
  }
}
