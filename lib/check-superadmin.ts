import { createClient } from '@/lib/supabase'
import { isSuperAdminUser } from '@/lib/admin-access'

export async function checkIsSuperAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin, is_admin')
    .eq('id', user.id)
    .maybeSingle()
  
  return isSuperAdminUser(user.email, profile)
}
