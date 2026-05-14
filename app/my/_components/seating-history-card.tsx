import { Users } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { SeatingMemory } from '../_lib/types'

type Props = {
  title: string
  emptyMessage: string
  roundLabel: string
  tableLabel: string
  withLabel: string
  history: SeatingMemory[]
  isEn: boolean
}

export function SeatingHistoryCard({
  title,
  emptyMessage,
  roundLabel,
  tableLabel,
  withLabel,
  history,
  isEn,
}: Props) {
  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Users className="size-5 text-primary" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>
          {history.length > 0
            ? isEn
              ? 'Past table assignments from language exchange.'
              : '언어교환 참여 시 저장된 테이블 배치 기록입니다.'
            : isEn
              ? 'No saved seating yet.'
              : '저장된 배치가 없습니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {history.length === 0 ? (
          <p className="py-2 text-sm leading-relaxed text-muted-foreground">{emptyMessage}</p>
        ) : (
          history.map((h, idx) => (
            <div key={h.key}>
              {idx > 0 ? <Separator className="my-4" /> : null}
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{h.session_date}</span>
                  {h.dayLabel ? (
                    <span className="text-xs font-medium text-muted-foreground">
                      {h.dayLabel}
                      {!isEn ? '요일' : ''}
                    </span>
                  ) : null}
                  <Badge variant="outline" className="font-semibold">
                    {roundLabel} {h.round}
                  </Badge>
                  <Badge variant="secondary" className="font-semibold">
                    {tableLabel} {h.table_label}
                  </Badge>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {withLabel}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {h.mateNames.length
                      ? h.mateNames.join(', ')
                      : isEn
                        ? '—'
                        : '(같은 테이블 인원 정보 없음)'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
