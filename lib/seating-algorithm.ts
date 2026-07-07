import _ from 'lodash'
import { normalizeLanguage, normalizeParticipantFields } from '@/lib/form-answer-canonical'

export type SeatingAlgorithmParticipant = {
  id: string
  gender: string
  nationality: string
  language: string
}

export type Assignment = {
  participant_id: string
  table_label: string
}

export type RoundData = {
  round: number
  assignments: Assignment[]
  tableLanguages?: Record<string, string>
  /** arrange UI 표시 순서 (없으면 라벨 알파벳 순) */
  tableOrder?: string[]
}

export type DuplicatePairSummary = {
  pair: string
  count: number
  rounds: number[]
}

export type RoundQualityReport = {
  duplicatePairs: DuplicatePairSummary[]
  duplicateRate: string
  totalPairs: number
  duplicatedPairCount: number
}

const GREEDY_ATTEMPTS = 24
const SWAP_ITERATIONS = 1800

function normalizeSeatingParticipant(p: SeatingAlgorithmParticipant): SeatingAlgorithmParticipant {
  const n = normalizeParticipantFields({
    gender: p.gender,
    nationality: p.nationality,
    language: p.language,
  })
  return {
    ...p,
    gender: n.gender ?? p.gender,
    nationality: n.nationality ?? p.nationality,
    language: n.language ?? p.language,
  }
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('-')
}

/** 이전 라운드에서 같은 테이블에 있었던 횟수 */
export function buildSeenPairs(previousRounds: RoundData[]): Map<string, number> {
  const seenPairs = new Map<string, number>()
  previousRounds.forEach((round) => {
    const tableGroups = _.groupBy(round.assignments, 'table_label')
    Object.values(tableGroups).forEach((group) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const key = pairKey(group[i].participant_id, group[j].participant_id)
          seenPairs.set(key, (seenPairs.get(key) || 0) + 1)
        }
      }
    })
  })
  return seenPairs
}

export function pairMeetingCost(previousMeetings: number): number {
  if (previousMeetings <= 0) return 0
  if (previousMeetings === 1) return 100
  if (previousMeetings === 2) return 10_000
  return 1_000_000 * previousMeetings
}

function getRecommendedTableCountForLanguage(count: number): number {
  if (count <= 0) return 0
  if (count <= 4) return 1
  if (count === 5 || count === 6) return 1
  if (count === 7) return 2
  return Math.floor(count / 4)
}

function buildCapacitiesForLanguage(count: number, tableCount?: number): number[] {
  if (count <= 0) return []

  let t = tableCount
  if (!t || t <= 0) {
    t = getRecommendedTableCountForLanguage(count)
  }
  if (t <= 0) t = 1

  if (count <= 4 && t === 1) {
    return [count]
  }

  if ((count === 5 || count === 6) && t === 1) {
    return [count]
  }

  if (count === 7 && t === 2) {
    return [4, 3]
  }

  if (t > count) {
    t = count
  }

  const base = Math.floor(count / t)
  const capacities = new Array(t).fill(base)
  let remaining = count - base * t
  let idx = 0

  while (remaining > 0) {
    capacities[idx % t] += 1
    remaining -= 1
    idx += 1
  }

  return capacities
}

export function getTableWarnings(participants: SeatingAlgorithmParticipant[]): string[] {
  const hasKorean = participants.some((p) => p.nationality === '한국인')
  const hasForeigner = participants.some((p) => p.nationality === '외국인')
  const hasMale = participants.some((p) => p.gender === '남')
  const hasFemale = participants.some((p) => p.gender === '여')

  const warnings: string[] = []
  if (!hasKorean) warnings.push('한국인 없음')
  if (!hasForeigner) warnings.push('외국인 없음')
  if (!hasMale) warnings.push('남성 없음')
  if (!hasFemale) warnings.push('여성 없음')

  return warnings
}

