import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractParticipantInfoFromAnswers,
  type CoreFormQuestion,
} from '@/lib/utils'
import { normalizeLanguage, normalizeParticipantFields } from '@/lib/form-answer-canonical'
import { normalizePaymentMethod, type PaymentMethod } from '@/lib/supported-payment-methods'

export const WALK_IN_SOURCE = 'admin_manual' as const

export type WalkInGuestProfile = {
  name: string
  gender: string
  nationality: string
}

/**
 * 현장 참가자용 guest 식별자 생성.
 * public.users.id → auth.users(id) FK이므로 auth placeholder + public.users(is_guest)를 함께 만든다.
 */
export async function createWalkInGuestUser(
  admin: SupabaseClient,
  profile: WalkInGuestProfile
): Promise<{ id: string } | { error: string }> {
  const id = crypto.randomUUID()
  const displayName = profile.name.trim() || 'Guest'
  const email = `walkin-${id}@guests.langbuddy.local`

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    id,
    email,
    email_confirm: true,
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    user_metadata: { is_guest: true, name: displayName },
    app_metadata: { is_guest: true, provider: 'guest', providers: ['guest'] },
  })

  if (authError || !authData.user) {
    console.error('[createWalkInGuestUser] auth', authError)
    return { error: authError?.message || 'guest_auth_failed' }
  }

  const userId = authData.user.id

  const { error: userError } = await admin.from('users').upsert(
    {
      id: userId,
      name: displayName,
      gender: profile.gender || null,
      nationality: profile.nationality || null,
      onboarding_completed: false,
      is_guest: true,
    },
    { onConflict: 'id' }
  )

  if (userError) {
    console.error('[createWalkInGuestUser] users', userError)
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return { error: userError.message || 'guest_create_failed' }
  }

  await admin
    .from('profiles')
    .update({ name: displayName, name_en: displayName })
    .eq('id', userId)

  return { id: userId }
}

/** walk-in에 연결된 guest users 프로필 동기화 (is_guest인 경우만). */
export async function syncWalkInGuestUser(
  admin: SupabaseClient,
  userId: string | null | undefined,
  profile: WalkInGuestProfile
): Promise<void> {
  if (!userId) return
  const displayName = profile.name.trim() || 'Guest'
  const { error } = await admin
    .from('users')
    .update({
      name: displayName,
      gender: profile.gender || null,
      nationality: profile.nationality || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .eq('is_guest', true)
  if (error) {
    console.error('[syncWalkInGuestUser]', error)
  }
  await admin
    .from('profiles')
    .update({ name: displayName, name_en: displayName })
    .eq('id', userId)
}

export type WalkInParticipantInput = {
  name: string
  gender: '남' | '여'
  nationality: '한국인' | '외국인'
  language: string
  sessionDate: string
  selectedDay: string
  paymentMethod?: PaymentMethod
}

export function isWalkInAnswers(answers: Record<string, unknown> | null | undefined): boolean {
  return answers?._source === WALK_IN_SOURCE
}

export function buildWalkInAnswers(input: WalkInParticipantInput): Record<string, unknown> {
  const name = input.name.trim()
  const language = input.language.trim() || '영어'
  const languageKo = normalizeLanguage(language)

  const paymentMethod = input.paymentMethod ?? '현장현금'

  return {
    _source: WALK_IN_SOURCE,
    _event_date: input.sessionDate,
    _selected_day: input.selectedDay,
    _selected_language: languageKo,
    _payment_method: paymentMethod,
    name,
    gender: input.gender,
    nationality: input.nationality,
    language: languageKo,
  }
}

export type ArrangedParticipant = {
  id: string
  name: string
  gender: '남' | '여' | string
  nationality: '한국인' | '외국인' | string
  language: string
  checked_in_at: string | null
  /** form_responses.created_at — 미배정 목록 정렬 보조 */
  created_at?: string | null
  /** 회원 신청 시 profiles 연결 */
  userId?: string | null
  isWalkIn?: boolean
  /** profiles.is_staff 또는 answers._payment_method === '스탭무료' */
  isStaff?: boolean
  paymentMethod?: PaymentMethod | null
  paymentStatus?: string | null
  paymentReceiptUrl?: string | null
}

export type WalkInParticipant = ArrangedParticipant & { isWalkIn: true }

export function mapFormResponseToParticipant(
  row: {
    id: string
    user_id?: string | null
    answers?: Record<string, unknown> | null
    checked_in_at?: string | null
    created_at?: string | null
    payment_status?: string | null
    payment_receipt_url?: string | null
  },
  questions: CoreFormQuestion[] = [],
  options?: { userNamesById?: Record<string, string>; staffUserIds?: Set<string> }
): ArrangedParticipant {
  const answers = (row.answers || {}) as Record<string, unknown>
  const info = extractParticipantInfoFromAnswers(answers, questions)
  const normalized = normalizeParticipantFields({
    gender: info.gender || String(answers.gender || answers.성별 || '?'),
    nationality: info.nationality || String(answers.nationality || answers.국적 || '?'),
    language: String(answers._selected_language || info.language || '-'),
  })

  const nameFromAnswers = info.name || String(answers.name || answers.이름 || answers._participant_name || '')
  const nameFromUser =
    row.user_id && options?.userNamesById?.[row.user_id]
      ? options.userNamesById[row.user_id]
      : ''

  const rawPayment =
    typeof answers._payment_method === 'string' ? answers._payment_method.trim() : ''
  const isStaff =
    rawPayment === '스탭무료' ||
    !!(row.user_id && options?.staffUserIds?.has(row.user_id))

  return {
    id: row.id,
    name: nameFromAnswers || nameFromUser || 'Anonymous',
    gender: normalized.gender || '?',
    nationality: normalized.nationality || '?',
    language: normalized.language || '-',
    checked_in_at: row.checked_in_at ?? null,
    created_at: row.created_at ?? null,
    userId: row.user_id ?? null,
    isWalkIn: isWalkInAnswers(answers) || undefined,
    isStaff: isStaff || undefined,
    paymentMethod: normalizePaymentMethod(answers._payment_method),
    paymentStatus: row.payment_status ?? null,
    paymentReceiptUrl: row.payment_receipt_url ?? null,
  }
}

export function mapFormResponseToWalkInParticipant(
  row: {
    id: string
    answers?: Record<string, unknown> | null
    checked_in_at?: string | null
  },
  questions: CoreFormQuestion[] = []
): WalkInParticipant {
  return {
    ...mapFormResponseToParticipant(row, questions),
    isWalkIn: true,
  }
}
