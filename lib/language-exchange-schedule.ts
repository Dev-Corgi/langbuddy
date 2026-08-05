export type LeScheduleInfo = {
  dayOfWeek: string
  time: string
  location: string
}

export const KOREAN_WEEKDAY_ORDER = ['월', '화', '수', '목', '금', '토', '일'] as const

export function sortKoreanWeekdays(days: string[]): string[] {
  return [...days].sort(
    (a, b) => KOREAN_WEEKDAY_ORDER.indexOf(a as (typeof KOREAN_WEEKDAY_ORDER)[number]) -
      KOREAN_WEEKDAY_ORDER.indexOf(b as (typeof KOREAN_WEEKDAY_ORDER)[number])
  )
}

export function buildSchedulesByDay(
  schedules: Array<{
    day_of_week: string
    time?: string | null
    location?: string | null
  }>
): Record<string, LeScheduleInfo> {
  const map: Record<string, LeScheduleInfo> = {}
  for (const row of schedules) {
    if (!row.day_of_week) continue
    map[row.day_of_week] = {
      dayOfWeek: row.day_of_week,
      time: row.time?.trim() || '',
      location: row.location?.trim() || '',
    }
  }
  return map
}

/** "19:00" → locale-aware display (e.g. 오후 7:00 / 7:00 PM) */
export function formatScheduleTime(time: string, locale: 'ko' | 'en'): string {
  if (!time) return '—'
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  if (!match) return time
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time

  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: locale === 'en',
  })
}

export function formatDayLabel(day: string, locale: 'ko' | 'en'): string {
  if (locale === 'en') {
    const map: Record<string, string> = {
      월: 'Mon',
      화: 'Tue',
      수: 'Wed',
      목: 'Thu',
      금: 'Fri',
      토: 'Sat',
      일: 'Sun',
    }
    return map[day] || day
  }
  return `${day}요일`
}
