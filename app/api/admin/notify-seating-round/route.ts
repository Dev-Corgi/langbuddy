import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import {
  buildSeatingTablePngBuffer,
  seatingNotifyImageDimensions,
  type SeatingNotifyParticipant,
} from '@/lib/seating-notify-image'
import { seatingAssignmentNotifyEmailHtml } from '@/lib/seating-notify-email-html'
import { sendSeatingTableKakaoMemo } from '@/lib/kakao-seating-notify'
import { isGmailMailConfigured, sendHtmlEmail } from '@/lib/mail-outbound'

type AssignmentPayload = { participant_id: string; table_label: string }
type ParticipantPayload = {
  id: string
  name: string
  nationality: string
  gender: string
  language: string
}

function baseLink(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    request.headers.get('origin') ||
    request.nextUrl.origin ||
    ''
  )
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const postingId = body.postingId as string | undefined
    const sessionDate = body.sessionDate as string | undefined
    const round = Number(body.round)
    const tableLanguages = (body.tableLanguages || {}) as Record<string, string>
    const assignments = body.assignments as AssignmentPayload[] | undefined
    const participants = body.participants as ParticipantPayload[] | undefined
    const eventTitle =
      (typeof body.eventTitle === 'string' && body.eventTitle.trim()) || 'LangBuddy 언어교환'

    if (!postingId || !sessionDate || !Number.isFinite(round) || round < 1 || round > 3) {
      return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
    }
    if (!assignments?.length || !participants?.length) {
      return NextResponse.json({ error: 'empty_assignments' }, { status: 400 })
    }

    const participantById = new Map(participants.map((p) => [p.id, p]))
    const admin = createSupabaseAdmin()
    const linkUrl = baseLink(request) || 'https://langbuddy.kr'

    const byTable = new Map<string, string[]>()
    for (const a of assignments) {
      const label = String(a.table_label || '').trim()
      if (!label || !participantById.has(a.participant_id)) continue
      if (!byTable.has(label)) byTable.set(label, [])
      byTable.get(label)!.push(a.participant_id)
    }

    const responseIds = [...new Set(assignments.map((a) => a.participant_id))]
    const { data: formRows, error: frErr } = await admin
      .from('form_responses')
      .select('id, user_id')
      .in('id', responseIds)

    if (frErr || !formRows?.length) {
      console.error('[notify-seating-round] form_responses:', frErr)
      return NextResponse.json({ error: 'load_responses_failed' }, { status: 500 })
    }

    const userByResponseId = new Map<string, string>()
    for (const row of formRows) {
      if (row.user_id) userByResponseId.set(row.id as string, row.user_id as string)
    }

    const userIds = [...new Set([...userByResponseId.values()])]
    const emailByUserId = new Map<string, string>()
    const { data: usersMeta } = await admin.from('users').select('id, kakao_uuid').in('id', userIds)
    const kakaoLinked = new Set(
      (usersMeta || [])
        .filter((u) => typeof u.kakao_uuid === 'string' && (u.kakao_uuid as string).length > 0)
        .map((u) => u.id as string)
    )

    await Promise.all(
      userIds.map(async (uid) => {
        const { data, error } = await admin.auth.admin.getUserById(uid)
        if (!error && data.user?.email) {
          emailByUserId.set(uid, data.user.email)
        }
      })
    )

    let kakaoOk = 0
    let emailOk = 0
    let skipped = 0
    const errors: string[] = []

    for (const [tableLabel, pids] of byTable) {
      const seatParticipants: SeatingNotifyParticipant[] = pids
        .map((id) => participantById.get(id))
        .filter(Boolean) as SeatingNotifyParticipant[]

      const tableLanguage = tableLanguages[tableLabel] || ''

      let png: Buffer
      try {
        png = await buildSeatingTablePngBuffer(round, tableLabel, tableLanguage, seatParticipants)
      } catch (e) {
        console.error('[notify-seating-round] png:', e)
        errors.push(`png:${tableLabel}`)
        continue
      }

      const ts = Date.now()
      const safe = tableLabel.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').slice(0, 24) || 't'
      const fileName = `seating-notify/${postingId}/${sessionDate}/r${round}-${safe}-${ts}.png`

      const { error: upErr } = await admin.storage.from('qr-codes').upload(fileName, png, {
        contentType: 'image/png',
        cacheControl: '3600',
      })
      if (upErr) {
        console.error('[notify-seating-round] upload:', upErr)
        errors.push(`upload:${tableLabel}`)
        continue
      }

      const {
        data: { publicUrl },
      } = admin.storage.from('qr-codes').getPublicUrl(fileName)

      const { width: imgW, height: imgH } = seatingNotifyImageDimensions(seatParticipants.length)

      for (const pid of pids) {
        const p = participantById.get(pid)
        const userId = userByResponseId.get(pid)
        if (!p || !userId) {
          skipped += 1
          continue
        }

        const email = emailByUserId.get(userId)
        let notified = false

        if (kakaoLinked.has(userId)) {
          const kakaoSent = await sendSeatingTableKakaoMemo({
            admin,
            userId,
            name: p.name,
            round,
            tableLabel,
            imageUrl: publicUrl,
            imageWidth: imgW,
            imageHeight: imgH,
            linkUrl,
          })
          if (kakaoSent.ok) {
            kakaoOk += 1
            notified = true
            await sleep(320)
          }
        }

        if (notified) continue

        if (email && isGmailMailConfigured()) {
          const html = seatingAssignmentNotifyEmailHtml({
            name: p.name,
            round,
            tableLabel,
            eventTitle,
          })
          const sent = await sendHtmlEmail({
            to: email,
            subject: `[LangBuddy] ${round}라운드 테이블 안내 (테이블 ${tableLabel})`,
            html,
            attachments: [
              {
                filename: `table-${round}-${tableLabel}.png`,
                content: png,
                contentType: 'image/png',
              },
            ],
          })
          if (sent.ok) {
            emailOk += 1
          } else {
            skipped += 1
            errors.push(`email:${pid}:${sent.error}`)
          }
        } else {
          skipped += 1
          if (!email) errors.push(`no_channel:${pid}`)
          else errors.push(`email_not_configured`)
        }

        await sleep(120)
      }
    }

    return NextResponse.json({
      ok: true,
      sent: { kakao: kakaoOk, email: emailOk, skipped },
      errors: errors.slice(0, 30),
    })
  } catch (e) {
    console.error('[notify-seating-round]', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