function tableBalancePenalty(members: SeatingAlgorithmParticipant[]): number {
  const warnings = getTableWarnings(members)
  let penalty = 0
  if (warnings.includes('한국인 없음')) penalty += 500
  if (warnings.includes('외국인 없음')) penalty += 500
  if (warnings.includes('남성 없음')) penalty += 200
  if (warnings.includes('여성 없음')) penalty += 200
  return penalty
}

function cloneSlots(slots: Map<string, string[]>): Map<string, string[]> {
  return new Map(Array.from(slots.entries()).map(([label, ids]) => [label, [...ids]]))
}

function slotsToAssignments(slots: Map<string, string[]>): Assignment[] {
  const assignments: Assignment[] = []
  slots.forEach((ids, label) => {
    ids.forEach((participant_id) => {
      assignments.push({ participant_id, table_label: label })
    })
  })
  return assignments
}

function assignmentCost(
  slots: Map<string, string[]>,
  memberById: Map<string, SeatingAlgorithmParticipant>,
  seenPairs: Map<string, number>
): number {
  let cost = 0
  slots.forEach((ids) => {
    const members = ids
      .map((id) => memberById.get(id))
      .filter(Boolean) as SeatingAlgorithmParticipant[]
    cost += tableBalancePenalty(members)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        cost += pairMeetingCost(seenPairs.get(pairKey(ids[i], ids[j])) || 0)
      }
    }
  })
  return cost
}

function marginalAddCost(
  participantId: string,
  tableIds: string[],
  memberById: Map<string, SeatingAlgorithmParticipant>,
  seenPairs: Map<string, number>
): number {
  let cost = 0
  for (const otherId of tableIds) {
    cost += pairMeetingCost(seenPairs.get(pairKey(participantId, otherId)) || 0)
  }
  const before = tableIds.map((id) => memberById.get(id)!).filter(Boolean)
  const after = [...before, memberById.get(participantId)!].filter(Boolean)
  cost += tableBalancePenalty(after) - tableBalancePenalty(before)
  return cost
}

function greedyPartition(
  members: SeatingAlgorithmParticipant[],
  langTableLabels: string[],
  capacities: number[],
  seenPairs: Map<string, number>,
  memberOrder: SeatingAlgorithmParticipant[]
): Map<string, string[]> {
  const memberById = new Map(members.map((m) => [m.id, m]))
  const slots = new Map<string, string[]>(langTableLabels.map((label) => [label, []]))
  const capByLabel = Object.fromEntries(
    langTableLabels.map((label, idx) => [label, capacities[idx]])
  ) as Record<string, number>

  for (const member of memberOrder) {
    let bestLabel = langTableLabels[0]
    let bestCost = Infinity

    for (const label of langTableLabels) {
      const current = slots.get(label)!
      if (current.length >= capByLabel[label]) continue

      const marginal = marginalAddCost(member.id, current, memberById, seenPairs)
      const tieBreak = current.length * 0.001
      const total = marginal + tieBreak

      if (total < bestCost) {
        bestCost = total
        bestLabel = label
      }
    }

    slots.get(bestLabel)!.push(member.id)
  }

  return slots
}

function refineWithSwaps(
  slots: Map<string, string[]>,
  langTableLabels: string[],
  memberById: Map<string, SeatingAlgorithmParticipant>,
  seenPairs: Map<string, number>
): Map<string, string[]> {
  let current = cloneSlots(slots)
  let currentCost = assignmentCost(current, memberById, seenPairs)

  for (let iter = 0; iter < SWAP_ITERATIONS; iter++) {
    let improved = false

    for (let i = 0; i < langTableLabels.length; i++) {
      for (let j = i + 1; j < langTableLabels.length; j++) {
        const labelA = langTableLabels[i]
        const labelB = langTableLabels[j]
        const idsA = current.get(labelA)!
        const idsB = current.get(labelB)!

        for (const pId of idsA) {
          for (const qId of idsB) {
            const next = cloneSlots(current)
            const nextA = next.get(labelA)!
            const nextB = next.get(labelB)!
            const pIdx = nextA.indexOf(pId)
            const qIdx = nextB.indexOf(qId)
            if (pIdx < 0 || qIdx < 0) continue
            nextA[pIdx] = qId
            nextB[qIdx] = pId

            const nextCost = assignmentCost(next, memberById, seenPairs)
            if (nextCost < currentCost) {
              current = next
              currentCost = nextCost
              improved = true
            }
          }
        }
      }
    }

    if (!improved) break
  }

  return current
}

