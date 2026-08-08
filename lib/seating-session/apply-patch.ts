import type { RoundData } from '@/lib/seating-algorithm'
import { reconcileSnapshot } from '@/lib/seating-session/reconcile'
import type { ReconcileResult, SeatingPatch, SeatingSessionSnapshot } from '@/lib/seating-session/types'

function setParticipantTableAssignment(
  assignments: RoundData['assignments'],
  participantId: string,
  tableLabel: string | null
): RoundData['assignments'] {
  const next = assignments.filter((a) => a.participant_id !== participantId)
  if (tableLabel && tableLabel.trim()) {
    next.push({ participant_id: participantId, table_label: tableLabel })
  }
  return next
}

function updateRound(
  rounds: RoundData[],
  roundNum: number,
  updater: (round: RoundData) => RoundData
): RoundData[] {
  return rounds.map((r) => (r.round === roundNum ? updater(r) : r))
}

export function applyPatchesToSnapshot(
  base: SeatingSessionSnapshot,
  patches: SeatingPatch[]
): ReconcileResult {
  let snapshot: SeatingSessionSnapshot = {
    ...base,
    participants: base.participants.map((p) => ({ ...p })),
    rounds: base.rounds.map((r) => ({
      ...r,
      assignments: [...r.assignments],
      tableLanguages: { ...(r.tableLanguages ?? {}) },
      tableOrder: r.tableOrder ? [...r.tableOrder] : undefined,
    })),
    config: {
      langTableCounts: { ...(base.config.langTableCounts ?? {}) },
      tableLanguagesByRound: base.config.tableLanguagesByRound
        ? { ...base.config.tableLanguagesByRound }
        : undefined,
      tableOrderByRound: base.config.tableOrderByRound
        ? { ...base.config.tableOrderByRound }
        : undefined,
    },
  }

  for (const patch of patches) {
    switch (patch.op) {
      case 'assign': {
        snapshot = {
          ...snapshot,
          rounds: updateRound(snapshot.rounds, patch.round, (r) => ({
            ...r,
            assignments: setParticipantTableAssignment(
              r.assignments,
              patch.participantId,
              patch.tableLabel
            ),
          })),
        }
        break
      }
      case 'replace_round': {
        snapshot = {
          ...snapshot,
          rounds: updateRound(snapshot.rounds, patch.round, (r) => ({
            ...r,
            assignments: patch.assignments.map((a) => ({
              participant_id: a.participant_id,
              table_label: a.table_label,
            })),
            tableLanguages: { ...patch.tableLanguages },
            tableOrder: patch.tableOrder ? [...patch.tableOrder] : r.tableOrder,
          })),
          config: {
            ...snapshot.config,
            tableLanguagesByRound: {
              ...(snapshot.config.tableLanguagesByRound ?? {}),
              [String(patch.round)]: { ...patch.tableLanguages },
            },
            ...(patch.tableOrder
              ? {
                  tableOrderByRound: {
                    ...(snapshot.config.tableOrderByRound ?? {}),
                    [String(patch.round)]: [...patch.tableOrder],
                  },
                }
              : {}),
          },
        }
        break
      }
      case 'set_lang_table_counts': {
        snapshot = {
          ...snapshot,
          config: {
            ...snapshot.config,
            langTableCounts: { ...patch.langTableCounts },
          },
        }
        break
      }
      case 'checkin': {
        const checkedInAt = new Date().toISOString()
        snapshot = {
          ...snapshot,
          participants: snapshot.participants.map((p) =>
            p.id === patch.participantId ? { ...p, checked_in_at: checkedInAt } : p
          ),
        }
        break
      }
      case 'uncheckin': {
        snapshot = {
          ...snapshot,
          participants: snapshot.participants.map((p) =>
            p.id === patch.participantId ? { ...p, checked_in_at: null } : p
          ),
          rounds: snapshot.rounds.map((r) => ({
            ...r,
            assignments: r.assignments.filter((a) => a.participant_id !== patch.participantId),
          })),
        }
        break
      }
      default:
        break
    }
  }

  return reconcileSnapshot(snapshot)
}
