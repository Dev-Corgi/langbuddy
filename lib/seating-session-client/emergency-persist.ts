import { orderedTableLabels } from '@/lib/seating-table-ops'
import type { SeatingPatch, SeatingSessionSnapshot } from '@/lib/seating-session/types'

const STORAGE_KEY = 'langbuddy-seating-emergency-v1'

export type EmergencySeatingBackup = {
  postingId: string
  sessionDate: string
  dayOfWeek: string
  snapshot: SeatingSessionSnapshot
  savedAt: number
}

/** 서버 snapshot → 로컬 optimistic snapshot 따라잡기 패치 */
export function buildCatchUpPatches(
  server: SeatingSessionSnapshot,
  local: SeatingSessionSnapshot
): SeatingPatch[] {
  const patches: SeatingPatch[] = []

  for (const localRound of local.rounds) {
    const serverRound = server.rounds.find((r) => r.round === localRound.round)
    const localLabels = orderedTableLabels(
      localRound.tableLanguages ?? {},
      localRound.tableOrder
    )
    const serverLabels = orderedTableLabels(
      serverRound?.tableLanguages ?? {},
      serverRound?.tableOrder
    )
    const localAssigns = JSON.stringify(localRound.assignments)
    const serverAssigns = JSON.stringify(serverRound?.assignments ?? [])

    if (localLabels.join() !== serverLabels.join() || localAssigns !== serverAssigns) {
      patches.push({
        op: 'replace_round',
        round: localRound.round,
        assignments: localRound.assignments,
        tableLanguages: localRound.tableLanguages ?? {},
        tableOrder: localRound.tableOrder ?? null,
      })
    }
  }

  const serverChecked = new Set(
    server.participants.filter((p) => p.checked_in_at).map((p) => p.id)
  )
  for (const participant of local.participants) {
    const localChecked = Boolean(participant.checked_in_at)
    const serverWasChecked = serverChecked.has(participant.id)
    if (localChecked && !serverWasChecked) {
      patches.push({ op: 'checkin', participantId: participant.id })
    } else if (!localChecked && serverWasChecked) {
      patches.push({ op: 'uncheckin', participantId: participant.id })
    }
  }

  for (const [participantId, tableLabel] of collectAssignOverrides(server, local)) {
    patches.push({ op: 'assign', round: tableLabel.round, participantId, tableLabel: tableLabel.label })
  }

  const localLangCounts = JSON.stringify(local.config.langTableCounts ?? {})
  const serverLangCounts = JSON.stringify(server.config.langTableCounts ?? {})
  if (localLangCounts !== serverLangCounts) {
    patches.push({ op: 'set_lang_table_counts', langTableCounts: local.config.langTableCounts ?? {} })
  }

  return patches
}

function collectAssignOverrides(
  server: SeatingSessionSnapshot,
  local: SeatingSessionSnapshot
): Map<string, { round: number; label: string | null }> {
  const overrides = new Map<string, { round: number; label: string | null }>()

  for (const localRound of local.rounds) {
    for (const assign of localRound.assignments) {
      const serverRound = server.rounds.find((r) => r.round === localRound.round)
      const serverAssign = serverRound?.assignments.find(
        (a) => a.participant_id === assign.participant_id
      )
      const localLabel = assign.table_label ?? null
      const serverLabel = serverAssign?.table_label ?? null
      if (localLabel !== serverLabel) {
        overrides.set(assign.participant_id, { round: localRound.round, label: localLabel })
      }
    }
  }

  return overrides
}

export function writeEmergencyBackup(snapshot: SeatingSessionSnapshot): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    const backup: EmergencySeatingBackup = {
      postingId: snapshot.key.postingId,
      sessionDate: snapshot.key.sessionDate,
      dayOfWeek: snapshot.key.dayOfWeek,
      snapshot,
      savedAt: Date.now(),
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(backup))
  } catch {
    /* quota / private mode */
  }
}

export function readEmergencyBackup(): EmergencySeatingBackup | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as EmergencySeatingBackup
  } catch {
    return null
  }
}

export function clearEmergencyBackup(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function matchesEmergencySession(
  snapshot: SeatingSessionSnapshot,
  backup: EmergencySeatingBackup
): boolean {
  return (
    backup.postingId === snapshot.key.postingId &&
    backup.sessionDate === snapshot.key.sessionDate &&
    backup.dayOfWeek === snapshot.key.dayOfWeek
  )
}
