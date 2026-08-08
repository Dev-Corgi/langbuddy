import type { RoundData } from '@/lib/seating-algorithm'
import {
  EMPTY_ROUNDS,
  type ReconcileResult,
  type ReconcileWarning,
  type SeatingSessionSnapshot,
} from '@/lib/seating-session/types'

function normalizeRounds(rounds: RoundData[]): RoundData[] {
  const byRound = new Map(rounds.map((r) => [r.round, r]))
  return EMPTY_ROUNDS.map((skeleton) => {
    const existing = byRound.get(skeleton.round)
    return existing
      ? {
          round: skeleton.round,
          assignments: [...(existing.assignments || [])],
          tableLanguages: { ...(existing.tableLanguages ?? {}) },
          tableOrder: existing.tableOrder ? [...existing.tableOrder] : undefined,
        }
      : { ...skeleton, assignments: [], tableLanguages: {} }
  })
}

export function reconcileSnapshot(input: SeatingSessionSnapshot): ReconcileResult {
  const warnings: ReconcileWarning[] = []
  const participantById = new Map(input.participants.map((p) => [p.id, p]))
  const checkedIds = new Set(
    input.participants.filter((p) => p.checked_in_at).map((p) => p.id)
  )

  const rounds = normalizeRounds(input.rounds).map((round) => {
    const tableLanguages = round.tableLanguages ?? {}
    const validLabels = new Set(Object.keys(tableLanguages))

    const assignments = round.assignments.filter((a) => {
      const participant = participantById.get(a.participant_id)
      if (!participant) {
        warnings.push({
          code: 'unknown_participant',
          participantId: a.participant_id,
          message: `존재하지 않는 참가자(ID ${a.participant_id.slice(0, 8)}…) ${a.table_label} 배정 제거`,
        })
        return false
      }
      if (!checkedIds.has(a.participant_id)) {
        warnings.push({
          code: 'unchecked_assignment',
          participantId: a.participant_id,
          message: `${participant.name}님 ${a.table_label} 테이블(미체크인) 배정 제거`,
        })
        return false
      }
      if (!a.table_label?.trim()) {
        warnings.push({
          code: 'orphan_assignment',
          participantId: a.participant_id,
          message: `${participant.name}님 빈 테이블(${a.table_label ?? '?'}) 배정 제거`,
        })
        return false
      }
      if (validLabels.size > 0 && !validLabels.has(a.table_label)) {
        warnings.push({
          code: 'orphan_assignment',
          participantId: a.participant_id,
          message: `${participant.name}님 없는 테이블(${a.table_label}) 배정 제거`,
        })
        return false
      }
      return true
    })

    return { ...round, assignments, tableLanguages }
  })

  return {
    snapshot: {
      ...input,
      rounds,
      config: {
        langTableCounts: { ...(input.config.langTableCounts ?? {}) },
        tableLanguagesByRound: input.config.tableLanguagesByRound
          ? { ...input.config.tableLanguagesByRound }
          : undefined,
        tableOrderByRound: input.config.tableOrderByRound
          ? { ...input.config.tableOrderByRound }
          : undefined,
      },
    },
    warnings,
  }
}
