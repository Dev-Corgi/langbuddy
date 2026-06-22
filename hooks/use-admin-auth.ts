'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { hasAdminPanelAccess, isSuperAdminUser } from '@/lib/admin-access'

type AdminAuthState = {
  ready: boolean
  isSuperAdmin: boolean
}

/**
 * 관리자 패널 접근 확인 (is_admin 또는 슈퍼).
 * requireSuper: true 이면 슈퍼만 통과, 아니면 대시보드로 리다이렉트.
 */
export function useAdminAuth(options?: { requireSuper?: boolean }): AdminAuthState {
  const requireSuper = options?.requireSuper ?? false
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<AdminAuthState>({ ready: false, isSuperAdmin: false })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/admin/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin, is_admin')
        .eq('id', user.id)
        .maybeSingle()

      if (!hasAdminPanelAccess(user.email, profile)) {
        router.push('/admin/login?error=no_access')
        return
      }

      const superAdmin = isSuperAdminUser(user.email, profile)

      if (requireSuper && !superAdmin) {
        router.push('/admin/dashboard')
        return
      }

      if (!cancelled) {
        setState({ ready: true, isSuperAdmin: superAdmin })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [router, supabase, requireSuper])

  return state
}
