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
  /** 소모임장(번개 관리) */
  is_admin?: boolean
  /** 스탭(자리배치·QR 체크인) */
  is_staff?: boolean
  /** @deprecated is_admin / is_staff 사용 */
  role?: AdminUserRole
}