function partitionLanguageGroup(
  members: SeatingAlgorithmParticipant[],
  langTableLabels: string[],
  capacities: number[],
  seenPairs: Map<string, number>
): Map<string, string[]> {
  const memberById = new Map(members.map((m) => [m.id, m]))
  let bestSlots: Map<string, string[]> | null = null
  let bestCost = Infinity

  for (let attempt = 0; attempt < GREEDY_ATTEMPTS; attempt++) {
    const order =
      attempt === 0
        ? [...members].sort((a, b) => {
            const aF = a.nationality === '외국인' ? 0 : 1
            const bF = b.nationality === '외국인' ? 0 : 1
            if (aF !== bF) return aF - bF
            return a.id.localeCompare(b.id)
          })
        : _.shuffle([...members])

    const greedy = greedyPartition(members, langTableLabels, capacities, seenPairs, order)
    const refined = refineWithSwaps(greedy, langTableLabels, memberById, seenPairs)
    const cost = assignmentCost(refined, memberById, seenPairs)

    if (cost < bestCost) {
      bestCost = cost
      bestSlots = refined
    }
    if (bestCost === 0) break
  }

  return bestSlots ?? new Map(langTableLabels.map((label) => [label, []]))
}

export function arrangeRound(
  roundNumber: number,
  participants: SeatingAlgorithmParticipant[],
  langTableCounts: Record<string, number>,
  previousRounds: RoundData[] = []
): RoundData {
  const normalizedParticipants = participants.map(normalizeSeatingParticipant)
  const normalizedCounts = Object.fromEntries(
    Object.entries(langTableCounts).map(([lang, count]) => [normalizeLanguage(lang), count])
  )
  const languageGroups = _.groupBy(normalizedParticipants, 'language')
  const languages = Object.keys(languageGroups).sort()

  const newRoundAssignments: Assignment[] = []
  const tableLanguages: Record<string, string> = {}
  let totalTableIdx = 0

  const seenPairs = buildSeenPairs(previousRounds)

  languages.forEach((lang) => {
    const members = languageGroups[lang]
    if (!members || members.length === 0) {
      return
    }

    const capacities = buildCapacitiesForLanguage(members.length, normalizedCounts[lang])
    const langTableCount = capacities.length
    const langTableLabels = Array.from({ length: langTableCount }, (_, i) =>
      String.fromCharCode(65 + totalTableIdx + i)
    )

    langTableLabels.forEach((label) => {
      tableLanguages[label] = lang
    })

    totalTableIdx += langTableCount

    const slots = partitionLanguageGroup(members, langTableLabels, capacities, seenPairs)
    newRoundAssignments.push(...slotsToAssignments(slots))
  })

  return { round: roundNumber, assignments: newRoundAssignments, tableLanguages }
}

export function runAutoArrange(
  participants: SeatingAlgorithmParticipant[],
  langTableCounts: Record<string, number>
): RoundData[] {
  const round1 = arrangeRound(1, participants, langTableCounts, [])
  const round2 = arrangeRound(2, participants, langTableCounts, [round1])
  const round3 = arrangeRound(3, participants, langTableCounts, [round1, round2])

  return [round1, round2, round3]
}

export function calculateAutoTableCounts(
  participants: SeatingAlgorithmParticipant[]
): Record<string, number> {
  const languageGroups = _.groupBy(
    participants.map(normalizeSeatingParticipant),
    'language'
  )
  const counts: Record<string, number> = {}

  Object.entries(languageGroups).forEach(([lang, members]) => {
    counts[lang] = getRecommendedTableCountForLanguage(members.length)
  })

  return counts
}

