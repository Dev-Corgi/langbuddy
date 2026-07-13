import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const VALID_REASONS = [
  '폭언/욕설',
  '성희롱/부적절한 언행',
  '노쇼/자리이탈',
  '허위 정보',
  '기타',
] as const

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
      reportedResponseId,
      reporterResponseId,
      postingId,
      sessionDate,
      round,
      reason,
      description,
    } = body

    // 기본 입력 검증
    if (
      typeof reportedResponseId !== 'string' ||
      typeof reporterResponseId !== 'string' ||
      typeof postingId !== 'string' ||
      typeof sessionDate !== 'string' ||
      typeof round !== 'number' ||
      typeof reason !== 'string'
    ) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
    }

    if (!VALID_REASONS.includes(reason as (typeof VALID_REASONS)[number])) {
      return NextResponse.json({ error: 'invalid_reason' }, { status: 400 })
    }

    if (reportedResponseId === reporterResponseId) {
      return NextResponse.json({ error: 'cannot_report_self' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    // 신고자 form_response가 실제로 이 사용자의 것인지 확인
    const { data: reporterResponse, error: reporterErr } = await admin
      .from('form_responses')
      .select('id, user_id')
      .eq('id', reporterResponseId)
      .single()

    if (reporterErr || !reporterResponse) {
      return NextResponse.json({ error: 'reporter_response_not_found' }, { status: 404 })
    }

    if (reporterResponse.user_id !== user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // 두 참가자가 같은 (posting_id, session_date, round, table_label)에 있는지 검증
    const { data: assignments } = await admin
      .from('seating_assignments')
      .select('participant_id, table_label')
      .eq('posting_id', postingId)
      .eq('session_date', sessionDate)
      .eq('round', round)
      .in('participant_id', [reporterResponseId, reportedResponseId])

    if (!assignments || assignments.length < 2) {
      return NextResponse.json({ error: 'not_same_session' }, { status: 403 })
    }

    const reporterAssign = assignments.find((a) => String(a.participant_id) === reporterResponseId)
    const reportedAssign = assignments.find((a) => String(a.participant_id) === reportedResponseId)

    if (!reporterAssign || !reportedAssign) {
      return NextResponse.json({ error: 'not_same_session' }, { status: 403 })
    }

    if (reporterAssign.table_label !== reportedAssign.table_label) {
      return NextResponse.json({ error: 'not_same_table' }, { status: 403 })
    }

    // 신고자의 users.id 조회 (reporter_user_id 필드 채우기)
    const { data: userRow } = await admin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!userRow) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }

    // 중복 신고 확인 및 insert
    const { error: insertErr } = await admin.from('reports').insert({
      reporter_user_id: user.id,
      reporter_response_id: reporterResponseId,
      reported_response_id: reportedResponseId,
      posting_id: postingId,
      session_date: sessionDate,
      round,
      reason,
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
    })

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
