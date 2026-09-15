export type LeScheduleInfo = {
  dayOfWeek: string
  time: string
  location: string
  locationEn: string
  locationMapUrl: string
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
    location_en?: string | null
    location_map_url?: string | null
  }>
): Record<string, LeScheduleInfo> {
  const map: Record<string, LeScheduleInfo> = {}
  for (const row of schedules) {
    if (!row.day_of_week) continue
    map[row.day_of_week] = {
      dayOfWeek: row.day_of_week,
      time: row.time?.trim() || '',
      location: row.location?.trim() || '',
      locationEn: row.location_en?.trim() || '',
      locationMapUrl: row.location_map_url?.trim() || '',
    }
  }
  return map
}

/** locale에 맞는 장소 표시 (영어 UI는 location_en 우선, 없으면 location) */
export function getScheduleLocationLabel(
  schedule: Pick<LeScheduleInfo, 'location' | 'locationEn'>,
  locale: 'ko' | 'en'
): string {
  if (locale === 'en' && schedule.locationEn) return schedule.locationEn
  return schedule.location
}

/** 관리자 입력 URL 우선, 없으면 location/location_en 텍스트로 네이버 지도 검색 URL 생성 */
export function resolveLocationMapUrl(
  schedule: Pick<LeScheduleInfo, 'location' | 'locationEn' | 'locationMapUrl'>
): string | null {
  if (schedule.locationMapUrl) return schedule.locationMapUrl
  const searchText = schedule.location || schedule.locationEn
  if (searchText) {
    return `https://map.naver.com/v5/search/${encodeURIComponent(searchText)}`
  }
  return null
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

/** 짧은 요일 라벨 (히어로 등 공간 제약 UI용) — 수 / Wed */
export function formatDayShortLabel(day: string, locale: 'ko' | 'en'): string {
  if (locale === 'en') {
    return formatDayLabel(day, 'en')
  }
  return day
}

/** 같은 장소끼리 요일을 묶어 표시 (수·금 → 동일 장소) */
export type ScheduleVenueGroup = {
  days: string[]
  location: string
  locationEn: string
}

export function groupSchedulesByVenue(
  schedulesByDay: Record<string, LeScheduleInfo>
): ScheduleVenueGroup[] {
  const groups = new Map<string, ScheduleVenueGroup>()

  for (const day of sortKoreanWeekdays(Object.keys(schedulesByDay))) {
    const schedule = schedulesByDay[day]
    if (!schedule) continue
    const location = schedule.location.trim()
    const locationEn = schedule.locationEn.trim()
    if (!location && !locationEn) continue

    // 한국어 장소를 우선 키로 사용 (영문 표기 불일치 시에도 같은 장소로 묶임)
    const key = (location || locationEn).toLowerCase()
    const existing = groups.get(key)
    if (existing) {
      existing.days.push(day)
      if (!existing.location && location) existing.location = location
      if (!existing.locationEn && locationEn) existing.locationEn = locationEn
    } else {
      groups.set(key, { days: [day], location, locationEn })
    }
  }

  return Array.from(groups.values())
}

export function formatDayGroupLabel(days: string[], locale: 'ko' | 'en'): string {
  return sortKoreanWeekdays(days)
    .map((d) => formatDayShortLabel(d, locale))
    .join(', ')
}

export function getVenueGroupLocationLabel(
  group: Pick<ScheduleVenueGroup, 'location' | 'locationEn'>,
  locale: 'ko' | 'en'
): string {
  return getScheduleLocationLabel(
    { location: group.location, locationEn: group.locationEn },
    locale
  )
}