/** 늦참·수동 배치: 이전 라운드 재회를 최소화하는 테이블 선택 */
export function pickBestTableForLateJoin(
  newcomer: SeatingAlgorithmParticipant,
  roundAssignments: Assignment[],
  tableLanguages: Record<string, string>,
  allParticipants: SeatingAlgorithmParticipant[],
  previousRounds: RoundData[]
): string | null {
  const n = normalizeSeatingParticipant(newcomer)
  const matchingTables = Object.keys(tableLanguages).filter(
    (label) => normalizeLanguage(tableLanguages[label]) === n.language
  )
  if (matchingTables.length === 0) return null

  const seenPairs = buildSeenPairs(previousRounds)
  const memberById = new Map(allParticipants.map((p) => [p.id, p]))

  let bestLabel: string | null = null
  let bestScore = Infinity

  for (const label of matchingTables) {
    const tableMemberIds = roundAssignments
      .filter((a) => a.table_label === label)
      .map((a) => a.participant_id)

    let score = marginalAddCost(n.id, tableMemberIds, memberById, seenPairs)
    score += tableMemberIds.length * 0.01

    if (score < bestScore) {
      bestScore = score
      bestLabel = label
    }
  }

  return bestLabel
}

/** 드래그 시: 해당 테이블로 옮기면 이전 라운드 기준 몇 번째 재회인지 */
export function reunionCountIfJoinedTable(
  participantId: string,
  tableLabel: string,
  roundAssignments: Assignment[],
  previousRounds: RoundData[]
): { maxReunions: number; worstPairName: string | null } {
  const seenPairs = buildSeenPairs(previousRounds)
  const tableMemberIds = roundAssignments
    .filter((a) => a.table_label === tableLabel && a.participant_id !== participantId)
    .map((a) => a.participant_id)

  let maxReunions = 0
  for (const otherId of tableMemberIds) {
    const count = seenPairs.get(pairKey(participantId, otherId)) || 0
    if (count > maxReunions) maxReunions = count
  }

  return { maxReunions, worstPairName: null }
}

export function evaluateRoundQuality(
  roundData: RoundData,
  allRounds: RoundData[],
  participants: { id: string; name: string }[]
): RoundQualityReport {
  const pairMeetings = new Map<string, number[]>()
  const nameById = Object.fromEntries(participants.map((p) => [p.id, p.name]))

  allRounds.forEach((round) => {
    if (round.assignments.length === 0) return
    const tableGroups = _.groupBy(round.assignments, 'table_label')
    Object.values(tableGroups).forEach((group) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const n1 = nameById[group[i].participant_id] || '?'
          const n2 = nameById[group[j].participant_id] || '?'
          const pair = [n1, n2].sort().join(' & ')
          const rounds = pairMeetings.get(pair) || []
          rounds.push(round.round)
          pairMeetings.set(pair, rounds)
        }
      }
    })
  })

  const duplicatePairs = Array.from(pairMeetings.entries())
    .filter(([, rounds]) => rounds.length > 1)
    .map(([pair, rounds]) => ({
      pair,
      count: rounds.length,
      rounds: rounds.sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count)

  const totalPairs = pairMeetings.size
  const duplicatedPairCount = duplicatePairs.length
  const duplicateRate =
    totalPairs > 0 ? ((duplicatedPairCount / totalPairs) * 100).toFixed(1) : '0.0'

  return {
    duplicatePairs,
    duplicateRate,
    totalPairs,
    duplicatedPairCount,
  }
}

export function formatDuplicateWarningMessage(report: RoundQualityReport, maxLines = 4): string {
  if (report.duplicatedPairCount === 0) {
    return '이번 라운드까지 재회 쌍이 없습니다.'
  }

  const lines = report.duplicatePairs.slice(0, maxLines).map(
    (d) => `${d.pair} (${d.count}회, R${d.rounds.join('/')})`
  )
  const rest =
    report.duplicatedPairCount > maxLines
      ? ` 외 ${report.duplicatedPairCount - maxLines}쌍`
      : ''
  return `재회 ${report.duplicatedPairCount}쌍 (${report.duplicateRate}%) — ${lines.join(' · ')}${rest}`
}
