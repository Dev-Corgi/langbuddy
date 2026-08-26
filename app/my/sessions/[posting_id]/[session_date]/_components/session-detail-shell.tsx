'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, Flag, Heart, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { MainNav } from '@/app/_components/main-nav'
import { useLocale } from '@/hooks/use-locale'
import type { SessionRound, SessionParticipant } from '../page'
import { ReportModal } from './report-modal'
import { PraiseModal } from './praise-modal'
import { FacilityReportModal } from './facility-report-modal'

type Props = {
  postingId: string
  sessionDate: string
  rounds: SessionRound[]
  reportedSet: string[] // `${round}|${reported_user_id}`
  praisedSet?: string[] // `${round}|${praised_user_id}`
  facilityReportSubmitted?: boolean
  backHref?: string
  mockReport?: boolean
  mockPraise?: boolean
  mockFacilityReport?: boolean
}

export function SessionDetailShell({
  postingId,
  sessionDate,
  rounds,
  reportedSet,
  praisedSet = [],
  facilityReportSubmitted = false,
  backHref = '/my',
  mockReport = false,
  mockPraise = false,
  mockFacilityReport = false,
}: Props) {
  const locale = useLocale()
  const isEn = locale === 'en'

  const [reportTarget, setReportTarget] = useState<{
    userId: string
    name: string
    round: number
  } | null>(null)
  const [praiseTarget, setPraiseTarget] = useState<{
    userId: string
    name: string
    round: number
  } | null>(null)
  const [extraReported, setExtraReported] = useState<string[]>([])
  const [extraPraised, setExtraPraised] = useState<string[]>([])
  const [facilitySubmitted, setFacilitySubmitted] = useState(facilityReportSubmitted)
  const [showFacilityModal, setShowFacilityModal] = useState(false)

  const reportedSetObj = new Set([...reportedSet, ...extraReported])
  const praisedSetObj = new Set([...praisedSet, ...extraPraised])

  const handleReport = (mate: SessionParticipant, round: number) => {
    if (!mate.userId) return
    setReportTarget({
      userId: mate.userId,
      name: mate.name,
      round,
    })
  }

  const handlePraise = (mate: SessionParticipant, round: number) => {
    if (!mate.userId) return
    setPraiseTarget({
      userId: mate.userId,
      name: mate.name,
      round,
    })
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-12">
      <MainNav />
      <main className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-12">
        {/* 뒤로 가기 */}
        <Link
          href={backHref}
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
                          const alreadyReported = !!mate.userId && reportedSetObj.has(`${r.round}|${mate.userId}`)
                          const alreadyPraised = !!mate.userId && praisedSetObj.has(`${r.round}|${mate.userId}`)
                          const canAct = !!mate.userId
                          return (
                            <div
                              key={mate.responseId}
                              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
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
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={alreadyPraised || !canAct}
                                  title={
                                    !canAct && !alreadyPraised
                                      ? isEn
                                        ? 'This participant cannot be identified (older archive or missing ID).'
                                        : '칭찬 대상을 식별할 수 없습니다. (오래된 아카이브이거나 ID가 없는 참가자)'
                                      : undefined
                                  }
                                  onClick={() => handlePraise(mate, r.round)}
                                  className={
                                    alreadyPraised
                                      ? 'text-muted-foreground cursor-default text-xs'
                                      : 'text-primary hover:text-primary hover:bg-primary/10 text-xs'
                                  }
                                >
                                  <Heart className="size-3.5 mr-1" />
                                  {alreadyPraised
                                    ? isEn ? 'Praised' : '칭찬함'
                                    : isEn ? 'Praise' : '칭찬'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={alreadyReported || !canAct}
                                  title={
                                    !canAct && !alreadyReported
                                      ? isEn
                                        ? 'This participant cannot be identified for reporting (older archive or missing ID).'
                                        : '신고 대상을 식별할 수 없습니다. (오래된 아카이브이거나 ID가 없는 참가자)'
                                      : undefined
                                  }
                                  onClick={() => handleReport(mate, r.round)}
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

        <Separator className="my-8" />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <span className="text-base font-bold text-foreground">
              {isEn ? 'Venue & facility' : '장소·시설 불편 신고'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">
                {isEn ? (
                  <>
                    If you had any issues with the venue or facilities,
                    <br />
                    please share your feedback!
                  </>
                ) : (
                  <>
                    장소나 시설 관련 불편사항이 있었다면
                    <br />
                    피드백을 주세요!
                  </>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={facilitySubmitted}
              onClick={() => setShowFacilityModal(true)}
              className={
                facilitySubmitted
                  ? 'shrink-0 text-xs text-muted-foreground cursor-default'
                  : 'shrink-0 text-xs text-destructive hover:text-destructive hover:bg-destructive/10'
              }
            >
              <Flag className="size-3.5 mr-1" />
              {facilitySubmitted
                ? isEn ? 'Submitted' : '접수됨'
                : isEn ? 'Report' : '신고'}
            </Button>
          </div>
        </div>
      </main>

      <FacilityReportModal
        open={showFacilityModal}
        onClose={() => setShowFacilityModal(false)}
        postingId={postingId}
        sessionDate={sessionDate}
        isEn={isEn}
        mockMode={mockFacilityReport}
        onSuccess={() => {
          setFacilitySubmitted(true)
          setShowFacilityModal(false)
        }}
      />

      {praiseTarget && (
        <PraiseModal
          open={!!praiseTarget}
          onClose={() => setPraiseTarget(null)}
          praisedUserId={praiseTarget.userId}
          praisedName={praiseTarget.name}
          postingId={postingId}
          sessionDate={sessionDate}
          round={praiseTarget.round}
          isEn={isEn}
          mockMode={mockPraise}
          onSuccess={() => {
            setExtraPraised((prev) => [
              ...prev,
              `${praiseTarget.round}|${praiseTarget.userId}`,
            ])
            setPraiseTarget(null)
          }}
        />
      )}

      {reportTarget && (
        <ReportModal
          open={!!reportTarget}
          onClose={() => setReportTarget(null)}
          reportedUserId={reportTarget.userId}
          reportedName={reportTarget.name}
          postingId={postingId}
          sessionDate={sessionDate}
          round={reportTarget.round}
          isEn={isEn}
          mockMode={mockReport}
          onSuccess={() => {
            setExtraReported((prev) => [
              ...prev,
              `${reportTarget.round}|${reportTarget.userId}`,
            ])
            setReportTarget(null)
          }}
        />
      )}
    </div>
  )
}
