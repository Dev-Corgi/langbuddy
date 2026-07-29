import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'

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
    const participantId =
      typeof body.participantId === 'string' ? body.participantId.trim() : ''
    const tableLabel =
      typeof body.tableLabel === 'string' && body.tableLabel.trim()
        ? body.tableLabel.trim()
        : null

    if (!postingId) {
      return NextResponse.json({ error: 'missing_posting_id' }, { status: 400 })
    }
    if (!sessionDate || sessionDate.length < 10) {
      return NextResponse.json({ error: 'invalid_session_date' }, { status: 400 })
    }
    if (!Number.isFinite(round)) {
      return NextResponse.json({ error: 'invalid_round' }, { status: 400 })
    }
    if (!participantId) {
      return NextResponse.json({ error: 'missing_participant_id' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const { error } = await admin.rpc('admin_assign_participant_table', {
      p_posting_id: postingId,
      p_session_date: sessionDate,
      p_round: round,
      p_participant_id: participantId,
      p_table_label: tableLabel,
    })

    if (error) {
      console.error('[seating-live/assign-participant] rpc error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[seating-live/assign-participant] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
