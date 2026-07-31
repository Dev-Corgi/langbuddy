import type { SupabaseClient, User } from '@supabase/supabase-js'
import { hasAdminPanelAccess, isSuperAdminUser } from '@/lib/admin-access'

/** 서버 라우트용: 슈퍼 관리자만 (운영 API) */
export async function getAdminUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin, is_admin, is_staff')
    .eq('id', user.id)
    .maybeSingle()

  if (isSuperAdminUser(user.email, profile)) return user
  return null
}

/** 서버 라우트용: 관리자 패널 접근 가능한 로그인 유저 */
export async function getPanelUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin, is_admin, is_staff')
    .eq('id', user.id)
    .maybeSingle()

  if (hasAdminPanelAccess(user.email, profile)) return user
  return null
}
