import type { RoundData } from '@/lib/seating-algorithm'
import type { SeatingSessionSnapshot } from '@/lib/seating-session/types'

function stableJson(value: unknown): string {
  return JSON.stringify(value)
}

function tableCount(round: RoundData): number {
  return Object.keys(round.tableLanguages ?? {}).length
}

function assignmentCount(round: RoundData): number {
  return round.assignments.length
}

function roundIsAheadOf(local: RoundData, incoming: RoundData): boolean {
  if (tableCount(local) > tableCount(incoming)) return true
  if (tableCount(local) < tableCount(incoming)) return false
  if (assignmentCount(local) > assignmentCount(incoming)) return true
  if (assignmentCount(local) < assignmentCount(incoming)) return false
  if (stableJson(local.assignments) !== stableJson(incoming.assignments)) return true
  if (stableJson(local.tableOrder) !== stableJson(incoming.tableOrder)) {
    return stableJson(local.tableOrder).length > stableJson(incoming.tableOrder).length
  }
  return false
}

/** 서버 snapshot이 화면상 동일하면 rounds/participants 참조를 유지해 리렌더·깜빡임을 줄인다. */
export function mergeServerSnapshot(
  prev: SeatingSessionSnapshot | null,
  next: SeatingSessionSnapshot
): SeatingSessionSnapshot {
  if (!prev) return next

  const roundsSame = stableJson(prev.rounds) === stableJson(next.rounds)
  const participantsSame = stableJson(prev.participants) === stableJson(next.participants)
  const configSame = stableJson(prev.config) === stableJson(next.config)
  const metaSame =
    prev.revision === next.revision &&
    prev.updatedAt === next.updatedAt &&
    prev.key.epoch === next.key.epoch

  if (roundsSame && participantsSame && configSame && metaSame) {
    return prev
  }

  if (roundsSame && participantsSame && configSame) {
    return {
      ...prev,
      revision: next.revision,
      updatedAt: next.updatedAt,
      key: { ...prev.key, epoch: next.key.epoch },
    }
  }

  return next
}

/**
 * 서버 ack / external reload 시 아직 flush되지 않은 로컬 진행 상태를 되돌리지 않는다.
 * (다른 탭에서 서버가 더 앞선 경우 incoming을 따름)
 */
export function mergeSnapshotPreferLocalProgress(
  local: SeatingSessionSnapshot,
  incoming: SeatingSessionSnapshot
): SeatingSessionSnapshot {
  const merged = mergeServerSnapshot(local, incoming)
  if (merged === local) return local

  const rounds = local.rounds.map((localRound) => {
    const fromIncoming = incoming.rounds.find((r) => r.round === localRound.round)
    const fromMerged = merged.rounds.find((r) => r.round === localRound.round)
    if (!fromIncoming || !fromMerged) return localRound
    return roundIsAheadOf(localRound, fromIncoming) ? localRound : fromMerged
  })

  const participants =
    stableJson(local.participants) !== stableJson(incoming.participants) &&
    local.participants.filter((p) => p.checked_in_at).length >
      incoming.participants.filter((p) => p.checked_in_at).length
      ? local.participants
      : merged.participants

  return {
    ...merged,
    revision: incoming.revision,
    updatedAt: incoming.updatedAt,
    key: { ...merged.key, epoch: incoming.key.epoch },
    rounds,
    participants,
  }
}
