import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { VALID_PRAISE_REASONS } from '@/lib/praise-reasons'

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
      praisedUserId,
      praisedName,
      postingId,
      sessionDate,
      round,
      reasons,
      comment,
    } = body

    if (
      typeof praisedUserId !== 'string' ||
      typeof postingId !== 'string' ||
      typeof sessionDate !== 'string' ||
      typeof round !== 'number' ||
      !Array.isArray(reasons) ||
      reasons.length === 0
    ) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
    }

    const normalizedReasons = reasons.filter(
      (r): r is (typeof VALID_PRAISE_REASONS)[number] =>
        typeof r === 'string' && VALID_PRAISE_REASONS.includes(r as (typeof VALID_PRAISE_REASONS)[number])
    )

    if (normalizedReasons.length === 0) {
      return NextResponse.json({ error: 'invalid_reasons' }, { status: 400 })
    }

    if (praisedUserId === user.id) {
      return NextResponse.json({ error: 'cannot_praise_self' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

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

          verified = (tableResponses || []).some((r) => r.user_id === praisedUserId)
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
      verified = mates.some((m) => m.userId === praisedUserId)
    }

    if (!verified) {
      return NextResponse.json({ error: 'not_same_session' }, { status: 403 })
    }

    const insertPayload: Record<string, unknown> = {
      praiser_user_id: user.id,
      praised_user_id: praisedUserId,
      praised_name: typeof praisedName === 'string' ? praisedName.trim() : '',
      posting_id: postingId,
      session_date: sessionDate,
      round,
      reasons: normalizedReasons,
      comment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
    }

    const { error: insertErr } = await admin.from('praises').insert(insertPayload)

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'already_praised' }, { status: 409 })
      }
      console.error('[POST /api/praises]', insertErr)
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/praises] unexpected', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
