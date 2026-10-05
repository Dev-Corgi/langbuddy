import type { SupabaseClient } from '@supabase/supabase-js'
import { formatSessionDateLabel } from '@/lib/session-event-date'

export type PastParticipationSession = {
  postingId: string
  sessionDate: string
  sessionLabel: string
}

/** 신청 완료 화면 등에서 "이전 참여" 세션 목록 (아카이브 + 현재 주 배치) */
export async function fetchPastParticipationSessions(
  supabase: SupabaseClient,
  userId: string,
  options?: { locale?: 'ko' | 'en' }
): Promise<PastParticipationSession[]> {
  const locale = options?.locale ?? 'ko'
  const sessions = new Map<string, PastParticipationSession>()

  const addSession = (postingId: string, sessionDate: string) => {
    if (!postingId || !sessionDate || sessionDate.length < 10) return
    const key = `${postingId}|${sessionDate}`
    if (sessions.has(key)) return
    sessions.set(key, {
      postingId,
      sessionDate,
      sessionLabel: formatSessionDateLabel(sessionDate, locale),
    })
  }

  const { data: archiveRows } = await supabase
    .from('le_participation_archive')
    .select('posting_id, session_date')
    .eq('user_id', userId)

  for (const row of archiveRows || []) {
    addSession(String(row.posting_id), String(row.session_date))
  }

  const { data: responses } = await supabase.from('form_responses').select('id').eq('user_id', userId)
  const responseIds = (responses || []).map((r) => String(r.id))

  if (responseIds.length > 0) {
    const { data: assignments } = await supabase
      .from('seating_assignments')
      .select('posting_id, session_date')
      .in('participant_id', responseIds)

    for (const row of assignments || []) {
      if (!row.session_date) continue
      addSession(String(row.posting_id), String(row.session_date))
    }
  }

  return Array.from(sessions.values()).sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
}
