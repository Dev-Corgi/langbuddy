import type { SupabaseClient } from '@supabase/supabase-js'
import { ADMIN_CHECKIN_SOURCE_DRAG } from '@/lib/admin-manual-checkin'
import { applyPatchesToSnapshot } from '@/lib/seating-session/apply-patch'
import { assembleSeatingSessionSnapshot } from '@/lib/seating-session-server/assemble'
import type { ReconcileWarning, SeatingPatch, SeatingSessionSnapshot } from '@/lib/seating-session/types'
import type { SeatingConfigPayload } from '@/lib/seating-live-sync'

export type PersistPatchResult =
  | {
      ok: true
      snapshot: SeatingSessionSnapshot
      warnings: ReconcileWarning[]
      revision: number
    }
  | { ok: false; status: 409; reason: 'stale_epoch' | 'stale_revision'; snapshot: SeatingSessionSnapshot }
  | { ok: false; status: 400; error: string }

async function persistCheckin(
  admin: SupabaseClient,
  participantId: string,
  source: string
): Promise<void> {
  const { data: existing } = await admin
    .from('form_responses')
    .select('id, answers, checked_in_at')
    .eq('id', participantId)
    .single()

  if (!existing) throw new Error('participant_not_found')
  if (existing.checked_in_at) return

  const prevAnswers = (existing.answers || {}) as Record<string, unknown>
  const { error } = await admin
    .from('form_responses')
    .update({
      checked_in_at: new Date().toISOString(),
      answers: { ...prevAnswers, _checkin_source: source },
    })
    .eq('id', participantId)

  if (error) throw error
}

async function persistUncheckin(
  admin: SupabaseClient,
  postingId: string,
  sessionDate: string,
  participantId: string
): Promise<void> {
  const { error: checkErr } = await admin
    .from('form_responses')
    .update({ checked_in_at: null })
    .eq('id', participantId)
  if (checkErr) throw checkErr

  await admin
    .from('seating_assignments')
    .delete()
    .eq('posting_id', postingId)
    .eq('participant_id', participantId)
    .or(`session_date.eq.${sessionDate},session_date.is.null`)
}

async function validateParticipantIds(
  admin: SupabaseClient,
  participantIds: string[]
): Promise<Set<string>> {
  if (participantIds.length === 0) return new Set()
  const { data } = await admin.from('form_responses').select('id').in('id', participantIds)
  return new Set((data ?? []).map((r) => r.id as string))
}

