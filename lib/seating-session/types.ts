import type { RoundData } from '@/lib/seating-algorithm'
import type { ArrangedParticipant } from '@/lib/walk-in-participant'
import type { SeatingConfigPayload } from '@/lib/seating-live-sync'

export type SeatingSessionKey = {
  postingId: string
  sessionDate: string
  formId: string
  dayOfWeek: string
  epoch: number
}

export type SeatingSessionSnapshot = {
  key: SeatingSessionKey
  revision: number
  updatedAt: string
  participants: ArrangedParticipant[]
  rounds: RoundData[]
  config: SeatingConfigPayload
}

export type SeatingPatchAssign = {
  op: 'assign'
  round: number
  participantId: string
  tableLabel: string | null
}

export type SeatingPatchReplaceRound = {
  op: 'replace_round'
  round: number
  assignments: { participant_id: string; table_label: string }[]
  tableLanguages: Record<string, string>
  tableOrder?: string[] | null
}

export type SeatingPatchSetLangTableCounts = {
  op: 'set_lang_table_counts'
  langTableCounts: Record<string, number>
}

export type SeatingPatchCheckin = {
  op: 'checkin'
  participantId: string
  source?: string
}

export type SeatingPatchUncheckin = {
  op: 'uncheckin'
  participantId: string
}

export type SeatingPatch =
  | SeatingPatchAssign
  | SeatingPatchReplaceRound
  | SeatingPatchSetLangTableCounts
  | SeatingPatchCheckin
  | SeatingPatchUncheckin

export type ReconcileWarning = {
  code: 'orphan_assignment' | 'unchecked_assignment' | 'unknown_participant'
  participantId?: string
  message: string
}

export type ReconcileResult = {
  snapshot: SeatingSessionSnapshot
  warnings: ReconcileWarning[]
}

export const EMPTY_ROUNDS: RoundData[] = [
  { round: 1, assignments: [], tableLanguages: {} },
  { round: 2, assignments: [], tableLanguages: {} },
  { round: 3, assignments: [], tableLanguages: {} },
]
