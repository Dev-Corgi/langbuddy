import Link from 'next/link'
import { Users, ChevronRight } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { SeatingSession } from '../_lib/types'

type Props = {
  title: string
  emptyMessage: string
  seatingDetail: string
  roundLabel: string
  sessions: SeatingSession[]
  isEn: boolean
  /** e.g. `/debug` — prefixes session detail links */
  hrefBase?: string
}

export function SeatingHistoryCard({
  title,
  emptyMessage,
  seatingDetail,
  roundLabel,
  sessions,
  isEn,
  hrefBase = '',
}: Props) {
  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Users className="size-5 text-primary" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>
          {sessions.length > 0
            ? isEn
              ? 'Language exchange sessions from the last 2 months. Click a session to see your tablemates.'
              : '최근 2개월간 참여한 언어교환 목록입니다. 세션을 클릭하면 같은 테이블 참가자를 확인할 수 있어요.'
            : isEn
              ? 'No saved seating yet.'
              : '저장된 배치가 없습니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {sessions.length === 0 ? (
          <p className="py-2 text-sm leading-relaxed text-muted-foreground">{emptyMessage}</p>
        ) : (
          sessions.map((s, idx) => (
            <div key={`${s.posting_id}|${s.session_date}`}>
              {idx > 0 ? <Separator className="my-3" /> : null}
              <Link
                href={`${hrefBase}/my/sessions/${s.posting_id}/${s.session_date}`}
                className="group flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-4 transition-colors hover:bg-muted/50"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {s.session_date}
                    </span>
                    {s.dayLabel ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        {s.dayLabel}
                        {!isEn ? '요일' : ''}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.rounds.sort((a, b) => a - b).map((r) => (
                      <Badge key={r} variant="outline" className="text-xs font-semibold">
                        {roundLabel} {r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-primary opacity-70 group-hover:opacity-100 transition-opacity">
                  {seatingDetail}
                  <ChevronRight className="size-4" />
                </div>
              </Link>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
