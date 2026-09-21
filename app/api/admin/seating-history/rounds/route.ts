import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import { isValidYmd } from '@/lib/seating-history-export'
import { fetchAvailableHistoryRounds } from '@/lib/seating-history-view'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const sessionDate = request.nextUrl.searchParams.get('session_date')?.trim() || ''
    if (!isValidYmd(sessionDate)) {
      return NextResponse.json({ error: 'invalid_session_date' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const rounds = await fetchAvailableHistoryRounds(admin, sessionDate)

    return NextResponse.json({ session_date: sessionDate, rounds })
  } catch (e) {
    console.error('[admin/seating-history/rounds]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
