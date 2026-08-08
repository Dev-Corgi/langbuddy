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
      .from('reports')
      .select(
        `
        id,
        created_at,
        session_date,
        round,
        reason,
        description,
        status,
        admin_note,
        posting_id,
        reporter_user_id,
        reported_user_id,
        reported_name,
        reporter_response_id,
        reported_response_id,
        postings!inner(title)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data: reportRows, error, count } = await query

    if (error) {
      console.error('[GET /api/admin/reports]', error)
      return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
    }

    // 신고자/신고 대상 이름 조회. user_id는 form_responses가 주간 초기화로
    // 삭제돼도 안정적으로 유지되므로 users 테이블에서 조회한다.
    // (신고 대상 이름은 신고 시점 스냅샷인 reported_name을 우선 사용)
    const userIds = Array.from(
      new Set(
        (reportRows || []).flatMap((r) => [r.reporter_user_id, r.reported_user_id].filter(Boolean))
      )
    ) as string[]

    const userNameMap = new Map<string, string>()
    const guestUserIds = new Set<string>()
    if (userIds.length > 0) {
      const { data: userRows } = await admin
        .from('users')
        .select('id, name, is_guest')
        .in('id', userIds)
      for (const u of userRows || []) {
        if (u.name) userNameMap.set(u.id, u.name)
        if (u.is_guest) guestUserIds.add(u.id)
      }
    }

    const reports = (reportRows || []).map((r) => {
      const reportedIsGuest = !!(r.reported_user_id && guestUserIds.has(r.reported_user_id))
      const baseReportedName =
        r.reported_name ||
        (r.reported_user_id ? userNameMap.get(r.reported_user_id) : undefined) ||
        '(알 수 없음)'
      return {
        id: r.id,
        created_at: r.created_at,
        session_date: r.session_date,
        round: r.round,
        reason: r.reason,
        description: r.description,
        status: r.status,
        admin_note: r.admin_note,
        posting_id: r.posting_id,
        posting_title: (r.postings as unknown as { title?: string })?.title || '',
        reporter_name: userNameMap.get(r.reporter_user_id) || '(알 수 없음)',
        reported_name: reportedIsGuest ? `${baseReportedName} (현장)` : baseReportedName,
        reported_is_guest: reportedIsGuest,
        reporter_response_id: r.reporter_response_id,
        reported_response_id: r.reported_response_id,
      }
    })

    return NextResponse.json({ reports, total: count ?? 0, page, pageSize: PAGE_SIZE })
  } catch (err) {
    console.error('[GET /api/admin/reports] unexpected', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
