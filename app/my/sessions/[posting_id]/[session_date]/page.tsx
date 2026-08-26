import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { extractParticipantInfoFromAnswers } from '@/lib/utils'
import { SessionDetailShell } from './_components/session-detail-shell'

export type SessionParticipant = {
  responseId: string
  userId: string | null
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

  // 신고 여부는 신고 대상 user_id 기준으로 판단 (신고자의 응답이 이번 주 초기화로
  // 사라졌든 아직 살아있든 항상 동일한 방식으로 조회 가능).
  const { data: existingReports } = await admin
    .from('reports')
    .select('reported_user_id, round')
    .eq('reporter_user_id', user.id)
    .eq('posting_id', posting_id)
    .eq('session_date', session_date)

  const { data: existingPraises } = await admin
    .from('praises')
    .select('praised_user_id, round')
    .eq('praiser_user_id', user.id)
    .eq('posting_id', posting_id)
    .eq('session_date', session_date)

  const reportedSet = new Set<string>() // `${round}|${reported_user_id}`
  for (const r of existingReports || []) {
    if (r.reported_user_id) reportedSet.add(`${r.round}|${r.reported_user_id}`)
  }

  const praisedSet = new Set<string>() // `${round}|${praised_user_id}`
  for (const p of existingPraises || []) {
    if (p.praised_user_id) praisedSet.add(`${p.round}|${p.praised_user_id}`)
  }

  const { data: existingFacilityReport } = await admin
    .from('facility_reports')
    .select('id')
    .eq('reporter_user_id', user.id)
    .eq('posting_id', posting_id)
    .eq('session_date', session_date)
    .maybeSingle()

  const facilityReportSubmitted = !!existingFacilityReport

  // 현재 사용자의 form_responses 중 이 세션에 배치된 항목 조회
  const { data: myResponses } = await admin
    .from('form_responses')
    .select('id')
    .eq('user_id', user.id)

  const myResponseIds = (myResponses || []).map((r) => r.id)

  // 사용자가 이 세션에 배치되어 있는지 확인
  const { data: myAssignments } = myResponseIds.length
    ? await admin
        .from('seating_assignments')
        .select('participant_id, round, table_label')
        .eq('posting_id', posting_id)
        .eq('session_date', session_date)
        .in('participant_id', myResponseIds)
    : { data: null }

  // 매주 일요일 초기화로 이 세션의 실시간 데이터가 이미 삭제된 경우,
  // 삭제 직전에 남겨둔 스냅샷(le_participation_archive)으로 대체 표시.
  // 동석자의 user_id도 함께 스냅샷에 저장되므로(2026-08-04~), 응답이 사라진
  // 뒤에도 신고가 가능하다. (그 이전에 아카이빙된 행은 user_id가 없어 신고 버튼이
  // 비활성 상태로 표시됨 — 소급 적용은 불가능)
  if (!myAssignments?.length) {
    const { data: archiveRows } = await admin
      .from('le_participation_archive')
      .select('id, response_id, round, table_label, mates')
      .eq('user_id', user.id)
      .eq('posting_id', posting_id)
      .eq('session_date', session_date)
      .order('round', { ascending: true })

    if (!archiveRows?.length) {
      redirect('/my')
    }

    const archivedRounds: SessionRound[] = archiveRows.map((row) => ({
      round: row.round as number,
      tableLabel: String(row.table_label),
      mates: ((row.mates as Array<{
        userId?: string | null
        name?: string
        nationality?: string
        language?: string
        gender?: string
      }> | null) || []).map((m, idx) => ({
        responseId: `archive-${row.id}-${idx}`,
        userId: m.userId || null,
        name: m.name || '(이름 없음)',
        nationality: m.nationality || '',
        language: m.language || '',
        gender: m.gender || '',
      })),
    }))

    return (
      <SessionDetailShell
        postingId={posting_id}
        sessionDate={session_date}
        rounds={archivedRounds}
        reportedSet={Array.from(reportedSet)}
        praisedSet={Array.from(praisedSet)}
        facilityReportSubmitted={facilityReportSubmitted}
      />
    )
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

  // 동석자 form_responses 조회 (user_id도 함께 — 신고 대상 식별용)
  const allMateIds = Array.from(mateSets.values()).flatMap((s) => Array.from(s))
  const uniqueMateIds = Array.from(new Set(allMateIds))

  const mateResponsesMap = new Map<string, { userId: string | null; answers: Record<string, unknown> }>()
  if (uniqueMateIds.length > 0) {
    const { data: mateRows } = await admin
      .from('form_responses')
      .select('id, user_id, answers')
      .in('id', uniqueMateIds)

    for (const row of mateRows || []) {
      mateResponsesMap.set(row.id, {
        userId: row.user_id ?? null,
        answers: (row.answers || {}) as Record<string, unknown>,
      })
    }
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
        userId: mateRow?.userId ?? null,
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

  return (
    <SessionDetailShell
      postingId={posting_id}
      sessionDate={session_date}
      rounds={rounds}
      reportedSet={Array.from(reportedSet)}
      praisedSet={Array.from(praisedSet)}
      facilityReportSubmitted={facilityReportSubmitted}
    />
  )
}
