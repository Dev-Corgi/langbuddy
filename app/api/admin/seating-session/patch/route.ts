import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveTodayLanguageExchangeSession } from '@/lib/seating-session-server/assemble'
import { persistSeatingSessionPatches } from '@/lib/seating-session-server/persist'
import { getStaffOpsUser } from '@/lib/seating-session-server/staff-auth'
import type { SeatingPatch } from '@/lib/seating-session/types'
import { koreanWeekdayLetterSeoul, todayYYYYMMDDSeoul } from '@/lib/session-event-date'

function parsePatches(raw: unknown): SeatingPatch[] {
  if (!Array.isArray(raw)) return []
  const out: SeatingPatch[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const op = (item as { op?: string }).op
    if (op === 'assign') {
      const p = item as {
        round?: number
        participantId?: string
        tableLabel?: string | null
      }
      if (typeof p.participantId === 'string' && Number.isFinite(Number(p.round))) {
        out.push({
          op: 'assign',
          round: Number(p.round),
          participantId: p.participantId,
          tableLabel:
            typeof p.tableLabel === 'string' && p.tableLabel.trim()
              ? p.tableLabel.trim()
              : null,
        })
      }
    } else if (op === 'replace_round') {
      const p = item as {
        round?: number
        assignments?: { participant_id?: string; table_label?: string }[]
        tableLanguages?: Record<string, string>
        tableOrder?: string[] | null
      }
      if (Number.isFinite(Number(p.round)) && p.tableLanguages) {
        out.push({
          op: 'replace_round',
          round: Number(p.round),
          assignments: (p.assignments ?? [])
            .filter(
              (a) => typeof a.participant_id === 'string' && typeof a.table_label === 'string'
            )
            .map((a) => ({
              participant_id: a.participant_id as string,
              table_label: a.table_label as string,
            })),
          tableLanguages: p.tableLanguages,
          tableOrder: Array.isArray(p.tableOrder) ? p.tableOrder : null,
        })
      }
    } else if (op === 'set_lang_table_counts') {
      const p = item as { langTableCounts?: Record<string, number> }
      if (p.langTableCounts && typeof p.langTableCounts === 'object') {
        out.push({ op: 'set_lang_table_counts', langTableCounts: p.langTableCounts })
      }
    } else if (op === 'checkin') {
      const p = item as { participantId?: string; source?: string }
      if (typeof p.participantId === 'string') {
        out.push({
          op: 'checkin',
          participantId: p.participantId,
          source: typeof p.source === 'string' ? p.source : undefined,
        })
      }
    } else if (op === 'uncheckin') {
      const p = item as { participantId?: string }
      if (typeof p.participantId === 'string') {
        out.push({ op: 'uncheckin', participantId: p.participantId })
      }
    }
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getStaffOpsUser(supabase)
    if (!user) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const sessionDate =
      typeof body.sessionDate === 'string'
        ? body.sessionDate.trim().slice(0, 10)
        : todayYYYYMMDDSeoul()
    const dayOfWeek =
      typeof body.dayOfWeek === 'string'
        ? body.dayOfWeek.trim()
        : koreanWeekdayLetterSeoul()
    const expectedRevision = Number(body.expectedRevision)
    const expectedEpoch = Number(body.expectedEpoch)
    const patches = parsePatches(body.patches)

    if (!Number.isFinite(expectedRevision) || !Number.isFinite(expectedEpoch)) {
      return NextResponse.json({ error: 'invalid_revision_or_epoch' }, { status: 400 })
    }
    if (patches.length === 0) {
      return NextResponse.json({ error: 'empty_patches' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const resolved = await resolveTodayLanguageExchangeSession(admin, sessionDate, dayOfWeek)
    if (!resolved) {
      return NextResponse.json({ error: 'no_active_session' }, { status: 404 })
    }

    const postingId =
      typeof body.postingId === 'string' && body.postingId.trim()
        ? body.postingId.trim()
        : resolved.postingId

    const result = await persistSeatingSessionPatches(admin, {
      postingId,
      sessionDate,
      formId: resolved.formId,
      dayOfWeek,
      expectedRevision,
      expectedEpoch,
      patches,
    })

    if (!result.ok) {
      if (result.status === 409) {
        return NextResponse.json(
          { error: result.reason, snapshot: result.snapshot },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      snapshot: result.snapshot,
      warnings: result.warnings,
      revision: result.revision,
    })
  } catch (err) {
    console.error('[seating-session PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
