import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { isGmailMailConfigured, sendHtmlEmail } from '@/lib/mail-outbound'
import {
  resolveApplicationSessionYmd,
  buildRecurringSessionDisplayTitles,
} from '@/lib/session-event-date'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function qrEmailHtml(opts: {
  locale: 'ko' | 'en'
  formTitle: string
  displayName: string
  qrImageUrl: string
  completeUrl: string
}) {
  const isEn = opts.locale === 'en'
  const headline = isEn ? 'Your LangBuddy check-in QR' : 'LangBuddy 입장용 QR 코드'
  const sub = isEn
    ? 'Show this QR at the venue. You can reopen it anytime with the button below.'
    : '행사 당일 현장에서 이 QR을 제시해 주세요. 아래 버튼으로 언제든 다시 열 수 있어요.'
  const cta = isEn ? 'Open my QR page' : 'QR 페이지 열기'
  const eventLabel = isEn ? 'Event' : '모임'
  const nameLabel = isEn ? 'Name' : '이름'
  const foot = isEn
    ? 'You received this because you requested your QR from LangBuddy.'
    : 'LangBuddy에서 이메일로 QR 받기를 요청해 발송되었습니다.'

  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ko'}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e4e4e7;box-shadow:0 8px 30px rgba(0,0,0,.08);">
<tr><td style="padding:28px 28px 20px;background:linear-gradient(135deg,#4f46e5,#7c3aed);">
<p style="margin:0;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:700;">LANGBUDDY</p>
<h1 style="margin:10px 0 0;font-size:22px;font-weight:800;color:#fff;line-height:1.3;">${headline}</h1>
</td></tr>
<tr><td style="padding:24px 28px;">
<p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#3f3f46;">${sub}</p>
<div style="margin:0 auto 22px;text-align:center;background:#fafafa;border-radius:16px;border:1px solid #e4e4e7;padding:20px;">
<img src="${opts.qrImageUrl}" alt="QR" width="240" height="240" style="display:inline-block;border-radius:12px;vertical-align:middle;"/>
</div>
<p style="margin:0 0 6px;font-size:12px;color:#71717a;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${eventLabel}</p>
<p style="margin:0 0 18px;font-size:17px;font-weight:800;color:#18181b;line-height:1.35;">${escapeHtml(opts.formTitle)}</p>
<p style="margin:0 0 24px;font-size:14px;color:#52525b;"><span style="font-weight:700;color:#18181b;">${nameLabel}</span>　${escapeHtml(opts.displayName)}</p>
<a href="${opts.completeUrl}" style="display:inline-block;padding:14px 26px;background:#18181b;color:#fff!important;text-decoration:none;font-weight:800;font-size:14px;border-radius:12px;">${cta}</a>
</td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid #f4f4f5;background:#fafafa;">
<p style="margin:0;font-size:11px;line-height:1.55;color:#a1a1aa;">${foot}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

export async function POST(request: NextRequest) {
  try {
    if (!isGmailMailConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'email_not_configured',
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const responseId = body.responseId as string | undefined
    const locale = body.locale === 'en' ? 'en' : 'ko'

    if (!responseId) {
      return NextResponse.json({ ok: false, error: 'missing_response_id' }, { status: 400 })
    }

    const authClient = await createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const toEmail = user.email
    if (!toEmail) {
      return NextResponse.json({ ok: false, error: 'no_email' }, { status: 400 })
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: row, error: rowErr } = await admin
      .from('form_responses')
      .select('id, user_id, qr_code, answers, created_at, form_id, forms(title, title_en)')
      .eq('id', responseId)
      .single()

    if (rowErr || !row) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }

    if (!row.user_id || row.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const qrPayload = row.qr_code as string | null
    if (!qrPayload) {
      return NextResponse.json({ ok: false, error: 'no_qr' }, { status: 400 })
    }

    const formRow = row as { forms?: { title?: string; title_en?: string } }
    const titleFallback =
      locale === 'en' && formRow.forms?.title_en
        ? formRow.forms.title_en
        : formRow.forms?.title || 'LangBuddy'

    const answers = (row.answers || {}) as Record<string, unknown>

    let recurringKind: 'language' | 'study' | null = null
    if (row.form_id) {
      const [{ data: leRow }, { data: stRow }] = await Promise.all([
        admin
          .from('language_exchange_schedules')
          .select('form_id')
          .eq('form_id', row.form_id as string)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle(),
        admin
          .from('study_schedules')
          .select('form_id')
          .eq('form_id', row.form_id as string)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle(),
      ])
      recurringKind = leRow ? ('language' as const) : stRow ? ('study' as const) : null
    }

    const sessionYmd = resolveApplicationSessionYmd(
      answers._selected_day,
      answers._event_date,
      (row.created_at as string) || new Date().toISOString()
    )
    const builtTitles =
      recurringKind && sessionYmd.length >= 10
        ? buildRecurringSessionDisplayTitles(answers._selected_day, sessionYmd, recurringKind)
        : null
    const formTitle = builtTitles
      ? locale === 'en'
        ? builtTitles.title_en
        : builtTitles.title
      : titleFallback

    const displayName =
      (typeof answers.name === 'string' && answers.name) ||
      (typeof answers.이름 === 'string' && answers.이름) ||
      '—'

    const qrImageBuffer = await QRCode.toBuffer(qrPayload, {
      width: 520,
      margin: 2,
      type: 'png',
      color: { dark: '#0f172a', light: '#ffffff' },
    })

    const fileName = `qr-email-${responseId}-${Date.now()}.png`
    const { error: uploadError } = await admin.storage.from('qr-codes').upload(fileName, qrImageBuffer, {
      contentType: 'image/png',
      cacheControl: '3600',
    })

    if (uploadError) {
      console.error('[send-qr-email] storage upload:', uploadError)
      return NextResponse.json({ ok: false, error: 'upload_failed' }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = admin.storage.from('qr-codes').getPublicUrl(fileName)

    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get('origin') ||
      request.nextUrl.origin ||
      ''
    const completeUrl = `${base.replace(/\/$/, '')}/apply/complete?id=${responseId}`

    const html = qrEmailHtml({
      locale,
      formTitle,
      displayName,
      qrImageUrl: publicUrl,
      completeUrl,
    })

    const subject =
      locale === 'en'
        ? `Your QR — ${formTitle.slice(0, 60)}`
        : `[LangBuddy] 입장 QR — ${formTitle.slice(0, 60)}`

    const sent = await sendHtmlEmail({
      to: toEmail,
      subject,
      html,
    })

    if (!sent.ok) {
      if (sent.error === 'email_not_configured') {
        return NextResponse.json({ ok: false, error: 'email_not_configured' }, { status: 503 })
      }
      return NextResponse.json({ ok: false, error: 'send_failed' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[send-qr-email]', e)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
