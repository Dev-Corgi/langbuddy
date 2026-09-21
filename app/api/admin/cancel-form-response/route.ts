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
    const responseId = body.responseId as string | undefined
    if (!responseId) {
      return NextResponse.json({ error: 'missing_response_id' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    const { data: row, error: rowErr } = await admin
      .from('form_responses')
      .select('id, form_id')
      .eq('id', responseId)
      .single()

    if (rowErr || !row) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const formId = row.form_id as string
    const { count: langCount } = await admin
      .from('language_exchange_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', formId)

    if (!langCount) {
      return NextResponse.json(
        { error: 'only_language_exchange_forms' },
        { status: 403 }
      )
    }

    const { error: delErr } = await admin.rpc('admin_delete_form_response', {
      p_response_id: responseId,
    })

    if (delErr) {
      console.error('[cancel-form-response] admin_delete_form_response', delErr)
      return NextResponse.json(
        { error: 'delete_response_failed', details: delErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[cancel-form-response]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
