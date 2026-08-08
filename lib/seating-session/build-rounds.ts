import type { RoundData } from '@/lib/seating-algorithm'
import type { SeatingConfigPayload } from '@/lib/seating-live-sync'
import { inferTableLanguages } from '@/lib/seating-live-sync'
import { EMPTY_ROUNDS } from '@/lib/seating-session/types'

export type SeatingAssignmentRow = {
  round: number
  participant_id: string
  table_label: string
}

export function buildRoundsFromRows(
  rows: SeatingAssignmentRow[],
  participants: { id: string; language: string }[],
  config?: SeatingConfigPayload | null
): RoundData[] {
  return EMPTY_ROUNDS.map((skeleton) => {
    const roundNum = skeleton.round
    const assignments = rows
      .filter((a) => a.round === roundNum)
      .map((a) => ({
        participant_id: a.participant_id,
        table_label: a.table_label,
      }))
    const fromConfig = config?.tableLanguagesByRound?.[String(roundNum)]
    const tableLanguages =
      fromConfig && Object.keys(fromConfig).length > 0
        ? fromConfig
        : inferTableLanguages(assignments, participants)
    const tableOrder = config?.tableOrderByRound?.[String(roundNum)]
    return { round: roundNum, assignments, tableLanguages, tableOrder }
  })
}
