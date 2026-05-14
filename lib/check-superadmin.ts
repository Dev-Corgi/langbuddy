import { createClient } from '@/lib/supabase'

export async function checkIsSuperAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false
  
  // 하드코딩된 슈퍼관리자 이메일
  if (user.email === 'pomato5959@gmail.com') {
    return true
  }
  
  // profiles 테이블에서 is_superadmin 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()
  
  return !!profile?.is_superadmin
}
