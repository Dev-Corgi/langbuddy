import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getAdminHomePath, hasAdminPanelAccess } from '@/lib/admin-access'

export default async function AdminRootPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/admin/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin, is_admin, is_staff')
    .eq('id', session.user.id)
    .maybeSingle()

  if (!hasAdminPanelAccess(session.user.email, profile)) {
    redirect('/admin/login?error=no_access')
  }

  redirect(getAdminHomePath(session.user.email, profile))
}
