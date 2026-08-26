import type { SupabaseClient } from '@supabase/supabase-js'

/** 해당 세션에 사용자가 실제 참여했는지 (배치 또는 아카이브) */
export async function verifySessionParticipation(
  admin: SupabaseClient,
  userId: string,
  postingId: string,
  sessionDate: string
): Promise<boolean> {
  const { data: myResponses } = await admin
    .from('form_responses')
    .select('id')
    .eq('user_id', userId)

  const myResponseIds = (myResponses || []).map((r) => r.id)

  if (myResponseIds.length > 0) {
    const { data: assignments } = await admin
      .from('seating_assignments')
      .select('participant_id')
      .eq('posting_id', postingId)
      .eq('session_date', sessionDate)
      .in('participant_id', myResponseIds)
      .limit(1)

    if (assignments && assignments.length > 0) return true
  }

  const { data: archiveRow } = await admin
    .from('le_participation_archive')
    .select('id')
    .eq('user_id', userId)
    .eq('posting_id', postingId)
    .eq('session_date', sessionDate)
    .limit(1)
    .maybeSingle()

  return !!archiveRow
}
