import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import type { RoundData } from '@/lib/seating-algorithm'
import {
  roundsToTableLanguagesByRound,
  type SeatingConfigPayload,
} from '@/lib/seating-live-sync'

type AssignmentPayload = {
  round: number
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
    const postingId =
      typeof body.postingId === 'string' ? body.postingId.trim() : ''
    const sessionDate =
      typeof body.sessionDate === 'string' ? body.sessionDate.trim().slice(0, 10) : ''
    const langTableCounts =
      body.langTableCounts && typeof body.langTableCounts === 'object'
        ? (body.langTableCounts as Record<string, number>)
        : {}
    const rounds = Array.isArray(body.rounds) ? (body.rounds as RoundData[]) : []
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

    const checkedIds = new Set(checkedParticipantIds)
    const seating_config: SeatingConfigPayload = {
      langTableCounts,
      tableLanguagesByRound: roundsToTableLanguagesByRound(rounds),
    }

    const deduped = new Map<string, AssignmentPayload>()
    for (const round of rounds) {
      for (const assignment of round.assignments || []) {
        if (
          !assignment.participant_id ||
          !assignment.table_label ||
          !String(assignment.table_label).trim() ||
          !checkedIds.has(assignment.participant_id)
        ) {
          continue
        }
        deduped.set(`${round.round}:${assignment.participant_id}`, {
          round: round.round,
          participant_id: assignment.participant_id,
          table_label: String(assignment.table_label).trim(),
        })
      }
    }

    const assignments = [...deduped.values()]

    const admin = createSupabaseAdmin()
    const { error } = await admin.rpc('admin_persist_seating_live', {
      p_posting_id: postingId,
      p_session_date: sessionDate,
      p_seating_config: seating_config,
      p_assignments: assignments,
    })

    if (error) {
      console.error('[seating-live/persist] rpc error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[seating-live/persist] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
