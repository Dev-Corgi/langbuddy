import _ from 'lodash'
import type { RoundData } from '@/lib/seating-algorithm'

export type SeatingDebugParticipant = {
  id: string
  name: string
  nationality: string
  gender: string
  language: string
}

export interface DebugLog {
  roundNumber: number
  totalParticipants: number
  duplicatePairs: {
    pair: string
    count: number
    rounds: number[]
  }[]
  duplicateStats: {
    totalPairs: number
    duplicatedPairs: number
    duplicateRate: string
  }
  tableStats: {
    label: string
    language: string
    size: number
    participants: string[]
  }[]
}

export function generateDebugLog(
  roundNumber: number,
  currentRound: RoundData,
  allRounds: RoundData[],
  participants: SeatingDebugParticipant[]
): DebugLog {
  const pairMeetings: Map<string, number[]> = new Map()

  allRounds.forEach((round) => {
    if (round.assignments.length === 0) return

    const tableGroups = _.groupBy(round.assignments, 'table_label')
    Object.values(tableGroups).forEach((group) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const p1 = participants.find((p) => p.id === group[i].participant_id)
          const p2 = participants.find((p) => p.id === group[j].participant_id)
          if (!p1 || !p2) continue

          const pair = [p1.name, p2.name].sort().join(' & ')
          const rounds = pairMeetings.get(pair) || []
          rounds.push(round.round)
          pairMeetings.set(pair, rounds)
        }
      }
    })
  })

  const duplicatePairs = Array.from(pairMeetings.entries())
    .filter(([, r]) => r.length > 1)
    .map(([pair, r]) => ({
      pair,
      count: r.length,
      rounds: r.sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count)

  const totalPairs = pairMeetings.size
  const duplicatedPairs = duplicatePairs.length
  const duplicateRate = totalPairs > 0 ? ((duplicatedPairs / totalPairs) * 100).toFixed(1) : '0.0'

  const tableGroups = _.groupBy(currentRound.assignments, 'table_label')
  const tableStats = Object.entries(tableGroups)
    .map(([label, assignments]) => {
      const tableParticipants = assignments
        .map((a) => participants.find((p) => p.id === a.participant_id))
        .filter(Boolean) as SeatingDebugParticipant[]

      const language = currentRound.tableLanguages?.[label] || tableParticipants[0]?.language || ''
      return {
        label,
        language,
        size: tableParticipants.length,
        participants: tableParticipants.map(
          (p) => `${p.name} (${p.nationality === '외국인' ? 'F' : 'K'}, ${p.gender})`
        ),
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  return {
    roundNumber,
    totalParticipants: participants.length,
    duplicatePairs,
    duplicateStats: {
      totalPairs,
      duplicatedPairs,
      duplicateRate,
    },
    tableStats,
  }
}

export function formatDebugLog(log: DebugLog): string {
  const lines: string[] = []

  lines.push(`\n${'='.repeat(80)}`)
  lines.push(`🔍 ${log.roundNumber}라운드 배치 디버깅 로그`)
  lines.push(`${'='.repeat(80)}\n`)

  lines.push(`📊 전체 통계:`)
  lines.push(`   - 총 참가자: ${log.totalParticipants}명`)
  lines.push(`   - 총 쌍 수: ${log.duplicateStats.totalPairs}개`)
  lines.push(`   - 중복된 쌍: ${log.duplicateStats.duplicatedPairs}개 (${log.duplicateStats.duplicateRate}%)`)
  lines.push(``)

  if (log.duplicatePairs.length > 0) {
    lines.push(`⚠️  중복 만남 발견 (${log.duplicatePairs.length}개):`)
    log.duplicatePairs.forEach((dup, idx) => {
      lines.push(`   ${idx + 1}. ${dup.pair}`)
      lines.push(`      → ${dup.count}번 만남 (라운드: ${dup.rounds.join(', ')})`)
    })
    lines.push(``)
  } else {
    lines.push(`✅ 중복 만남 없음! 완벽한 배치입니다.`)
    lines.push(``)
  }

  lines.push(`📋 테이블별 상세 정보:`)
  log.tableStats.forEach((table) => {
    lines.push(`   [${table.label} 테이블] ${table.language} - ${table.size}명`)
    table.participants.forEach((p, idx) => {
      lines.push(`      ${idx + 1}. ${p}`)
    })
    lines.push(``)
  })

  lines.push(`${'='.repeat(80)}\n`)

  return lines.join('\n')
}
