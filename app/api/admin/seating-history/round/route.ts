import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import { isValidYmd } from '@/lib/seating-history-export'
import { fetchHistoryRoundView } from '@/lib/seating-history-view'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const sessionDate = request.nextUrl.searchParams.get('session_date')?.trim() || ''
    const roundRaw = request.nextUrl.searchParams.get('round')
    const round = roundRaw ? Number.parseInt(roundRaw, 10) : NaN

    if (!isValidYmd(sessionDate)) {
      return NextResponse.json({ error: 'invalid_session_date' }, { status: 400 })
    }
    if (!Number.isFinite(round) || round < 1 || round > 3) {
      return NextResponse.json({ error: 'invalid_round' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const view = await fetchHistoryRoundView(admin, sessionDate, round)
    if (!view) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return NextResponse.json({ view })
  } catch (e) {
    console.error('[admin/seating-history/round]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
