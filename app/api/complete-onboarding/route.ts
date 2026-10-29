import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { name, gender, nationality, kakaoId, privacyPolicyVersion } = body

    if (!name || !gender || !nationality || !kakaoId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const now = new Date().toISOString()
    // Use the authenticated session so the users_insert_own / users_update_own
    // RLS policies can verify that this profile belongs to the caller.
    const { error } = await supabase.from('users').upsert(
      {
        id: user.id,
        name: name.trim(),
        gender,
        nationality,
        kakao_id: kakaoId.trim(),
        onboarding_completed: true,
        privacy_accepted_at: now,
        privacy_policy_version: privacyPolicyVersion ?? null,
        updated_at: now,
      },
      { onConflict: 'id' }
    )

    if (error) {
      console.error('[complete-onboarding] upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[complete-onboarding] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
