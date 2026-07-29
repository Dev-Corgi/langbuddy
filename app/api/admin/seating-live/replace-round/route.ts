import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'

type AssignmentPayload = {
  participant_id: string
  table_label: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const postingId = typeof body.postingId === 'string' ? body.postingId.trim() : ''
    const sessionDate =
      typeof body.sessionDate === 'string' ? body.sessionDate.trim().slice(0, 10) : ''
    const round = Number(body.round)
    const tableLanguages =
      body.tableLanguages && typeof body.tableLanguages === 'object'
        ? (body.tableLanguages as Record<string, string>)
        : {}
    const tableOrder = Array.isArray(body.tableOrder) ? (body.tableOrder as string[]) : null
    const langTableCounts =
      body.langTableCounts && typeof body.langTableCounts === 'object'
        ? (body.langTableCounts as Record<string, number>)
        : null
    const assignmentsRaw = Array.isArray(body.assignments)
      ? (body.assignments as AssignmentPayload[])
      : []
    const checkedParticipantIds = Array.isArray(body.checkedParticipantIds)
      ? (body.checkedParticipantIds as unknown[]).filter(
          (id): id is string => typeof id === 'string'
        )
      : []

    if (!postingId) {
      return NextResponse.json({ error: 'missing_posting_id' }, { status: 400 })
    }
    if (!sessionDate || sessionDate.length < 10) {
      return NextResponse.json({ error: 'invalid_session_date' }, { status: 400 })
    }
    if (!Number.isFinite(round)) {
      return NextResponse.json({ error: 'invalid_round' }, { status: 400 })
    }

    const checkedIds = new Set(checkedParticipantIds)
    const assignments = assignmentsRaw
      .filter(
        (a) =>
          a &&
          typeof a.participant_id === 'string' &&
          typeof a.table_label === 'string' &&
          a.table_label.trim() &&
          checkedIds.has(a.participant_id)
      )
      .map((a) => ({ participant_id: a.participant_id, table_label: a.table_label.trim() }))

    const admin = createSupabaseAdmin()
    const { error } = await admin.rpc('admin_replace_round_seating', {
      p_posting_id: postingId,
      p_session_date: sessionDate,
      p_round: round,
      p_table_languages: tableLanguages,
      p_table_order: tableOrder,
      p_lang_table_counts: langTableCounts,
      p_assignments: assignments,
    })

    if (error) {
      console.error('[seating-live/replace-round] rpc error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[seating-live/replace-round] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
