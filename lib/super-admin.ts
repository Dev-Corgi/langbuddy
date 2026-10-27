/** 슈퍼관리자 이메일 (카카오 OAuth account_email 기준). profiles.is_superadmin 과 함께 사용 */
const DEFAULT_SUPER_ADMIN_EMAILS = [
  'pomato5959@gmail.com',
  'bora5242@gmail.com',
  'skyhappyjun68@gmail.com',
  'erantra50@naver.com',
] as const

export const SUPER_ADMIN_EMAILS = (
  process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS?.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean) ?? [...DEFAULT_SUPER_ADMIN_EMAILS]
) as readonly string[]

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
