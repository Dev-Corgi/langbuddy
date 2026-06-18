import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    const admin = createSupabaseAdmin()

    let query = admin
      .from('users')
      .select(
        'id, name, gender, nationality, kakao_id, onboarding_completed, le_stamp_progress, le_reward_coupons, created_at, updated_at'
      )
      .order('updated_at', { ascending: false })
      .limit(200)

    if (q) {
      query = query.or(`name.ilike.%${q}%,kakao_id.ilike.%${q}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error('[admin/users] list error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: data ?? [] })
  } catch (err) {
    console.error('[admin/users] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
