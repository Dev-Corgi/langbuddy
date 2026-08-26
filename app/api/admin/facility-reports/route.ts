import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'

const PAGE_SIZE = 30

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') || 'all'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const offset = (page - 1) * PAGE_SIZE

    const admin = createSupabaseAdmin()

    let query = admin
      .from('facility_reports')
      .select(
        `
        id,
        created_at,
        session_date,
        reasons,
        comment,
        status,
        admin_note,
        posting_id,
        reporter_user_id,
        postings!inner(title)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data: rows, error, count } = await query

    if (error) {
      console.error('[GET /api/admin/facility-reports]', error)
      return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
    }

    const userIds = Array.from(
      new Set((rows || []).map((r) => r.reporter_user_id).filter(Boolean))
    ) as string[]

    const userNameMap = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: userRows } = await admin.from('users').select('id, name').in('id', userIds)
      for (const u of userRows || []) {
        if (u.name) userNameMap.set(u.id, u.name)
      }
    }

    const reports = (rows || []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      session_date: r.session_date,
      reasons: r.reasons as string[],
      comment: r.comment,
      status: r.status,
      admin_note: r.admin_note,
      posting_id: r.posting_id,
      posting_title: (r.postings as unknown as { title?: string })?.title || '',
      reporter_name: userNameMap.get(r.reporter_user_id) || '(알 수 없음)',
    }))

    return NextResponse.json({ reports, total: count ?? 0, page, pageSize: PAGE_SIZE })
  } catch (err) {
    console.error('[GET /api/admin/facility-reports] unexpected', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
