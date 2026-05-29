import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import { buildAutoRecurringFormTitles } from '@/lib/session-event-date'
import { ensureValidKakaoAccessToken } from '@/lib/kakao-token-ensure'
import {
  cancellationEmailHtml,
  cancellationKakaoFeed,
} from '@/lib/cancellation-notify-content'
import { isGmailMailConfigured, sendHtmlEmail } from '@/lib/mail-outbound'

function baseSiteUrl(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    request.headers.get('origin') ||
    request.nextUrl.origin ||
    ''
  )
}

/** 카카오 feed는 이미지 URL이 필요함. SVG는 거절될 수 있어 PNG 플레이스홀더 사용 */
function kakaoMemoImageUrl() {
  return 'https://placehold.co/400x400/4f46e5/ffffff/png?text=LangBuddy'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const responseId = body.responseId as string | undefined
    if (!responseId) {
      return NextResponse.json({ error: 'missing_response_id' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    const { data: row, error: rowErr } = await admin
      .from('form_responses')
      .select('id, form_id, user_id, answers, payment_receipt_url')
      .eq('id', responseId)
      .single()

    if (rowErr || !row) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const formId = row.form_id as string
    const { count: langCount } = await admin
      .from('language_exchange_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', formId)
    const { count: studyCount } = await admin
      .from('study_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', formId)

    if (!langCount && !studyCount) {
      return NextResponse.json(
        { error: 'only_language_or_study_forms' },
        { status: 403 }
      )
    }

    const answers = (row.answers || {}) as Record<string, unknown>
    const selectedDay =
      typeof answers._selected_day === 'string' ? answers._selected_day.trim() : ''
    const kind = langCount ? 'language' : 'study'
    let eventTitleEn = 'LangBuddy'
    if (selectedDay) {
      eventTitleEn = buildAutoRecurringFormTitles(selectedDay, kind).title_en
    } else {
      const { data: formMeta } = await admin
        .from('forms')
        .select('title, title_en')
        .eq('id', formId)
        .maybeSingle()
      eventTitleEn =
        (formMeta?.title_en || formMeta?.title || 'LangBuddy event') as string
    }

    const { data: nameQ } = await admin
      .from('form_questions')
      .select('id')
      .eq('form_id', formId)
      .eq('system_key', 'name')
      .maybeSingle()

    let displayName = 'Participant'
    if (nameQ?.id && answers[nameQ.id] != null) {
      displayName = String(answers[nameQ.id])
    } else if (row.user_id) {
      const { data: u } = await admin.from('users').select('name').eq('id', row.user_id).maybeSingle()
      if (u?.name) displayName = u.name
    }

    const siteUrl = baseSiteUrl(request) || 'https://langbuddy.kr'

    let notifyKakao: 'skipped' | 'sent' | 'failed' = 'skipped'
    let notifyEmail: 'skipped' | 'sent' | 'failed' = 'skipped'
    let notifyDetail: string | undefined

    if (row.user_id) {
      const { data: appUser } = await admin
        .from('users')
        .select('id, kakao_uuid, kakao_access_token')
        .eq('id', row.user_id)
        .maybeSingle()

      const hasKakao = !!(appUser as { kakao_uuid?: string } | null)?.kakao_uuid

      if (hasKakao) {
        const ensured = await ensureValidKakaoAccessToken(admin, row.user_id)
        if (!ensured.ok) {
          notifyKakao = 'failed'
          notifyDetail = `kakao_token:${ensured.code}`
        } else {
          const template = cancellationKakaoFeed({
            displayName,
            eventTitle: eventTitleEn,
            imageUrl: kakaoMemoImageUrl(),
            siteUrl,
          })

          const kakaoResponse = await fetch(
            'https://kapi.kakao.com/v2/api/talk/memo/default/send',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${ensured.accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                template_object: JSON.stringify(template),
              }),
            }
          )

          const kakaoJson = await kakaoResponse.json().catch(() => ({}))
          if (kakaoResponse.ok) {
            notifyKakao = 'sent'
          } else {
            notifyKakao = 'failed'
            notifyDetail =
              typeof (kakaoJson as { msg?: string }).msg === 'string'
                ? (kakaoJson as { msg: string }).msg
                : 'kakao_api_error'
          }
        }
      }

      const wantEmail = !hasKakao || notifyKakao === 'failed'
      if (wantEmail && isGmailMailConfigured()) {
        const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(
          row.user_id
        )
        const email = authUser?.user?.email
        if (authErr || !email) {
          notifyEmail = 'failed'
          notifyDetail = (notifyDetail ? notifyDetail + '; ' : '') + 'no_auth_email'
        } else {
          const html = cancellationEmailHtml({
            displayName,
            eventTitle: eventTitleEn,
            siteUrl,
          })
          const sent = await sendHtmlEmail({
            to: email,
            subject: `[LangBuddy] 신청 취소 안내 / Application cancelled — ${eventTitleEn.slice(0, 40)}`,
            html,
          })
          if (sent.ok) {
            notifyEmail = 'sent'
          } else {
            notifyEmail = 'failed'
            notifyDetail =
              (notifyDetail ? notifyDetail + '; ' : '') + (sent.error || 'mail_failed')
          }
        }
      } else if (wantEmail && !isGmailMailConfigured()) {
        notifyEmail = 'failed'
        notifyDetail =
          (notifyDetail ? notifyDetail + '; ' : '') + 'gmail_smtp_not_configured'
      }
    } else {
      notifyDetail = 'no_user_id_skipped_notify'
    }

    const { error: delErr } = await admin.rpc('admin_delete_form_response', {
      p_response_id: responseId,
      p_refund_coupon: true,
    })

    if (delErr) {
      console.error('[cancel-form-response] admin_delete_form_response', delErr)
      return NextResponse.json(
        { error: 'delete_response_failed', details: delErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      notify: {
        kakao: notifyKakao,
        email: notifyEmail,
        detail: notifyDetail,
        skippedNoUser: !row.user_id,
      },
    })
  } catch (e) {
    console.error('[cancel-form-response]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
