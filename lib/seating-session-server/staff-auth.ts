import type { SupabaseClient, User } from '@supabase/supabase-js'
import { canAccessStaffOps } from '@/lib/admin-access'

export async function getStaffOpsUser(supabase: SupabaseClient): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin, is_admin, is_staff')
    .eq('id', user.id)
    .maybeSingle()

  if (canAccessStaffOps(user.email, profile)) return user
  return null
}
