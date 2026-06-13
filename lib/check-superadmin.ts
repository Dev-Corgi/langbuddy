import { createClient } from '@/lib/supabase'
import { isSuperAdminEmail } from '@/lib/super-admin'

export async function checkIsSuperAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false
  
  if (isSuperAdminEmail(user.email)) return true
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()
  
  return !!profile?.is_superadmin
}
