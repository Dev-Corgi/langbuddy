import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import { ADMIN_CHECKIN_SOURCE_DRAG } from '@/lib/admin-manual-checkin'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const responseId =
      typeof body.responseId === 'string' ? body.responseId.trim() : ''
    const source =
      typeof body.source === 'string' && body.source.trim()
        ? body.source.trim()
        : ADMIN_CHECKIN_SOURCE_DRAG

    if (!responseId) {
      return NextResponse.json({ error: 'missing_response_id' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const { data: existing, error: loadErr } = await admin
      .from('form_responses')
      .select('id, answers, checked_in_at')
      .eq('id', responseId)
      .single()

    if (loadErr || !existing) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (existing.checked_in_at) {
      return NextResponse.json({
        ok: true,
        checked_in_at: existing.checked_in_at,
        already_checked_in: true,
      })
    }

    const checkedInAt = new Date().toISOString()
    const prevAnswers = (existing.answers || {}) as Record<string, unknown>
    const nextAnswers = { ...prevAnswers, _checkin_source: source }

    const { data: row, error } = await admin
      .from('form_responses')
      .update({
        checked_in_at: checkedInAt,
        answers: nextAnswers,
      })
      .eq('id', responseId)
      .select('id, checked_in_at')
      .single()

    if (error || !row) {
      console.error('[manual-checkin] update error:', error)
      return NextResponse.json(
        { error: error?.message || 'checkin_failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      checked_in_at: row.checked_in_at,
      already_checked_in: false,
    })
  } catch (err) {
    console.error('[manual-checkin] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
