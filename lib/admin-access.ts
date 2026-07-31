import { isSuperAdminEmail } from '@/lib/super-admin'

export type AdminProfileFlags = {
  is_superadmin?: boolean | null
  is_admin?: boolean | null
  is_staff?: boolean | null
}

/** 슈퍼 관리자: DB 플래그 또는 고정 이메일 화이트리스트 */
export function isSuperAdminUser(
  email: string | null | undefined,
  profile: AdminProfileFlags | null | undefined
): boolean {
  if (isSuperAdminEmail(email)) return true
  return !!profile?.is_superadmin
}

/** 스탭: 현장 운영(자리배치·QR 체크인) */
export function isStaffUser(profile: AdminProfileFlags | null | undefined): boolean {
  return !!profile?.is_staff
}

/** 소모임장(is_admin, 슈퍼/스탭 아님): 번개 관리·설정만 */
export function isClubLeaderUser(
  email: string | null | undefined,
  profile: AdminProfileFlags | null | undefined
): boolean {
  if (isSuperAdminUser(email, profile)) return false
  if (profile?.is_staff) return false
  return !!profile?.is_admin
}

/** 관리자 패널 접근: 슈퍼 / 소모임장 / 스탭 */
export function hasAdminPanelAccess(
  email: string | null | undefined,
  profile: AdminProfileFlags | null | undefined
): boolean {
  if (isSuperAdminUser(email, profile)) return true
  if (profile?.is_admin) return true
  return !!profile?.is_staff
}

/** 소모임장이 접근 가능한 /admin 하위 경로 */
export function isClubLeaderAllowedPath(pathname: string): boolean {
  if (pathname === '/admin/login') return true
  if (pathname === '/admin' || pathname === '/admin/') return true
  if (pathname === '/admin/settings' || pathname.startsWith('/admin/settings/')) return true
  if (pathname === '/admin/meetups' || pathname.startsWith('/admin/meetups/')) return true
  if (pathname === '/admin/postings' || pathname.startsWith('/admin/postings/')) return true
  return false
}

/** 역할별 관리자 패널 기본 랜딩 경로 */
export function getAdminHomePath(
  email: string | null | undefined,
  profile: AdminProfileFlags | null | undefined
): string {
  if (isClubLeaderUser(email, profile)) return '/admin/meetups'
  return '/admin/dashboard'
}

/** 자리배치·QR 체크인 등 현장 운영 메뉴 */
export function canAccessStaffOps(
  email: string | null | undefined,
  profile: AdminProfileFlags | null | undefined
): boolean {
  if (isSuperAdminUser(email, profile)) return true
  return !!profile?.is_staff
}
