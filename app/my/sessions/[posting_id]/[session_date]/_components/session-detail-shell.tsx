'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Flag, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { MainNav } from '@/app/_components/main-nav'
import { useLocale } from '@/hooks/use-locale'
import type { SessionRound, SessionParticipant } from '../page'
import { ReportModal } from './report-modal'

type Props = {
  postingId: string
  sessionDate: string
  rounds: SessionRound[]
  myResponseIdByRound: Record<number, string>
  reportedSet: string[] // `${round}|${reported_response_id}`
}

export function SessionDetailShell({
  postingId,
  sessionDate,
  rounds,
  myResponseIdByRound,
  reportedSet,
}: Props) {
  const locale = useLocale()
  const isEn = locale === 'en'

  const [reportTarget, setReportTarget] = useState<{
    responseId: string
    name: string
    round: number
    reporterResponseId: string
  } | null>(null)
  const [extraReported, setExtraReported] = useState<string[]>([])

  const reportedSetObj = new Set([...reportedSet, ...extraReported])

  const handleReport = (mate: SessionParticipant, round: number, reporterResponseId: string) => {
    setReportTarget({
      responseId: mate.responseId,
      name: mate.name,
      round,
      reporterResponseId,
    })
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-12">
      <MainNav />
      <main className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-12">
        {/* 뒤로 가기 */}
        <Link
          href="/my"
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          {isEn ? 'Back to My Page' : '마이페이지로 돌아가기'}
        </Link>

        {/* 헤더 */}
        <div className="mb-8 space-y-1">
          <h1 className="text-2xl font-black text-foreground">
            {isEn ? 'Session Detail' : '세션 상세 기록'}
          </h1>
          <p className="text-sm text-muted-foreground tabular-nums">{sessionDate}</p>
        </div>

        {rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {isEn ? 'No tablemate data available for this session.' : '이 세션의 동석자 정보가 없습니다.'}
          </p>
        ) : (
          <div className="space-y-6">
            {rounds.map((r, idx) => {
              const reporterResponseId = myResponseIdByRound[r.round]
              return (
                <div key={r.round}>
                  {idx > 0 && <Separator className="mb-6" />}
                  <div className="space-y-3">
                    {/* 라운드 헤더 */}
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-primary" />
                      <span className="text-base font-bold text-foreground">
                        {isEn ? `Round ${r.round}` : `${r.round}라운드`}
                      </span>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {isEn ? 'Table' : '테이블'} {r.tableLabel}
                      </Badge>
                    </div>

                    {/* 동석자 목록 */}
                    {r.mates.length === 0 ? (
                      <p className="text-sm text-muted-foreground pl-6">
                        {isEn ? 'No tablemates recorded.' : '기록된 동석자가 없습니다.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {r.mates.map((mate) => {
                          const alreadyReported = reportedSetObj.has(`${r.round}|${mate.responseId}`)
                          return (
                            <div
                              key={mate.responseId}
                              className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">{mate.name}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {mate.nationality && (
                                    <Badge variant="outline" className="text-xs">
                                      {mate.nationality}
                                    </Badge>
                                  )}
                                  {mate.language && (
                                    <Badge variant="outline" className="text-xs">
                                      {mate.language}
                                    </Badge>
                                  )}
                                  {mate.gender && (
                                    <Badge variant="outline" className="text-xs">
                                      {mate.gender}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={alreadyReported || !reporterResponseId}
                                onClick={() => handleReport(mate, r.round, reporterResponseId)}
                                className={
                                  alreadyReported
                                    ? 'text-muted-foreground cursor-default text-xs'
                                    : 'text-destructive hover:text-destructive hover:bg-destructive/10 text-xs'
                                }
                              >
                                <Flag className="size-3.5 mr-1" />
                                {alreadyReported
                                  ? isEn ? 'Reported' : '신고됨'
                                  : isEn ? 'Report' : '신고'}
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {reportTarget && (
        <ReportModal
          open={!!reportTarget}
          onClose={() => setReportTarget(null)}
          reportedResponseId={reportTarget.responseId}
          reportedName={reportTarget.name}
          reporterResponseId={reportTarget.reporterResponseId}
          postingId={postingId}
          sessionDate={sessionDate}
          round={reportTarget.round}
          isEn={isEn}
          onSuccess={() => {
            setExtraReported((prev) => [
              ...prev,
              `${reportTarget.round}|${reportTarget.responseId}`,
            ])
            setReportTarget(null)
          }}
        />
      )}
    </div>
  )
}
