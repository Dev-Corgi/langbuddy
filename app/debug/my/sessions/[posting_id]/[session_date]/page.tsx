'use client'

import { use } from 'react'
import { SessionDetailShell } from '@/app/my/sessions/[posting_id]/[session_date]/_components/session-detail-shell'
import { DEBUG_BASE_PATH } from '@/lib/debug/debug-base-path'
import { buildMockSessionRounds } from '@/lib/debug/mock-data'

export default function DebugSessionDetailPage({
  params,
}: {
  params: Promise<{ posting_id: string; session_date: string }>
}) {
  const { posting_id, session_date } = use(params)

  return (
    <SessionDetailShell
      postingId={posting_id}
      sessionDate={session_date}
      rounds={buildMockSessionRounds()}
      reportedSet={[]}
      praisedSet={[]}
      backHref={`${DEBUG_BASE_PATH}/my`}
      mockReport
      mockPraise
      mockFacilityReport
    />
  )
}
