import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import type { AdminUserUpdatePayload } from '@/lib/admin-user-types'
import { sliderStampToStored } from '@/lib/le-stamp'
import {
  fetchProfileRoleFlags,
  isTargetSuperAdmin,
  setProfileIsAdmin,
} from '@/lib/admin-user-roles'
import { isSuperAdminUser } from '@/lib/admin-access'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const admin = createSupabaseAdmin()

    const { data: userRow, error } = await admin
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[admin/users/[id]] get error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!userRow) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const { data: authData } = await admin.auth.admin.getUserById(id)
    const roleFlags = await fetchProfileRoleFlags(admin, id)
    const email = authData?.user?.email ?? null

    return NextResponse.json({
      user: {
        ...userRow,
        email,
        is_admin: roleFlags.is_admin,
        is_superadmin: isSuperAdminUser(email, roleFlags),
      },
    })
  } catch (err) {
    console.error('[admin/users/[id]] unexpected GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = (await request.json()) as AdminUserUpdatePayload
    const admin = createSupabaseAdmin()

    if (body.is_admin !== undefined) {
      const targetIsSuper = await isTargetSuperAdmin(admin, id)
      if (targetIsSuper) {
        return NextResponse.json(
          { error: 'cannot_change_super_admin_role' },
          { status: 400 }
        )
      }

      const { error: profileError } = await setProfileIsAdmin(
        admin,
        id,
        Boolean(body.is_admin)
      )

      if (profileError) {
        console.error('[admin/users/[id]] profile is_admin update error:', profileError)
        return NextResponse.json({ error: profileError }, { status: 500 })
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ error: 'name_required' }, { status: 400 })
      }
      patch.name = name
    }

    if (body.gender !== undefined) {
      if (body.gender !== '남' && body.gender !== '여') {
        return NextResponse.json({ error: 'invalid_gender' }, { status: 400 })
      }
      patch.gender = body.gender
    }

    if (body.nationality !== undefined) {
      if (body.nationality !== '한국인' && body.nationality !== '외국인') {
        return NextResponse.json({ error: 'invalid_nationality' }, { status: 400 })
      }
      patch.nationality = body.nationality
    }

    if (body.kakao_id !== undefined) {
      const kakaoId = body.kakao_id.trim()
      if (!kakaoId) {
        return NextResponse.json({ error: 'kakao_id_required' }, { status: 400 })
      }
      patch.kakao_id = kakaoId
    }

    if (body.le_stamp_progress !== undefined) {
      const progress = sliderStampToStored(Number(body.le_stamp_progress))
      patch.le_stamp_progress = progress
    }

    if (body.le_reward_coupons !== undefined) {
      const coupons = Number(body.le_reward_coupons)
      if (!Number.isInteger(coupons) || coupons < 0) {
        return NextResponse.json({ error: 'invalid_coupons' }, { status: 400 })
      }
      patch.le_reward_coupons = coupons
    }

    if (body.onboarding_completed !== undefined) {
      patch.onboarding_completed = Boolean(body.onboarding_completed)
    }

    const userFieldsTouched =
      body.name !== undefined ||
      body.gender !== undefined ||
      body.nationality !== undefined ||
      body.kakao_id !== undefined ||
      body.le_stamp_progress !== undefined ||
      body.le_reward_coupons !== undefined ||
      body.onboarding_completed !== undefined

    if (!userFieldsTouched && body.is_admin === undefined) {
      return NextResponse.json({ error: 'no_fields' }, { status: 400 })
    }

    let data = null
    if (userFieldsTouched) {
      const { data: updated, error } = await admin
        .from('users')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single()

      if (error) {
        console.error('[admin/users/[id]] patch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      data = updated
    } else {
      const { data: existing, error } = await admin
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.error('[admin/users/[id]] fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (!existing) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      data = existing
    }

    const { data: authData } = await admin.auth.admin.getUserById(id)
    const roleFlags = await fetchProfileRoleFlags(admin, id)
    const email = authData?.user?.email ?? null

    return NextResponse.json({
      user: {
        ...data,
        email,
        is_admin: roleFlags.is_admin,
        is_superadmin: isSuperAdminUser(email, roleFlags),
      },
    })
  } catch (err) {
    console.error('[admin/users/[id]] unexpected PATCH:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