export async function persistSeatingSessionPatches(
  admin: SupabaseClient,
  params: {
    postingId: string
    sessionDate: string
    formId: string
    dayOfWeek: string
    expectedRevision: number
    expectedEpoch: number
    patches: SeatingPatch[]
  }
): Promise<PersistPatchResult> {
  const { data: posting, error: postingErr } = await admin
    .from('postings')
    .select('seating_session_epoch, seating_session_revision, seating_config')
    .eq('id', params.postingId)
    .single()

  if (postingErr || !posting) {
    return { ok: false, status: 400, error: 'posting_not_found' }
  }

  const serverEpoch = Number(posting.seating_session_epoch ?? 0)
  const serverRevision = Number(posting.seating_session_revision ?? 0)
  const seatingConfig = (posting.seating_config as SeatingConfigPayload | null) ?? null

  const reload = () =>
    assembleSeatingSessionSnapshot(admin, {
      postingId: params.postingId,
      sessionDate: params.sessionDate,
      formId: params.formId,
      dayOfWeek: params.dayOfWeek,
      epoch: serverEpoch,
      revision: serverRevision,
      seatingConfig,
    })

  if (params.expectedEpoch !== serverEpoch) {
    return { ok: false, status: 409, reason: 'stale_epoch', snapshot: await reload() }
  }

  if (params.expectedRevision !== serverRevision) {
    return { ok: false, status: 409, reason: 'stale_revision', snapshot: await reload() }
  }

  const dbPatches = params.patches.filter((p) => p.op === 'checkin' || p.op === 'uncheckin')
  const statePatches = params.patches.filter((p) => p.op !== 'checkin' && p.op !== 'uncheckin')

  for (const patch of dbPatches) {
    if (patch.op === 'checkin') {
      await persistCheckin(admin, patch.participantId, patch.source ?? ADMIN_CHECKIN_SOURCE_DRAG)
    } else {
      await persistUncheckin(admin, params.postingId, params.sessionDate, patch.participantId)
    }
  }

  let currentSnapshot = await assembleSeatingSessionSnapshot(admin, {
    postingId: params.postingId,
    sessionDate: params.sessionDate,
    formId: params.formId,
    dayOfWeek: params.dayOfWeek,
    epoch: serverEpoch,
    revision: serverRevision,
    seatingConfig,
  })

  let warnings: ReconcileWarning[] = []
  if (statePatches.length > 0) {
    const applied = applyPatchesToSnapshot(currentSnapshot, statePatches)
    currentSnapshot = applied.snapshot
    warnings = applied.warnings
  }

  const assignmentParticipantIds = [
    ...new Set(
      currentSnapshot.rounds.flatMap((r) => r.assignments.map((a) => a.participant_id))
    ),
  ]
  const existingIds = await validateParticipantIds(admin, assignmentParticipantIds)
  const strippedWarnings: ReconcileWarning[] = [...warnings]

  for (const round of currentSnapshot.rounds) {
    round.assignments = round.assignments.filter((a) => {
      if (existingIds.has(a.participant_id)) return true
      const participant = currentSnapshot.participants.find((p) => p.id === a.participant_id)
      const label = participant?.name ?? `ID ${a.participant_id.slice(0, 8)}…`
      strippedWarnings.push({
        code: 'unknown_participant',
        participantId: a.participant_id,
        message: `${label}님(DB 없음) ${a.table_label} 배정 저장 제외`,
      })
      return false
    })
  }

  const checkedIds = new Set(
    currentSnapshot.participants.filter((p) => p.checked_in_at).map((p) => p.id)
  )

  for (const patch of statePatches) {
    if (patch.op === 'assign') {
      if (!existingIds.has(patch.participantId) || !checkedIds.has(patch.participantId)) continue
      const { error } = await admin.rpc('admin_assign_participant_table', {
        p_posting_id: params.postingId,
        p_session_date: params.sessionDate,
        p_round: patch.round,
        p_participant_id: patch.participantId,
        p_table_label: patch.tableLabel,
      })
      if (error) throw error
    } else if (patch.op === 'replace_round') {
      const assignments = currentSnapshot.rounds
        .find((r) => r.round === patch.round)
        ?.assignments.filter(
          (a) =>
            checkedIds.has(a.participant_id) &&
            existingIds.has(a.participant_id) &&
            a.table_label?.trim()
        )
        .map((a) => ({
          participant_id: a.participant_id,
          table_label: a.table_label.trim(),
        })) ?? []

      const roundData = currentSnapshot.rounds.find((r) => r.round === patch.round)
      const { error } = await admin.rpc('admin_replace_round_seating', {
        p_posting_id: params.postingId,
        p_session_date: params.sessionDate,
        p_round: patch.round,
        p_table_languages: roundData?.tableLanguages ?? patch.tableLanguages,
        p_table_order: roundData?.tableOrder ?? patch.tableOrder ?? null,
        p_lang_table_counts: currentSnapshot.config.langTableCounts ?? null,
        p_assignments: assignments,
      })
      if (error) throw error
    } else if (patch.op === 'set_lang_table_counts') {
      const nextConfig = {
        ...seatingConfig,
        langTableCounts: patch.langTableCounts,
        tableLanguagesByRound: currentSnapshot.config.tableLanguagesByRound,
        tableOrderByRound: currentSnapshot.config.tableOrderByRound,
      }
      const { error } = await admin
        .from('postings')
        .update({ seating_config: nextConfig })
        .eq('id', params.postingId)
      if (error) throw error
    }
  }

  const newRevision = serverRevision + 1
  await admin
    .from('postings')
    .update({
      seating_session_revision: newRevision,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.postingId)

  const { data: updatedPosting } = await admin
    .from('postings')
    .select('seating_config, seating_session_epoch, seating_session_revision')
    .eq('id', params.postingId)
    .single()

  const finalSnapshot = await assembleSeatingSessionSnapshot(admin, {
    postingId: params.postingId,
    sessionDate: params.sessionDate,
    formId: params.formId,
    dayOfWeek: params.dayOfWeek,
    epoch: Number(updatedPosting?.seating_session_epoch ?? serverEpoch),
    revision: Number(updatedPosting?.seating_session_revision ?? newRevision),
    seatingConfig: (updatedPosting?.seating_config as SeatingConfigPayload | null) ?? null,
  })

  return {
    ok: true,
    snapshot: finalSnapshot,
    warnings: strippedWarnings,
    revision: Number(updatedPosting?.seating_session_revision ?? newRevision),
  }
}
