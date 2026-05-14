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

function shortId(id: string | undefined, len = 8): string {
  if (!id) return '(none)'
  return id.length <= len ? id : `${id.slice(0, len)}…`
}

type RecipientDebugRow = {
  name: string
  responseId: string
  userId: string
  table: string
  /** auth.identities provider 목록 */
  authProviders: string
  tryKakao: boolean
  hasKakaoUuidInUsers: boolean
  hadEmail: boolean
  gmailConfigured: boolean
  outcome: string
  detail?: string
}

export async function POST(request: NextRequest) {
  const t0 = Date.now()
  const steps: string[] = []
  const recipients: RecipientDebugRow[] = []
  const pushStep = (msg: string) => {
    const elapsed = `${Date.now() - t0}ms`
    const line = `[${elapsed}] ${msg}`
    steps.push(line)
    console.log('[notify-seating-round]', line)
  }

  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    pushStep(`admin_ok user=${shortId(adminUser.id)}`)

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
      pushStep('fail invalid_params')
      return NextResponse.json(
        { error: 'invalid_params', debug: { steps } },
        { status: 400 }
      )
    }
    if (!assignments?.length || !participants?.length) {
      pushStep('fail empty_assignments')
      return NextResponse.json(
        { error: 'empty_assignments', debug: { steps } },
        { status: 400 }
      )
    }

    pushStep(
      `input posting=${shortId(postingId)} date=${sessionDate} round=${round} assignments=${assignments.length} participants=${participants.length}`
    )

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
      pushStep(`fail load_responses error=${frErr?.message || 'empty'}`)
      return NextResponse.json(
        { error: 'load_responses_failed', debug: { steps } },
        { status: 500 }
      )
    }

    pushStep(`form_responses rows=${formRows.length}`)

    const userByResponseId = new Map<string, string>()
    for (const row of formRows) {
      if (row.user_id) userByResponseId.set(row.id as string, row.user_id as string)
    }

    const userIds = [...new Set([...userByResponseId.values()])]

    type AuthMeta = {
      email?: string
      tryKakao: boolean
      authProviders: string
      hasKakaoUuidInUsers: boolean
    }
    const authMetaByUserId = new Map<string, AuthMeta>()

    await Promise.all(
      userIds.map(async (uid) => {
        const { data, error } = await admin.auth.admin.getUserById(uid)
        if (error || !data.user) {
          pushStep(`getUserById miss uid=${shortId(uid)} err=${error?.message || 'no_user'}`)
          return
        }
        const email = data.user.email
        const authProviders =
          data.user.identities?.map((i) => i.provider).join(',') || '(none)'
        const isKakaoIdentity =
          data.user.identities?.some((i) => i.provider === 'kakao') === true
        authMetaByUserId.set(uid, {
          email: email ?? undefined,
          tryKakao: isKakaoIdentity,
          authProviders,
          hasKakaoUuidInUsers: false,
        })
      })
    )

    pushStep(
      `auth_meta loaded=${authMetaByUserId.size}/${userIds.length} userIds=${userIds.length}`
    )

    const { data: usersMeta } = await admin.from('users').select('id, kakao_uuid').in('id', userIds)
    let uuidRows = 0
    for (const u of usersMeta || []) {
      const id = u.id as string
      const uuid = u.kakao_uuid
      const meta = authMetaByUserId.get(id)
      if (meta && typeof uuid === 'string' && uuid.length > 0) {
        meta.tryKakao = true
        meta.hasKakaoUuidInUsers = true
        uuidRows += 1
      }
    }

    const tryKakaoCount = [...authMetaByUserId.values()].filter((m) => m.tryKakao).length
    pushStep(
      `users_meta rows=${usersMeta?.length ?? 0} with_kakao_uuid=${uuidRows} tryKakao_users=${tryKakaoCount} gmail=${isGmailMailConfigured()}`
    )

    let kakaoOk = 0
    let emailOk = 0
    let skipped = 0
    const errors: string[] = []

    for (const [tableLabel, pids] of byTable) {
      pushStep(`table "${tableLabel}" pids=${pids.length}`)

      const seatParticipants: SeatingNotifyParticipant[] = pids
        .map((id) => participantById.get(id))
        .filter(Boolean) as SeatingNotifyParticipant[]

      const tableLanguage = tableLanguages[tableLabel] || ''

      let png: Buffer
      try {
        png = await buildSeatingTablePngBuffer(round, tableLabel, tableLanguage, seatParticipants)
        pushStep(`png_ok ${tableLabel} bytes=${png.length}`)
      } catch (e) {
        console.error('[notify-seating-round] png:', e)
        errors.push(`png:${tableLabel}`)
        pushStep(`png_fail ${tableLabel} ${e instanceof Error ? e.message : String(e)}`)
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
        pushStep(`upload_fail ${tableLabel} ${upErr.message}`)
        continue
      }

      const {
        data: { publicUrl },
      } = admin.storage.from('qr-codes').getPublicUrl(fileName)
      pushStep(`storage_public ok file=${shortId(fileName, 24)}`)

      const { width: imgW, height: imgH } = seatingNotifyImageDimensions(seatParticipants.length)

      const gmailOk = isGmailMailConfigured()

      for (const pid of pids) {
        const p = participantById.get(pid)
        const userId = userByResponseId.get(pid)
        if (!p || !userId) {
          skipped += 1
          recipients.push({
            name: p?.name || '(unknown)',
            responseId: shortId(pid),
            userId: shortId(userId),
            table: tableLabel,
            authProviders: '—',
            tryKakao: false,
            hasKakaoUuidInUsers: false,
            hadEmail: false,
            gmailConfigured: gmailOk,
            outcome: 'skipped',
            detail: !p ? 'no_participant_payload' : 'no_user_id_on_form_response',
          })
          pushStep(
            `skip pid=${shortId(pid)} reason=${!p ? 'no_participant' : 'no_form_user_id'}`
          )
          continue
        }

        const meta = authMetaByUserId.get(userId)
        const email = meta?.email
        let notified = false

        if (!meta) {
          skipped += 1
          recipients.push({
            name: p.name,
            responseId: shortId(pid),
            userId: shortId(userId),
            table: tableLabel,
            authProviders: '—',
            tryKakao: false,
            hasKakaoUuidInUsers: false,
            hadEmail: false,
            gmailConfigured: gmailOk,
            outcome: 'skipped',
            detail: 'auth_user_not_loaded',
          })
          pushStep(
            `skip name=${p.name} uid=${shortId(userId)} reason=no_auth_meta`
          )
          await sleep(120)
          continue
        }

        if (meta.tryKakao) {
          pushStep(
            `kakao_try name=${p.name} uid=${shortId(userId)} providers=${meta.authProviders}`
          )
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
            recipients.push({
              name: p.name,
              responseId: shortId(pid),
              userId: shortId(userId),
              table: tableLabel,
              authProviders: meta.authProviders,
              tryKakao: true,
              hasKakaoUuidInUsers: meta.hasKakaoUuidInUsers,
              hadEmail: Boolean(email),
              gmailConfigured: gmailOk,
              outcome: 'kakao_sent',
            })
            pushStep(`kakao_ok name=${p.name}`)
            await sleep(320)
          } else {
            console.warn('[notify-seating-round] Kakao memo failed', userId, kakaoSent.code, kakaoSent.detail)
            errors.push(`kakao:${p.name}:${kakaoSent.code}`)
            pushStep(`kakao_fail name=${p.name} code=${kakaoSent.code}`)
            recipients.push({
              name: p.name,
              responseId: shortId(pid),
              userId: shortId(userId),
              table: tableLabel,
              authProviders: meta.authProviders,
              tryKakao: true,
              hasKakaoUuidInUsers: meta.hasKakaoUuidInUsers,
              hadEmail: Boolean(email),
              gmailConfigured: gmailOk,
              outcome: 'kakao_failed',
              detail: String(kakaoSent.code),
            })
          }
        }

        if (notified) continue

        if (email && gmailOk) {
          pushStep(`email_try name=${p.name} has_email=true`)
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
            recipients.push({
              name: p.name,
              responseId: shortId(pid),
              userId: shortId(userId),
              table: tableLabel,
              authProviders: meta.authProviders,
              tryKakao: meta.tryKakao,
              hasKakaoUuidInUsers: meta.hasKakaoUuidInUsers,
              hadEmail: true,
              gmailConfigured: gmailOk,
              outcome: 'email_sent',
            })
            pushStep(`email_ok name=${p.name}`)
          } else {
            skipped += 1
            errors.push(`email:${pid}:${sent.error}`)
            recipients.push({
              name: p.name,
              responseId: shortId(pid),
              userId: shortId(userId),
              table: tableLabel,
              authProviders: meta.authProviders,
              tryKakao: meta.tryKakao,
              hasKakaoUuidInUsers: meta.hasKakaoUuidInUsers,
              hadEmail: true,
              gmailConfigured: gmailOk,
              outcome: 'email_failed',
              detail: sent.error,
            })
            pushStep(`email_fail name=${p.name} ${sent.error}`)
          }
        } else {
          skipped += 1
          if (!email) errors.push(`no_channel:${pid}`)
          else errors.push(`email_not_configured`)
          recipients.push({
            name: p.name,
            responseId: shortId(pid),
            userId: shortId(userId),
            table: tableLabel,
            authProviders: meta.authProviders,
            tryKakao: meta.tryKakao,
            hasKakaoUuidInUsers: meta.hasKakaoUuidInUsers,
            hadEmail: Boolean(email),
            gmailConfigured: gmailOk,
            outcome: 'skipped',
            detail: !email ? 'no_email_on_auth_user' : 'gmail_not_configured',
          })
          pushStep(
            `skip name=${p.name} ${!email ? 'no_email' : 'email_not_configured'} tryKakaoDone=${notified}`
          )
        }

        await sleep(120)
      }
    }

    const totalMs = Date.now() - t0
    pushStep(`done totalMs=${totalMs} kakao=${kakaoOk} email=${emailOk} skipped=${skipped}`)

    const summary = {
      totalMs,
      tables: byTable.size,
      assignmentRows: assignments.length,
      formResponseRows: formRows.length,
      distinctUserIds: userIds.length,
      authMetaLoaded: authMetaByUserId.size,
      usersTableRowsWithKakaoUuid: uuidRows,
      usersFlaggedTryKakao: tryKakaoCount,
      gmailConfigured: isGmailMailConfigured(),
      sent: { kakao: kakaoOk, email: emailOk, skipped },
    }

    return NextResponse.json({
      ok: true,
      sent: { kakao: kakaoOk, email: emailOk, skipped },
      errors: errors.slice(0, 30),
      debug: {
        summary,
        steps,
        recipients: recipients.slice(0, 80),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[notify-seating-round]', e)
    return NextResponse.json(
      { error: 'server_error', message: msg, debug: { steps } },
      { status: 500 }
    )
  }
}
