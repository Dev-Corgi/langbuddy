'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { todayYYYYMMDDSeoul } from '@/lib/session-event-date'
import { monthMatrix } from '../_lib/types'

type Props = {
  title: string
  prevLabel: string
  nextLabel: string
  weekLabels: string[]
  markedDates: Set<string>
  isEn: boolean
}

export function ScheduleCalendarCard({ title, prevLabel, nextLabel, weekLabels, markedDates, isEn }: Props) {
  const [calYear, setCalYear] = useState(() => {
    const ymd = todayYYYYMMDDSeoul()
    return Number(ymd.slice(0, 4))
  })
  const [calMonth, setCalMonth] = useState(() => {
    const ymd = todayYYYYMMDDSeoul()
    return Number(ymd.slice(5, 7)) - 1
  })

  const calMatrix = useMemo(() => monthMatrix(calYear, calMonth), [calYear, calMonth])
  const monthLabel = useMemo(() => {
    const d = new Date(calYear, calMonth, 1)
    return d.toLocaleDateString(isEn ? 'en-US' : 'ko-KR', { month: 'long', year: 'numeric' })
  }, [calYear, calMonth, isEn])

  return (
    <Card className="h-full border-border/80">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <CalendarDays className="size-5 text-primary" aria-hidden />
            {title}
          </CardTitle>
          <CardDescription>
            {isEn ? 'Dates with an application are highlighted.' : '신청이 있는 날짜가 강조됩니다.'}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-lg"
            onClick={() => {
              const nm = calMonth - 1
              if (nm < 0) {
                setCalMonth(11)
                setCalYear((y) => y - 1)
              } else setCalMonth(nm)
            }}
            aria-label={prevLabel}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold">{monthLabel}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-lg"
            onClick={() => {
              const nm = calMonth + 1
              if (nm > 11) {
                setCalMonth(0)
                setCalYear((y) => y + 1)
              } else setCalMonth(nm)
            }}
            aria-label={nextLabel}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
          {weekLabels.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        {calMatrix.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              if (day === null) return <div key={di} className="h-9" />
              const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const hit = markedDates.has(ds)
              return (
                <div
                  key={di}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-md text-sm font-medium',
                    hit
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-foreground'
                  )}
                >
                  {day}
                </div>
              )
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
