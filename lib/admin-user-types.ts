import type { AdminUserRole } from '@/lib/admin-user-role'

export type AdminUserRow = {
  id: string
  name: string | null
  gender: string | null
  nationality: string | null
  kakao_id: string | null
  onboarding_completed: boolean
  privacy_accepted_at: string | null
  privacy_policy_version: string | null
  created_at: string
  updated_at: string
  email?: string | null
  role?: AdminUserRole
  is_admin?: boolean
  is_superadmin?: boolean
  is_staff?: boolean
}

export type AdminUserUpdatePayload = {
  name?: string
  gender?: '남' | '여'
  nationality?: '한국인' | '외국인'
  kakao_id?: string
  onboarding_completed?: boolean
  /** @deprecated role 사용 */
  is_admin?: boolean
  role?: AdminUserRole
}
