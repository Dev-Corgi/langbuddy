import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import { extractParticipantInfoFromAnswers } from '@/lib/utils'

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

    // reporter / reported form_responses 이름 조회
    const responseIds = Array.from(
      new Set(
        (reportRows || []).flatMap((r) => [
          String(r.reporter_response_id),
          String(r.reported_response_id),
        ])
      )
    )

    let nameMap = new Map<string, string>()
    if (responseIds.length > 0) {
      const { data: frRows } = await admin
        .from('form_responses')
        .select('id, answers')
        .in('id', responseIds)

      for (const fr of frRows || []) {
        const info = extractParticipantInfoFromAnswers(
          (fr.answers || {}) as Record<string, unknown>,
          []
        )
        nameMap.set(fr.id, info.name || '(이름 없음)')
      }
    }

    const reports = (reportRows || []).map((r) => ({
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
      reporter_name: nameMap.get(String(r.reporter_response_id)) || '(알 수 없음)',
      reported_name: nameMap.get(String(r.reported_response_id)) || '(알 수 없음)',
      reporter_response_id: r.reporter_response_id,
      reported_response_id: r.reported_response_id,
    }))

    return NextResponse.json({ reports, total: count ?? 0, page, pageSize: PAGE_SIZE })
  } catch (err) {
    console.error('[GET /api/admin/reports] unexpected', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
