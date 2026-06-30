import type { SupabaseClient } from '@supabase/supabase-js'
import {
  formResponseMatchesTodaySession,
  isoDateForKoreanWeekdayInSunWeekSeoul,
  koreanWeekdayLetterSeoul,
  todayYYYYMMDDSeoul,
} from '@/lib/session-event-date'
import {
  loadLangQrSessionForDay,
  loadStudyQrSessionForDay,
  loadTodayQrSessions,
  type TodayQrSessionInfo,
} from '@/lib/admin-qr-sessions'

export type QrScanMode = 'study' | 'lang'

export type QrValidationIssue =
  | 'not_found'
  | 'unknown_form'
  | 'wrong_mode'
  | 'wrong_session'
  | 'db_error'

export type QrValidationResult = {
  ok: boolean
  issue?: QrValidationIssue
  message: string
  response?: {
    id: string
    name: string
    selectedDay: string
    eventDate: string
    checkedInAt: string | null
    formId: string
    qrCode: string
  }
}

type FormResponseRow = {
  id: string
  form_id: string
  qr_code: string | null
  checked_in_at: string | null
  answers: Record<string, unknown> | null
}

function classifyResponseFormId(
  formId: string,
  sessions: TodayQrSessionInfo
): QrScanMode | 'unknown' {
  if (sessions.study?.formId === formId) return 'study'
  if (sessions.lang?.formId === formId) return 'lang'
  return 'unknown'
}

function classifyResponseFormIdForTarget(
  formId: string,
  langFormId: string | null,
  studyFormId: string | null
): QrScanMode | 'unknown' {
  if (studyFormId && studyFormId === formId) return 'study'
  if (langFormId && langFormId === formId) return 'lang'
  return 'unknown'
}

function participantNameFromAnswers(answers: Record<string, unknown> | null | undefined): string {
  const ans = answers || {}
  const name = ans.name ?? ans.이름
  if (typeof name === 'string' && name.trim()) return name.trim()
  return '—'
}

export function formResponseMatchesTargetSession(
  answers: Record<string, unknown> | null | undefined,
  targetEventDate: string,
  targetDayKo: string
): boolean {
  const ans = (answers || {}) as Record<string, unknown>
  const ev = typeof ans._event_date === 'string' ? ans._event_date.slice(0, 10) : ''
  const sel = typeof ans._selected_day === 'string' ? ans._selected_day.trim() : ''
  if (ev === targetEventDate) return true
  if (!ev && sel === targetDayKo) return true
  return false
}

export type ValidateQrOptions = {
  /** production: 오늘 활성 스케줄 기준 */
  mode: 'production'
  scanMode: QrScanMode
} | {
  /** debug: 지정 요일·회차 날짜 기준 (체크인 없음) */
  mode: 'debug'
  scanMode: QrScanMode
  targetDayKo: string
  targetEventDate?: string
}

export async function validateQrCode(
  supabase: SupabaseClient,
  qrCode: string,
  options: ValidateQrOptions
): Promise<QrValidationResult> {
  const trimmed = qrCode.trim()
  if (!trimmed) {
    return { ok: false, issue: 'not_found', message: 'QR 코드가 비어 있습니다.' }
  }

  const { data: responseData, error: responseError } = await supabase
    .from('form_responses')
    .select('id, form_id, qr_code, checked_in_at, answers')
    .eq('qr_code', trimmed)
    .maybeSingle()

  if (responseError) {
    return {
      ok: false,
      issue: 'db_error',
      message: `조회 오류: ${responseError.message}`,
    }
  }

  if (!responseData) {
    return {
      ok: false,
      issue: 'not_found',
      message: '유효하지 않은 QR 코드입니다. (DB에 없음 — 삭제됐거나 잘못된 코드)',
    }
  }

  const row = responseData as FormResponseRow
  const answers = (row.answers || {}) as Record<string, unknown>
  const base = {
    id: row.id,
    name: participantNameFromAnswers(answers),
    selectedDay:
      typeof answers._selected_day === 'string' ? answers._selected_day.trim() : '—',
    eventDate:
      typeof answers._event_date === 'string' ? answers._event_date.slice(0, 10) : '—',
    checkedInAt: row.checked_in_at,
    formId: row.form_id,
    qrCode: row.qr_code || trimmed,
  }

  if (options.mode === 'production') {
    const ctx = await loadTodayQrSessions(supabase)
    const kind = classifyResponseFormId(row.form_id, ctx)
    if (kind === 'unknown') {
      return {
        ok: false,
        issue: 'unknown_form',
        message: '유효하지 않은 QR 코드입니다. (오늘 활성 폼과 불일치)',
        response: base,
      }
    }
    if (options.scanMode === 'study' && kind === 'lang') {
      return {
        ok: false,
        issue: 'wrong_mode',
        message: '잘못된 QR 코드입니다. (언어교환 QR — 스터디 모드)',
        response: base,
      }
    }
    if (options.scanMode === 'lang' && kind === 'study') {
      return {
        ok: false,
        issue: 'wrong_mode',
        message: '잘못된 QR 코드입니다. (스터디 QR — 언어교환 모드)',
        response: base,
      }
    }

    const todayStr = todayYYYYMMDDSeoul()
    const currentDay = koreanWeekdayLetterSeoul()
    if (!formResponseMatchesTodaySession(answers, todayStr, currentDay)) {
      return {
        ok: false,
        issue: 'wrong_session',
        message: '오늘 일정에 해당하지 않는 신청입니다.',
        response: base,
      }
    }

    return { ok: true, message: '유효한 QR 코드입니다.', response: base }
  }

  const targetDayKo = options.targetDayKo
  let targetEventDate = options.targetEventDate
  if (!targetEventDate) {
    try {
      targetEventDate = isoDateForKoreanWeekdayInSunWeekSeoul(targetDayKo)
    } catch {
      return { ok: false, issue: 'db_error', message: '대상 요일이 올바르지 않습니다.', response: base }
    }
  }

  const [langSession, studySession] = await Promise.all([
    loadLangQrSessionForDay(supabase, targetDayKo),
    loadStudyQrSessionForDay(supabase, targetDayKo),
  ])

  const kind = classifyResponseFormIdForTarget(
    row.form_id,
    langSession?.formId ?? null,
    studySession?.formId ?? null
  )

  if (kind === 'unknown') {
    return {
      ok: false,
      issue: 'unknown_form',
      message: `유효하지 않은 QR 코드입니다. (${targetDayKo}요일 언어교환·스터디 폼과 불일치)`,
      response: base,
    }
  }

  if (options.scanMode === 'study' && kind === 'lang') {
    return {
      ok: false,
      issue: 'wrong_mode',
      message: '잘못된 QR 코드입니다. (언어교환 QR — 스터디 모드)',
      response: base,
    }
  }
  if (options.scanMode === 'lang' && kind === 'study') {
    return {
      ok: false,
      issue: 'wrong_mode',
      message: '잘못된 QR 코드입니다. (스터디 QR — 언어교환 모드)',
      response: base,
    }
  }

  if (!formResponseMatchesTargetSession(answers, targetEventDate, targetDayKo)) {
    return {
      ok: false,
      issue: 'wrong_session',
      message: `${targetDayKo}요일 회차(${targetEventDate})와 맞지 않습니다.`,
      response: base,
    }
  }

  const checkinNote = row.checked_in_at
    ? ' (이미 체크인됨 — 디버그 모드에서는 변경하지 않음)'
    : ' (미체크인 — 디버그 모드에서는 변경하지 않음)'

  return {
    ok: true,
    message: `유효한 QR 코드입니다.${checkinNote}`,
    response: base,
  }
}
