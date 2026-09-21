import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import { fetchSeatingHistorySessionSummaries } from '@/lib/seating-history-export'

export async function GET() {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const admin = createSupabaseAdmin()
    const sessions = await fetchSeatingHistorySessionSummaries(admin)
    const dates = sessions.map((s) => s.session_date)

    return NextResponse.json({
      sessions,
      minDate: dates.length ? dates[dates.length - 1] : null,
      maxDate: dates.length ? dates[0] : null,
      totalRows: sessions.reduce((sum, s) => sum + s.total_count, 0),
    })
  } catch (e) {
    console.error('[admin/seating-history/sessions]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
