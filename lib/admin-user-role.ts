import { isSuperAdminEmail } from '@/lib/super-admin'

export type AdminUserRole = 'member' | 'staff' | 'admin' | 'superadmin'

export type AdminRoleFlags = {
  is_superadmin?: boolean | null
  is_admin?: boolean | null
  is_staff?: boolean | null
}

export const ADMIN_USER_ROLES: AdminUserRole[] = ['member', 'staff', 'admin', 'superadmin']

export function resolveAdminUserRole(
  email: string | null | undefined,
  flags: AdminRoleFlags | null | undefined
): AdminUserRole {
  if (isSuperAdminEmail(email) || flags?.is_superadmin) return 'superadmin'
  if (flags?.is_admin) return 'admin'
  if (flags?.is_staff) return 'staff'
  return 'member'
}

export function adminRoleToFlags(role: AdminUserRole): {
  is_superadmin: boolean
  is_admin: boolean
  is_staff: boolean
} {
  switch (role) {
    case 'superadmin':
      return { is_superadmin: true, is_admin: true, is_staff: false }
    case 'admin':
      return { is_superadmin: false, is_admin: true, is_staff: false }
    case 'staff':
      return { is_superadmin: false, is_admin: false, is_staff: true }
    default:
      return { is_superadmin: false, is_admin: false, is_staff: false }
  }
}

/** 활성화된 관리자 역할 라벨 (소모임장·스탭 중복 가능) */
export function getAdminRoleLabels(
  flags: AdminRoleFlags | null | undefined,
  email: string | null | undefined,
  isEn: boolean
): string[] {
  if (isSuperAdminEmail(email) || flags?.is_superadmin) {
    return [getAdminRoleLabel('superadmin', isEn)]
  }
  const labels: string[] = []
  if (flags?.is_admin) labels.push(getAdminRoleLabel('admin', isEn))
  if (flags?.is_staff) labels.push(getAdminRoleLabel('staff', isEn))
  return labels
}

export function formatAdminRoleLabels(
  flags: AdminRoleFlags | null | undefined,
  email: string | null | undefined,
  isEn: boolean
): string {
  const labels = getAdminRoleLabels(flags, email, isEn)
  if (labels.length === 0) return getAdminRoleLabel('member', isEn)
  return labels.join(isEn ? ' · ' : ' · ')
}

export function getAdminRoleLabel(role: AdminUserRole, isEn: boolean): string {
  if (isEn) {
    switch (role) {
      case 'superadmin':
        return 'Super admin'
      case 'admin':
        return 'Club Leader'
      case 'staff':
        return 'Staff'
      default:
        return 'Member'
    }
  }
  switch (role) {
    case 'superadmin':
      return '슈퍼 관리자'
    case 'admin':
      return '소모임장'
    case 'staff':
      return '스탭'
    default:
      return '일반 회원'
  }
}

export function isValidAdminUserRole(value: unknown): value is AdminUserRole {
  return typeof value === 'string' && ADMIN_USER_ROLES.includes(value as AdminUserRole)
}
