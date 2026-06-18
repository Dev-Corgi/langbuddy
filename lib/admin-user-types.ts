export type AdminUserRow = {
  id: string
  name: string | null
  gender: string | null
  nationality: string | null
  kakao_id: string | null
  onboarding_completed: boolean
  le_stamp_progress: number
  le_reward_coupons: number
  privacy_accepted_at: string | null
  privacy_policy_version: string | null
  created_at: string
  updated_at: string
  email?: string | null
}

export type AdminUserUpdatePayload = {
  name?: string
  gender?: '남' | '여'
  nationality?: '한국인' | '외국인'
  kakao_id?: string
  le_stamp_progress?: number
  le_reward_coupons?: number
  onboarding_completed?: boolean
}
