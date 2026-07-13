import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { extractParticipantInfoFromAnswers } from '@/lib/utils'
import { SessionDetailShell } from './_components/session-detail-shell'

export type SessionParticipant = {
  responseId: string
  name: string
  nationality: string
  language: string
  gender: string
}

export type SessionRound = {
  round: number
  tableLabel: string
  mates: SessionParticipant[]
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ posting_id: string; session_date: string }>
}) {
  const { posting_id, session_date } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/my')
  }

  const admin = createSupabaseAdmin()

  // 현재 사용자의 form_responses 중 이 세션에 배치된 항목 조회
  const { data: myResponses } = await admin
    .from('form_responses')
    .select('id')
    .eq('user_id', user.id)

  if (!myResponses?.length) {
    redirect('/my')
  }

  const myResponseIds = myResponses.map((r) => r.id)

  // 사용자가 이 세션에 배치되어 있는지 확인
  const { data: myAssignments } = await admin
    .from('seating_assignments')
    .select('participant_id, round, table_label')
    .eq('posting_id', posting_id)
    .eq('session_date', session_date)
    .in('participant_id', myResponseIds)

  if (!myAssignments?.length) {
    redirect('/my')
  }

  // 사용자의 라운드별 (round → table_label) 맵
  const myTableByRound = new Map<number, { tableLabel: string; responseId: string }>()
  for (const a of myAssignments) {
    myTableByRound.set(a.round as number, {
      tableLabel: String(a.table_label),
      responseId: String(a.participant_id),
    })
  }

  // 이 세션의 전체 배치 조회
  const { data: allAssignments } = await admin
    .from('seating_assignments')
    .select('participant_id, round, table_label')
    .eq('posting_id', posting_id)
    .eq('session_date', session_date)

  if (!allAssignments?.length) {
    redirect('/my')
  }

  // 같은 테이블 동석자 participant_id 수집
  const mateSets = new Map<number, Set<string>>() // round → Set<participant_id>
  for (const a of allAssignments) {
    const round = a.round as number
    const mySlot = myTableByRound.get(round)
    if (!mySlot) continue
    if (a.table_label !== mySlot.tableLabel) continue
    if (String(a.participant_id) === mySlot.responseId) continue // 나 자신 제외

    if (!mateSets.has(round)) mateSets.set(round, new Set())
    mateSets.get(round)!.add(String(a.participant_id))
  }

  // 동석자 form_responses 조회
  const allMateIds = Array.from(mateSets.values()).flatMap((s) => Array.from(s))
  const uniqueMateIds = Array.from(new Set(allMateIds))

  let mateResponsesMap = new Map<string, { answers: Record<string, unknown> }>()
  if (uniqueMateIds.length > 0) {
    const { data: mateRows } = await admin
      .from('form_responses')
      .select('id, answers')
      .in('id', uniqueMateIds)

    for (const row of mateRows || []) {
      mateResponsesMap.set(row.id, { answers: (row.answers || {}) as Record<string, unknown> })
    }
  }

  // 신고 이미 접수한 항목 조회 (같은 라운드 중복 신고 방지 표시)
  const myReporterResponseIds = Array.from(myTableByRound.values()).map((v) => v.responseId)
  const { data: existingReports } = await admin
    .from('reports')
    .select('reported_response_id, round, reporter_response_id')
    .in('reporter_response_id', myReporterResponseIds)

  const reportedSet = new Set<string>() // `${round}|${reported_response_id}`
  for (const r of existingReports || []) {
    reportedSet.add(`${r.round}|${r.reported_response_id}`)
  }

  // 라운드별 구조화
  const rounds: SessionRound[] = []
  for (const [round, mySlot] of Array.from(myTableByRound.entries()).sort(([a], [b]) => a - b)) {
    const mateIds = Array.from(mateSets.get(round) || [])
    const mates: SessionParticipant[] = mateIds.map((mateId) => {
      const mateRow = mateResponsesMap.get(mateId)
      const info = extractParticipantInfoFromAnswers(mateRow?.answers ?? null, [])
      return {
        responseId: mateId,
        name: info.name || '(이름 없음)',
        nationality: info.nationality || '',
        language: info.language || '',
        gender: info.gender || '',
      }
    })

    rounds.push({
      round,
      tableLabel: mySlot.tableLabel,
      mates,
    })
  }

  // 신고자 responseId 맵 (round → responseId)
  const myResponseIdByRound = Object.fromEntries(
    Array.from(myTableByRound.entries()).map(([round, slot]) => [round, slot.responseId])
  )

  return (
    <SessionDetailShell
      postingId={posting_id}
      sessionDate={session_date}
      rounds={rounds}
      myResponseIdByRound={myResponseIdByRound}
      reportedSet={Array.from(reportedSet)}
    />
  )
}
