import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { VALID_REPORT_REASONS } from '@/lib/report-reasons'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      reportedUserId,
      reportedName,
      postingId,
      sessionDate,
      round,
      reason,
      description,
    } = body

    // 기본 입력 검증
    if (
      typeof reportedUserId !== 'string' ||
      typeof postingId !== 'string' ||
      typeof sessionDate !== 'string' ||
      typeof round !== 'number' ||
      typeof reason !== 'string'
    ) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
    }

    if (!VALID_REPORT_REASONS.includes(reason as (typeof VALID_REPORT_REASONS)[number])) {
      return NextResponse.json({ error: 'invalid_reason' }, { status: 400 })
    }

    if (reportedUserId === user.id) {
      return NextResponse.json({ error: 'cannot_report_self' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    // 두 참가자가 실제로 같은 (posting_id, session_date, round)에 같은 테이블로
    // 배치되었는지 검증한다. 데이터가 아직 살아있으면 seating_assignments로,
    // 이미 주간 초기화로 삭제된 뒤라면 le_participation_archive 스냅샷으로 확인한다.
    let verified = false

    const { data: myResponses } = await admin
      .from('form_responses')
      .select('id')
      .eq('user_id', user.id)
    const myResponseIds = (myResponses || []).map((r) => r.id)

    if (myResponseIds.length > 0) {
      const { data: assignments } = await admin
        .from('seating_assignments')
        .select('participant_id, table_label')
        .eq('posting_id', postingId)
        .eq('session_date', sessionDate)
        .eq('round', round)
        .in('participant_id', myResponseIds)

      const myAssignment = assignments?.find((a) => myResponseIds.includes(String(a.participant_id)))

      if (myAssignment) {
        const { data: tableAssignments } = await admin
          .from('seating_assignments')
          .select('participant_id')
          .eq('posting_id', postingId)
          .eq('session_date', sessionDate)
          .eq('round', round)
          .eq('table_label', myAssignment.table_label)

        const tableParticipantIds = (tableAssignments || []).map((a) => String(a.participant_id))
        if (tableParticipantIds.length > 0) {
          const { data: tableResponses } = await admin
            .from('form_responses')
            .select('id, user_id')
            .in('id', tableParticipantIds)

          verified = (tableResponses || []).some((r) => r.user_id === reportedUserId)
        }
      }
    }

    if (!verified) {
      const { data: archiveRow } = await admin
        .from('le_participation_archive')
        .select('mates')
        .eq('user_id', user.id)
        .eq('posting_id', postingId)
        .eq('session_date', sessionDate)
        .eq('round', round)
        .maybeSingle()

      const mates = (archiveRow?.mates as Array<{ userId?: string | null }> | null) || []
      verified = mates.some((m) => m.userId === reportedUserId)
    }

    if (!verified) {
      return NextResponse.json({ error: 'not_same_session' }, { status: 403 })
    }

    const insertPayload: Record<string, unknown> = {
      reporter_user_id: user.id,
      reported_user_id: reportedUserId,
      reported_name: typeof reportedName === 'string' ? reportedName.trim() : '',
      posting_id: postingId,
      session_date: sessionDate,
      round,
      reason,
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
    }

    const { error: insertErr } = await admin.from('reports').insert(insertPayload)

    if (insertErr) {
      // unique constraint 위반 → 중복 신고
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'already_reported' }, { status: 409 })
      }
      console.error('[POST /api/reports]', insertErr)
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/reports] unexpected', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
