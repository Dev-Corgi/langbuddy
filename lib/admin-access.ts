import { isSuperAdminEmail } from '@/lib/super-admin'

export type AdminProfileFlags = {
  is_superadmin?: boolean | null
  is_admin?: boolean | null
}

/** 슈퍼 관리자: DB 플래그 또는 고정 이메일 화이트리스트 */
export function isSuperAdminUser(
  email: string | null | undefined,
  profile: AdminProfileFlags | null | undefined
): boolean {
  if (isSuperAdminEmail(email)) return true
  return !!profile?.is_superadmin
}

/** 관리자 패널 접근: 슈퍼 관리자 또는 is_admin */
export function hasAdminPanelAccess(
  email: string | null | undefined,
  profile: AdminProfileFlags | null | undefined
): boolean {
  if (isSuperAdminUser(email, profile)) return true
  return !!profile?.is_admin
}
