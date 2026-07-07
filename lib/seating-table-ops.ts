import type { RoundData } from '@/lib/seating-algorithm'

const TABLE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function sortTableLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/** arrange UI용 — 저장된 순서 우선, 없으면 알파벳 */
export function orderedTableLabels(
  tableLanguages: Record<string, string>,
  savedOrder?: string[] | null
): string[] {
  const labels = Object.keys(tableLanguages)
  if (labels.length === 0) return []
  if (!savedOrder?.length) return sortTableLabels(labels)

  const labelSet = new Set(labels)
  const valid = savedOrder.filter((l) => labelSet.has(l))
  const missing = sortTableLabels(labels.filter((l) => !valid.includes(l)))
  return [...valid, ...missing]
}

export function tableOrderSortableId(round: number, label: string): string {
  return `table-order-${round}-${label}`
}

export function parseTableOrderSortableId(id: string): { round: number; label: string } | null {
  const match = id.match(/^table-order-(\d+)-([A-Z])$/)
  if (!match) return null
  return { round: parseInt(match[1], 10), label: match[2] }
}

export function reorderTableLabels(
  tableLanguages: Record<string, string>,
  currentOrder: string[] | undefined,
  activeLabel: string,
  overLabel: string
): string[] {
  const labels = orderedTableLabels(tableLanguages, currentOrder)
  const oldIndex = labels.indexOf(activeLabel)
  const newIndex = labels.indexOf(overLabel)
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return labels

  const next = [...labels]
  const [removed] = next.splice(oldIndex, 1)
  next.splice(newIndex, 0, removed)
  return next
}

export function getNextTableLabel(existing: string[]): string | null {
  const used = new Set(existing.map((l) => l.toUpperCase()))
  for (const label of TABLE_LABELS) {
    if (!used.has(label)) return label
  }
  return null
}

/** 라운드 tableLanguages 기준 언어별 테이블 수 */
export function countTablesByLanguage(tableLanguages: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const lang of Object.values(tableLanguages)) {
    if (!lang) continue
    counts[lang] = (counts[lang] ?? 0) + 1
  }
  return counts
}

/** 모든 라운드 tableLanguages 기준 언어별 최대 테이블 수 */
export function langTableCountsFromRounds(rounds: RoundData[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const r of rounds) {
    const perLang = countTablesByLanguage(r.tableLanguages ?? {})
    for (const [lang, n] of Object.entries(perLang)) {
      counts[lang] = Math.max(counts[lang] ?? 0, n)
    }
  }
  return counts
}

/** langTableCounts에 라운드 테이블 수를 반영 (언어별 최댓값 유지) */
export function mergeLangTableCounts(
  current: Record<string, number>,
  roundTableLanguages: Record<string, string>
): Record<string, number> {
  const fromRound = countTablesByLanguage(roundTableLanguages)
  const next = { ...current }
  for (const [lang, count] of Object.entries(fromRound)) {
    next[lang] = Math.max(next[lang] ?? 0, count)
  }
  return next
}

export function addTableToRound(
  roundData: RoundData,
  language: string
): { roundData: RoundData; label: string } | null {
  const existing = Object.keys(roundData.tableLanguages ?? {})
  const label = getNextTableLabel(existing)
  if (!label) return null

  const tableLanguages = {
    ...(roundData.tableLanguages ?? {}),
    [label]: language,
  }

  return {
    label,
    roundData: {
      ...roundData,
      tableLanguages,
      tableOrder: orderedTableLabels(tableLanguages, [
        ...orderedTableLabels(roundData.tableLanguages ?? {}, roundData.tableOrder),
        label,
      ]),
    },
  }
}

export function removeTableFromRound(
  roundData: RoundData,
  label: string
): { roundData: RoundData; removedAssignmentCount: number } {
  const tableLanguages = { ...(roundData.tableLanguages ?? {}) }
  delete tableLanguages[label]

  const assignments = roundData.assignments.filter((a) => {
    if (a.table_label !== label) return true
    return false
  })
  const removedAssignmentCount = roundData.assignments.length - assignments.length

  const remainingOrder = (roundData.tableOrder ?? []).filter((l) => l !== label)
  const tableOrder =
    Object.keys(tableLanguages).length > 0
      ? orderedTableLabels(tableLanguages, remainingOrder.length ? remainingOrder : undefined)
      : undefined

  return {
    roundData: {
      ...roundData,
      tableLanguages,
      assignments,
      tableOrder,
    },
    removedAssignmentCount,
  }
}
