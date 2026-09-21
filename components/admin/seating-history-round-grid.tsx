'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTableWarnings } from '@/lib/seating-algorithm'
import {
  getHistoryTableLabels,
  getHistoryTableParticipants,
  type HistoryParticipant,
  type HistoryRoundView,
} from '@/lib/seating-history-view'

function LanguageBadge({ language }: { language: string }) {
  return (
    <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-2 py-1 rounded flex items-center gap-1 shrink-0">
      {language === '영어' ? (
        <svg className="w-3 h-3" viewBox="0 0 20 14" fill="none">
          <rect width="20" height="14" fill="#B22234" />
          <rect y="1.08" width="20" height="1.08" fill="white" />
          <rect y="3.23" width="20" height="1.08" fill="white" />
          <rect y="5.38" width="20" height="1.08" fill="white" />
          <rect y="7.54" width="20" height="1.08" fill="white" />
          <rect y="9.69" width="20" height="1.08" fill="white" />
          <rect y="11.85" width="20" height="1.08" fill="white" />
          <rect width="8" height="7.54" fill="#3C3B6E" />
        </svg>
      ) : language === '일본어' ? (
        <svg className="w-3 h-3" viewBox="0 0 20 14" fill="none">
          <rect width="20" height="14" fill="white" />
          <circle cx="10" cy="7" r="3.5" fill="#BC002D" />
        </svg>
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )}
      {language}
    </span>
  )
}

function HistoryParticipantCard({
  participant,
  onSelect,
}: {
  participant: HistoryParticipant
  onSelect: (participant: HistoryParticipant) => void
}) {
  const isForeigner = participant.nationality === '외국인'
  const isFemale = participant.gender === '여'
  const checkedIn = Boolean(participant.checked_in_at)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(participant)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(participant)
        }
      }}
      className={cn(
        'flex items-center justify-between p-3 mb-2 rounded-xl border bg-card shadow-sm overflow-hidden relative cursor-pointer transition-colors',
        'border-border hover:border-primary/30 hover:bg-primary/5',
        !checkedIn ? 'border-dashed border-amber-300/70 bg-amber-50/20' : '',
        isForeigner ? 'bg-blue-50/40' : 'bg-emerald-50/40'
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1.5', isForeigner ? 'bg-blue-500' : 'bg-emerald-500')} />
      <div className="min-w-0 flex-1 pl-2">
        <p className="font-bold text-sm truncate">{participant.name}</p>
        <div className="flex gap-1 mt-0.5 items-center flex-wrap">
          <span
            className={cn(
              'text-[10px] font-black px-1.5 py-0.5 rounded tracking-tighter',
              isForeigner ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
            )}
          >
            {participant.nationality}
          </span>
          <span
            className={cn(
              'text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter',
              isFemale ? 'bg-pink-100 text-pink-600' : 'bg-sky-100 text-sky-700'
            )}
          >
            {participant.gender}
          </span>
          <LanguageBadge language={participant.language} />
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {!checkedIn ? (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
            미체크인
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(participant)
          }}
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  )
}

function HistoryTableCard({
  label,
  tableLanguage,
  participants,
  onSelectParticipant,
}: {
  label: string
  tableLanguage?: string
  participants: HistoryParticipant[]
  onSelectParticipant: (participant: HistoryParticipant) => void
}) {
  const warnings = getTableWarnings(participants)

  return (
    <Card className="border-none shadow-md bg-muted/20 rounded-[24px] overflow-hidden flex flex-col h-full">
      <CardHeader className="p-4 bg-card border-b flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between w-full">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-lg font-black truncate">{label} Table</CardTitle>
            {tableLanguage ? <LanguageBadge language={tableLanguage} /> : null}
          </div>
          <span className="text-xs font-bold text-muted-foreground shrink-0">{participants.length} 명</span>
        </div>
        {warnings.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {warnings.map((w) => (
              <span
                key={w}
                className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200"
              >
                {w}
              </span>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="p-3 flex-1 min-h-[100px]">
        {participants.length === 0 ? (
          <p className="text-xs font-bold text-muted-foreground text-center py-6">참가자 없음</p>
        ) : (
          participants.map((p) => (
            <HistoryParticipantCard key={p.id} participant={p} onSelect={onSelectParticipant} />
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function SeatingHistoryRoundGrid({
  view,
  isEn,
  onSelectParticipant,
}: {
  view: HistoryRoundView
  isEn: boolean
  onSelectParticipant: (participant: HistoryParticipant) => void
}) {
  const tableLabels = getHistoryTableLabels(view.roundData)

  if (tableLabels.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-border bg-card py-16 text-center">
        <p className="text-sm font-bold text-muted-foreground">
          {isEn ? 'No seating data for this round.' : '이 라운드에 배정된 테이블이 없습니다.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-lg font-black">
          {view.stats.total}
          {isEn ? ' participants' : '명'}
        </Badge>
        <Badge className="rounded-lg font-black bg-emerald-500/15 text-emerald-700 border-0">
          {isEn ? 'Checked in' : '체크인'} {view.stats.checkedIn}
        </Badge>
        <Badge className="rounded-lg font-black bg-primary/10 text-primary border-0">
          {view.stats.tableCount}
          {isEn ? ' tables' : '개 테이블'}
        </Badge>
        <Badge
          className={cn(
            'rounded-lg font-black border-0',
            view.source === 'live'
              ? 'bg-emerald-500/15 text-emerald-700'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {view.source === 'live'
            ? isEn
              ? 'Current week'
              : '현재 주'
            : isEn
              ? 'Archive'
              : '아카이브'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {tableLabels.map((label) => {
          const tableParticipants = getHistoryTableParticipants(
            view.roundData,
            label,
            view.participants
          )
          return (
            <HistoryTableCard
              key={label}
              label={label}
              tableLanguage={view.roundData.tableLanguages?.[label]}
              participants={tableParticipants}
              onSelectParticipant={onSelectParticipant}
            />
          )
        })}
      </div>
    </div>
  )
}
