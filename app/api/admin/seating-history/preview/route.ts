import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import { fetchSeatingHistoryRows, isValidYmd } from '@/lib/seating-history-export'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const from = request.nextUrl.searchParams.get('from')?.trim() || ''
    const to = request.nextUrl.searchParams.get('to')?.trim() || ''

    if (!isValidYmd(from) || !isValidYmd(to)) {
      return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 })
    }
    if (from > to) {
      return NextResponse.json({ error: 'from_after_to' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const rows = await fetchSeatingHistoryRows(admin, from, to)

    const sessionSet = new Set(rows.map((r) => r.session_date))
    const archiveCount = rows.filter((r) => r.source === 'archive').length
    const liveCount = rows.filter((r) => r.source === 'live').length

    return NextResponse.json({
      totalRows: rows.length,
      sessionCount: sessionSet.size,
      archiveCount,
      liveCount,
    })
  } catch (e) {
    console.error('[admin/seating-history/preview]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
