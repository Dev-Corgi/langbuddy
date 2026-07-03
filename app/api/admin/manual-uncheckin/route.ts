import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'

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

    if (!responseId) {
      return NextResponse.json({ error: 'missing_response_id' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const { data: existing, error: loadErr } = await admin
      .from('form_responses')
      .select('id, checked_in_at')
      .eq('id', responseId)
      .single()

    if (loadErr || !existing) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (!existing.checked_in_at) {
      return NextResponse.json({
        ok: true,
        checked_in_at: null,
        already_unchecked: true,
      })
    }

    const { data: row, error } = await admin
      .from('form_responses')
      .update({ checked_in_at: null })
      .eq('id', responseId)
      .select('id, checked_in_at')
      .single()

    if (error || !row) {
      console.error('[manual-uncheckin] update error:', error)
      return NextResponse.json(
        { error: error?.message || 'uncheckin_failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      checked_in_at: row.checked_in_at,
      already_unchecked: false,
    })
  } catch (err) {
    console.error('[manual-uncheckin] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
