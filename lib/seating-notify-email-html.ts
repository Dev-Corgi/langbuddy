export function seatingAssignmentNotifyEmailHtml(opts: {
  name: string
  round: number
  tableLabel: string
  eventTitle: string
}): string {
  const { name, round, tableLabel, eventTitle } = opts
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>테이블 안내</title>
</head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 28px rgba(15,23,42,0.08);">
          <tr><td style="height:4px;background:linear-gradient(90deg,#6366f1,#14b8a6);"></td></tr>
          <tr>
            <td style="padding:28px 24px 12px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:0.18em;color:#6366f1;">LANGBUDDY</p>
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#111827;">자리 배치 안내</h1>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.55;color:#6b7280;">
                <strong style="color:#111;">${escapeHtml(name)}</strong>님, <strong>${escapeHtml(
    eventTitle
  )}</strong> ${round}라운드 테이블이 정해졌습니다.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;">
              <div style="border-radius:16px;background:linear-gradient(145deg,#f5f3ff,#ecfeff);border:1px solid #c7d2fe;padding:22px 20px;text-align:center;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6b7280;">나의 테이블</p>
                <p style="margin:0;font-size:36px;font-weight:800;color:#3730a3;letter-spacing:0.06em;">${escapeHtml(
                  tableLabel
                )}</p>
              </div>
              <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#6b7280;">
                아래 첨부 이미지에서 <strong>같은 테이블</strong>에 배정된 참가자를 확인할 수 있습니다.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:11px;color:#a1a1aa;">이 메일은 자리배치 확정 시 자동 발송됩니다.</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
