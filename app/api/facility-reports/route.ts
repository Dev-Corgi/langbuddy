import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { VALID_FACILITY_REPORT_REASONS } from '@/lib/facility-report-reasons'
import { verifySessionParticipation } from '@/lib/verify-session-participation'

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
    const { postingId, sessionDate, reasons, comment } = body

    if (
      typeof postingId !== 'string' ||
      typeof sessionDate !== 'string' ||
      !Array.isArray(reasons) ||
      reasons.length === 0
    ) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
    }

    const normalizedReasons = reasons.filter(
      (r): r is (typeof VALID_FACILITY_REPORT_REASONS)[number] =>
        typeof r === 'string' &&
        VALID_FACILITY_REPORT_REASONS.includes(r as (typeof VALID_FACILITY_REPORT_REASONS)[number])
    )

    if (normalizedReasons.length === 0) {
      return NextResponse.json({ error: 'invalid_reasons' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    const participated = await verifySessionParticipation(
      admin,
      user.id,
      postingId,
      sessionDate
    )

    if (!participated) {
      return NextResponse.json({ error: 'not_participant' }, { status: 403 })
    }

    const { error: insertErr } = await admin.from('facility_reports').insert({
      reporter_user_id: user.id,
      posting_id: postingId,
      session_date: sessionDate,
      reasons: normalizedReasons,
      comment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
    })

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
      }
      console.error('[POST /api/facility-reports]', insertErr)
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/facility-reports] unexpected', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
