import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isSuperAdminEmail } from '@/lib/super-admin'

/** 서버 라우트용: 로그인 + 프로필 슈퍼관리자 또는 고정 이메일 */
export async function getAdminUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (isSuperAdminEmail(user.email)) return user
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()
  if (profile?.is_superadmin) return user
  return null
}
