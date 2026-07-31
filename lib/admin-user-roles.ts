import type { SupabaseClient } from '@supabase/supabase-js'
import { isSuperAdminUser } from '@/lib/admin-access'
import {
  adminRoleToFlags,
  type AdminUserRole,
  resolveAdminUserRole,
} from '@/lib/admin-user-role'

export type ProfileRoleFlags = {
  is_admin: boolean
  is_superadmin: boolean
  is_staff: boolean
}

export async function fetchProfileRoleFlags(
  admin: SupabaseClient,
  userId: string
): Promise<ProfileRoleFlags> {
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin, is_superadmin, is_staff')
    .eq('id', userId)
    .maybeSingle()

  return {
    is_admin: !!profile?.is_admin,
    is_superadmin: !!profile?.is_superadmin,
    is_staff: !!profile?.is_staff,
  }
}

export async function fetchProfileRoleFlagsMap(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Map<string, ProfileRoleFlags>> {
  const map = new Map<string, ProfileRoleFlags>()
  if (userIds.length === 0) return map

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, is_admin, is_superadmin, is_staff')
    .in('id', userIds)

  for (const id of userIds) {
    map.set(id, { is_admin: false, is_superadmin: false, is_staff: false })
  }
  for (const p of profiles ?? []) {
    map.set(p.id, {
      is_admin: !!p.is_admin,
      is_superadmin: !!p.is_superadmin,
      is_staff: !!p.is_staff,
    })
  }
  return map
}

export async function isTargetSuperAdmin(
  admin: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: authData } = await admin.auth.admin.getUserById(userId)
  const flags = await fetchProfileRoleFlags(admin, userId)
  return isSuperAdminUser(authData?.user?.email ?? null, flags)
}

/** profiles.name NOT NULL — upsert(id만)는 INSERT 단계에서 실패하므로 update 우선 */
export async function setProfileRole(
  admin: SupabaseClient,
  userId: string,
  role: AdminUserRole
): Promise<{ error: string | null }> {
  const flags = adminRoleToFlags(role)
  const now = new Date().toISOString()

  const { data: updated, error: updateError } = await admin
    .from('profiles')
    .update({
      is_superadmin: flags.is_superadmin,
      is_admin: flags.is_admin,
      is_staff: flags.is_staff,
      updated_at: now,
    })
    .eq('id', userId)
    .select('id')
    .maybeSingle()

  if (updateError) {
    return { error: updateError.message }
  }
  if (updated) {
    return { error: null }
  }

  const { data: userRow } = await admin.from('users').select('name').eq('id', userId).maybeSingle()

  const name = userRow?.name?.trim() || 'User'
  const { error: insertError } = await admin.from('profiles').insert({
    id: userId,
    name,
    is_superadmin: flags.is_superadmin,
    is_admin: flags.is_admin,
    is_staff: flags.is_staff,
    updated_at: now,
  })

  if (insertError) {
    return { error: insertError.message }
  }
  return { error: null }
}

export async function resolveUserRole(
  admin: SupabaseClient,
  userId: string
): Promise<{ role: AdminUserRole; flags: ProfileRoleFlags; email: string | null }> {
  const { data: authData } = await admin.auth.admin.getUserById(userId)
  const flags = await fetchProfileRoleFlags(admin, userId)
  const email = authData?.user?.email ?? null
  return {
    role: resolveAdminUserRole(email, flags),
    flags,
    email,
  }
}

/** @deprecated setProfileRole 사용 */
export async function setProfileIsAdmin(
  admin: SupabaseClient,
  userId: string,
  isAdmin: boolean
): Promise<{ error: string | null }> {
  return setProfileRole(admin, userId, isAdmin ? 'admin' : 'member')
}
