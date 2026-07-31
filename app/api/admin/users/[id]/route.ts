import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import type { AdminUserUpdatePayload } from '@/lib/admin-user-types'
import {
  isTargetSuperAdmin,
  resolveUserRole,
  setProfileRole,
} from '@/lib/admin-user-roles'
import { isValidAdminUserRole } from '@/lib/admin-user-role'

type RouteContext = { params: Promise<{ id: string }> }

function serializeUser(
  userRow: Record<string, unknown>,
  email: string | null,
  flags: { is_admin: boolean; is_superadmin: boolean; is_staff: boolean },
  role: ReturnType<typeof import('@/lib/admin-user-role').resolveAdminUserRole>
) {
  return {
    ...userRow,
    email,
    role,
    is_admin: flags.is_admin,
    is_staff: flags.is_staff,
    is_superadmin: role === 'superadmin',
  }
}

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

    const { role, flags, email } = await resolveUserRole(admin, id)

    return NextResponse.json({
      user: serializeUser(userRow, email, flags, role),
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

    const roleToSet =
      body.role !== undefined
        ? body.role
        : body.is_admin !== undefined
          ? body.is_admin
            ? 'admin'
            : 'member'
          : undefined

    if (roleToSet !== undefined) {
      if (!isValidAdminUserRole(roleToSet)) {
        return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
      }

      const targetIsSuper = await isTargetSuperAdmin(admin, id)
      if (targetIsSuper) {
        return NextResponse.json(
          { error: 'cannot_change_super_admin_role' },
          { status: 400 }
        )
      }

      const { error: profileError } = await setProfileRole(admin, id, roleToSet)

      if (profileError) {
        console.error('[admin/users/[id]] profile role update error:', profileError)
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

    if (body.onboarding_completed !== undefined) {
      patch.onboarding_completed = Boolean(body.onboarding_completed)
    }

    const userFieldsTouched =
      body.name !== undefined ||
      body.gender !== undefined ||
      body.nationality !== undefined ||
      body.kakao_id !== undefined ||
      body.onboarding_completed !== undefined

    if (!userFieldsTouched && roleToSet === undefined) {
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

    const { role, flags, email } = await resolveUserRole(admin, id)

    return NextResponse.json({
      user: serializeUser(data, email, flags, role),
    })
  } catch (err) {
    console.error('[admin/users/[id]] unexpected PATCH:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
