import type { SeatingPatch } from '@/lib/seating-session/types'
import { coalescePatches } from '@/lib/seating-session-client/coalesce-patches'

export type OutboxEntry = {
  patches: SeatingPatch[]
  resolve: (ok: boolean) => void
}

/** Outbox flush 직전: 동일 라운드 replace 등 중복 mutation을 하나로 합친다. */
export function coalesceOutboxEntries(entries: OutboxEntry[]): OutboxEntry[] {
  if (entries.length <= 1) return entries

  const resolves: Array<(ok: boolean) => void> = []
  for (const entry of entries) {
    resolves.push(entry.resolve)
  }

  const mergedPatches = coalescePatches(entries.flatMap((entry) => entry.patches))

  if (mergedPatches.length === 0) {
    return [
      {
        patches: [],
        resolve: (ok) => {
          for (const resolve of resolves) resolve(ok)
        },
      },
    ]
  }

  return [
    {
      patches: mergedPatches,
      resolve: (ok) => {
        for (const resolve of resolves) resolve(ok)
      },
    },
  ]
}

/** Outbox에 남은 mutation을 coalesce해 snapshot 위에 다시 적용할 패치 목록 */
export function collectPendingPatches(entries: OutboxEntry[]): SeatingPatch[] {
  if (entries.length === 0) return []
  return coalescePatches(entries.flatMap((entry) => entry.patches))
}
