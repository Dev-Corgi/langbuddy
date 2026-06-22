import type { RoundData } from '@/lib/seating-algorithm'

const TABLE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function sortTableLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
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

  return {
    label,
    roundData: {
      ...roundData,
      tableLanguages: {
        ...(roundData.tableLanguages ?? {}),
        [label]: language,
      },
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

  return {
    roundData: {
      ...roundData,
      tableLanguages,
      assignments,
    },
    removedAssignmentCount,
  }
}
