'use client'

import { Clock, MapPin, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatDayLabel,
  formatScheduleTime,
  sortKoreanWeekdays,
  type LeScheduleInfo,
} from '@/lib/language-exchange-schedule'

type LanguageExchangeScheduleInfoProps = {
  schedulesByDay: Record<string, LeScheduleInfo>
  /** 표시할 요일 목록 (미지정 시 schedulesByDay 전체) */
  days?: string[]
  selectedDay?: string
  locale: 'ko' | 'en'
  /** 상세 페이지: 안내 카드 / 신청 폼: 클릭 가능한 요일 선택 */
  mode?: 'display' | 'picker'
  onSelectDay?: (day: string) => void
}

function ScheduleDayRow({
  day,
  schedule,
  locale,
  isSelected,
  mode,
  onSelect,
}: {
  day: string
  schedule: LeScheduleInfo | undefined
  locale: 'ko' | 'en'
  isSelected: boolean
  mode: 'display' | 'picker'
  onSelect?: () => void
}) {
  const en = locale === 'en'
  const className = cn(
    'flex w-full flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all',
    isSelected
      ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20'
      : 'border-border/70 bg-card',
    mode === 'picker' && !isSelected && 'hover:border-primary/40 hover:bg-primary/5 cursor-pointer',
    mode === 'picker' && isSelected && 'cursor-pointer'
  )

  const content = (
    <>
      <div className="flex items-center gap-3 min-w-[88px] shrink-0">
        <span
          className={cn(
            'inline-flex h-9 min-w-[52px] items-center justify-center rounded-xl px-2 text-sm font-black',
            isSelected ? 'bg-primary text-white' : 'bg-muted text-foreground'
          )}
        >
          {formatDayLabel(day, locale)}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-5 gap-y-1.5 text-sm font-bold text-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          {schedule?.time
            ? formatScheduleTime(schedule.time, locale)
            : en
              ? 'Time TBD'
              : '시간 미정'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          {schedule?.location || (en ? 'Location TBD' : '장소 미정')}
        </span>
      </div>
    </>
  )

  if (mode === 'picker') {
    return (
      <button type="button" onClick={onSelect} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

export function LanguageExchangeScheduleInfo({
  schedulesByDay,
  days,
  selectedDay,
  locale,
  mode = 'display',
  onSelectDay,
}: LanguageExchangeScheduleInfoProps) {
  const en = locale === 'en'
  const visibleDays = sortKoreanWeekdays(
    days?.length ? days : Object.keys(schedulesByDay)
  )

  if (visibleDays.length === 0) return null

  const dayRows = (
    <div className="space-y-2">
      {visibleDays.map((day) => (
        <ScheduleDayRow
          key={day}
          day={day}
          schedule={schedulesByDay[day]}
          locale={locale}
          isSelected={selectedDay === day}
          mode={mode}
          onSelect={mode === 'picker' ? () => onSelectDay?.(day) : undefined}
        />
      ))}
    </div>
  )

  if (mode === 'picker') {
    return dayRows
  }

  return (
    <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-5 md:p-6 space-y-4">
      <h2 className="text-base font-black text-foreground flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary shrink-0" />
        {en ? 'Schedule by day' : '요일별 일정 안내'}
      </h2>
      <p className="text-sm font-medium text-muted-foreground leading-relaxed">
        {en
          ? 'Time and location differ by day. Please check before selecting your meeting day.'
          : '요일마다 시간과 장소가 다릅니다. 참여 요일을 선택하기 전에 확인해 주세요.'}
      </p>
      {dayRows}
    </div>
  )
}
