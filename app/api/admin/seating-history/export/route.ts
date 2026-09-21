import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import {
  buildSeatingHistoryWorkbook,
  fetchSeatingHistoryRows,
  isValidYmd,
} from '@/lib/seating-history-export'

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
    const buffer = buildSeatingHistoryWorkbook(rows, { from, to })
    const filename = `le-seating-history_${from}_${to}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[admin/seating-history/export]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
