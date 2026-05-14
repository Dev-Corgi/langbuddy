import nodemailer from 'nodemailer'

/** Gmail 앱 비밀번호가 서버에 설정되어 있으면 true */
export function isGmailMailConfigured(): boolean {
  return (
    !!process.env.GMAIL_USER?.trim() && !!process.env.GMAIL_APP_PASSWORD?.trim()
  )
}

function defaultMailFrom(): string {
  const u = process.env.GMAIL_USER!.trim()
  const custom = process.env.EMAIL_FROM?.trim()
  if (custom) return custom
  return `LangBuddy <${u}>`
}

/**
 * HTML 메일 1통 (Gmail SMTP만).
 * 실패 원인·한도 등은 서버 로그에만 남기고, 클라이언트에는 노출하지 않음.
 */
export async function sendHtmlEmail(opts: {
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType?: string
  }>
}): Promise<{ ok: true } | { ok: false; error: 'email_not_configured' | 'smtp_failed' }> {
  const gmailUser = process.env.GMAIL_USER?.trim()
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')

  if (!gmailUser || !gmailPass) {
    return { ok: false, error: 'email_not_configured' }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    })
    await transporter.sendMail({
      from: defaultMailFrom(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? 'application/octet-stream',
      })),
    })
    return { ok: true }
  } catch (e) {
    console.error('[mail-outbound] Gmail SMTP:', e)
    return { ok: false, error: 'smtp_failed' }
  }
}
