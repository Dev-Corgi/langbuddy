import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'

const VALID_STATUSES = ['pending', 'reviewed', 'dismissed'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { status, admin_note } = body

    const updates: Record<string, unknown> = {}

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
      }
      updates.status = status
    }

    if (admin_note !== undefined) {
      updates.admin_note =
        typeof admin_note === 'string' && admin_note.trim() ? admin_note.trim() : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no_updates' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('reports')
      .update(updates)
      .eq('id', id)
      .select('id, status, admin_note')
      .single()

    if (error) {
      console.error('[PATCH /api/admin/reports/[id]]', error)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, report: data })
  } catch (err) {
    console.error('[PATCH /api/admin/reports/[id]] unexpected', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
