import type { SeatingPatch } from '@/lib/seating-session/types'

function assignKey(patch: Extract<SeatingPatch, { op: 'assign' }>): string {
  return `${patch.round}:${patch.participantId}`
}

function participantCheckinKey(patch: SeatingPatch): string | null {
  if (patch.op === 'checkin' || patch.op === 'uncheckin') return patch.participantId
  return null
}

/** 패치 배열을 op별 last-write-wins로 합친다. */
export function coalescePatches(patches: SeatingPatch[]): SeatingPatch[] {
  if (patches.length <= 1) return patches

  const lastCheckinOpByParticipant = new Map<
    string,
    Extract<SeatingPatch, { op: 'checkin' } | { op: 'uncheckin' }>
  >()
  const lastReplaceByRound = new Map<number, Extract<SeatingPatch, { op: 'replace_round' }>>()
  const lastAssignByKey = new Map<string, Extract<SeatingPatch, { op: 'assign' }>>()
  let lastLangCounts: Extract<SeatingPatch, { op: 'set_lang_table_counts' }> | null = null

  for (const patch of patches) {
    switch (patch.op) {
      case 'checkin':
      case 'uncheckin': {
        const key = participantCheckinKey(patch)
        if (key) lastCheckinOpByParticipant.set(key, patch)
        break
      }
      case 'replace_round':
        lastReplaceByRound.set(patch.round, patch)
        break
      case 'assign':
        lastAssignByKey.set(assignKey(patch), patch)
        break
      case 'set_lang_table_counts':
        lastLangCounts = patch
        break
      default:
        break
    }
  }

  return [
    ...Array.from(lastCheckinOpByParticipant.values()),
    ...Array.from(lastReplaceByRound.values()).sort((a, b) => a.round - b.round),
    ...Array.from(lastAssignByKey.values()),
    ...(lastLangCounts ? [lastLangCounts] : []),
  ]
}
