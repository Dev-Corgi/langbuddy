/**
 * 반복 모임의 "다음 한 번의 일정" 날짜 (Asia/Seoul 기준) — 요일 문자(월~일)와 일치하는 가장 빠른 날.
 * 오늘이 해당 요일이면 오늘 날짜를 사용합니다.
 *
 * 요일 매칭은 ko-KR narrow 대신 en-US short(항상 Sun…Sat)로 두고 '월'…'일'로 치환한다.
 * (런타임/ICU에 따라 narrow가 한 글자가 아니면 이전 구현은 매칭 실패 → 잘못된 고정 날짜로 이어질 수 있음)
 */
const WEEKDAY_SHORT_EN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  weekday: 'short',
})

const KO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const EN_SHORT_TO_KO: Record<string, string> = {
  Sun: '일',
  Mon: '월',
  Tue: '화',
  Wed: '수',
  Thu: '목',
  Fri: '금',
  Sat: '토',
}

function koreanWeekdayFromInstant(d: Date): string {
  const key = WEEKDAY_SHORT_EN.format(d)
  const ko = EN_SHORT_TO_KO[key]
  if (!ko) {
    throw new Error(`Unexpected weekday short "${key}" for ${d.toISOString()}`)
  }
  return ko
}

/** 서울 달력 기준 "오늘"의 요일 한 글자 (월~일) */
export function koreanWeekdayLetterSeoul(from: Date = new Date()): string {
  return koreanWeekdayFromInstant(from)
}

/** 오늘 날짜 YYYY-MM-DD (서울) */
export function todayYYYYMMDDSeoul(from: Date = new Date()): string {
  return KO_DATE.format(from)
}

/** 반복 모임 신청 응답이 "오늘 운영 중인 회차"와 맞는지 (자리배치·QR 스캐너와 동일 규칙) */
export function formResponseMatchesTodaySession(
  answers: Record<string, unknown> | null | undefined,
  todayYmdSeoul: string,
  currentDayKoLetter: string
): boolean {
  const ans = (answers || {}) as Record<string, unknown>
  const ev = typeof ans._event_date === 'string' ? ans._event_date.slice(0, 10) : ''
  const sel = typeof ans._selected_day === 'string' ? ans._selected_day.trim() : ''
  if (ev === todayYmdSeoul) return true
  if (!ev && sel === currentDayKoLetter) return true
  return false
}

/** YYYY-MM-DD 한 장(서울 달력)의 요일 글자(월~일). 날짜 경계는 정오 서울 앵커 사용. */
export function koreanWeekdayLetterFromYmdSeoul(isoYmd: string): string | null {
  if (!isoYmd || isoYmd.length < 10) return null
  const y = Number(isoYmd.slice(0, 4))
  const m = Number(isoYmd.slice(5, 7))
  const d = Number(isoYmd.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const noonSeoulUtc = Date.UTC(y, m - 1, d, 3, 0, 0)
  return koreanWeekdayFromInstant(new Date(noonSeoulUtc))
}

/**
 * 마이페이지·완료 화면용: 저장된 _event_date가 _selected_day와 맞지 않으면
 * 신청 시각(created_at)이 속한 일요일 시작 주에 대해 요일 날짜를 다시 계산한다.
 */
export function resolveApplicationSessionYmd(
  selectedDayKo: unknown,
  storedEventYmd: unknown,
  submittedAtIso: string
): string {
  const created = (typeof submittedAtIso === 'string' && submittedAtIso.length >= 10
    ? submittedAtIso.slice(0, 10)
    : null) || todayYYYYMMDDSeoul()
  const day = typeof selectedDayKo === 'string' ? selectedDayKo.trim() : ''
  const valid = ['월', '화', '수', '목', '금', '토', '일']
  const stored =
    typeof storedEventYmd === 'string' && storedEventYmd.length >= 10
      ? storedEventYmd.slice(0, 10)
      : ''

  if (day && valid.includes(day)) {
    if (stored) {
      const letter = koreanWeekdayLetterFromYmdSeoul(stored)
      if (letter === day) return stored
    }
    try {
      const anchor = new Date(
        typeof submittedAtIso === 'string' && submittedAtIso.length ? submittedAtIso : Date.now()
      )
      return isoDateForKoreanWeekdayInSunWeekSeoul(day, anchor)
    } catch {
      /* use stored or created */
    }
  }

  if (stored) return stored
  return created
}

const KO_WEEKDAY_LETTERS = new Set(['월', '화', '수', '목', '금', '토', '일'])

/** YYYY-MM-DD → 서울 달력 그날 정오 앵커 UTC Date (formatSessionDateLabel 등과 동일) */
export function dateAnchorFromIsoYmdSeoul(isoYmd: string): Date | null {
  if (!isoYmd || isoYmd.length < 10) return null
  const y = Number(isoYmd.slice(0, 4))
  const m = Number(isoYmd.slice(5, 7))
  const d = Number(isoYmd.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0))
}

/**
 * 신청 건별 표시용 제목: `forms.title` 대신 해당 회차 YYYY-MM-DD·요일로
 * `buildAutoRecurringFormTitles`와 동일 규칙을 쓴다.
 * `_selected_day`와 `_event_date`(또는 resolve 결과)가 맞지 않으면 null → DB 제목 등 폴백.
 */
export function buildRecurringSessionDisplayTitles(
  selectedDayKo: unknown,
  sessionIsoYmd: string,
  kind: 'language' | 'study'
): { title: string; title_en: string } | null {
  const day = typeof selectedDayKo === 'string' ? selectedDayKo.trim() : ''
  const ymd = sessionIsoYmd.slice(0, 10)
  if (ymd.length !== 10 || !KO_WEEKDAY_LETTERS.has(day)) return null
  const anchor = dateAnchorFromIsoYmdSeoul(ymd)
  if (!anchor) return null
  let computed: string
  try {
    computed = isoDateForKoreanWeekdayInSunWeekSeoul(day, anchor)
  } catch {
    return null
  }
  if (computed !== ymd) return null
  return buildAutoRecurringFormTitles(day, kind, anchor)
}

/**
 * 관리자 요일 탭 기준: 이번 주(일요일 시작)·서울 해당 요일의 날짜로 폼 제목 자동 생성.
 * 예: title_en `5/14(Thursday) - Language Exchange`, title `5/14(목) - 언어교환`
 */
export function buildAutoRecurringFormTitles(
  dayKo: string,
  kind: 'language' | 'study',
  from: Date = new Date()
): { title: string; title_en: string } {
  const ymd = isoDateForKoreanWeekdayInSunWeekSeoul(dayKo.trim(), from)
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  const noonSeoulUtc = Date.UTC(y, m - 1, d, 3, 0, 0)
  const inst = new Date(noonSeoulUtc)
  const wdEn = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'long',
  }).format(inst)
  const wdKo = koreanWeekdayLetterFromYmdSeoul(ymd) || dayKo.trim()
  const md = `${m}/${d}`
  const typeEn = kind === 'language' ? 'Language Exchange' : 'Study'
  const typeKo = kind === 'language' ? '언어교환' : '스터디'
  return {
    title: `${md}(${wdKo}) - ${typeKo}`,
    title_en: `${md}(${wdEn}) - ${typeEn}`,
  }
}

/** YYYY-MM-DD를 서울 기준으로 사용자에게 보여 줄 한 줄 라벨 (신청 화면 등) */
export function formatSessionDateLabel(isoYmd: string, locale: 'ko' | 'en'): string {
  if (!isoYmd || isoYmd.length < 10) return ''
  const y = Number(isoYmd.slice(0, 4))
  const m = Number(isoYmd.slice(5, 7))
  const d = Number(isoYmd.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ''
  const noonSeoulUtc = Date.UTC(y, m - 1, d, 3, 0, 0)
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    weekday: locale === 'en' ? 'long' : 'short',
  }).format(new Date(noonSeoulUtc))
}

export function nextSessionIsoDateForKoreanWeekday(weekdayKo: string): string {
  const want = weekdayKo.trim()
  const valid = ['월', '화', '수', '목', '금', '토', '일']
  if (!valid.includes(want)) {
    throw new Error(`Invalid weekday: ${weekdayKo}`)
  }

  const start = Date.now()
  for (let i = 0; i < 14; i++) {
    const d = new Date(start + i * 24 * 60 * 60 * 1000)
    if (koreanWeekdayFromInstant(d) === want) {
      return KO_DATE.format(d)
    }
  }
  return KO_DATE.format(new Date(start))
}

/** 일~토 순서 (일요일 시작 주) */
const SUN_START_WEEK_KO: readonly string[] = ['일', '월', '화', '수', '목', '금', '토']

function addDaysToSeoulYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`Invalid YYYY-MM-DD: ${ymd}`)
  }
  const utcMs = Date.UTC(y, m - 1, d, 3, 0, 0) + deltaDays * 86_400_000
  return KO_DATE.format(new Date(utcMs))
}

/**
 * 서울 기준 "일요일 시작" 한 주 안에서, 해당 한글 요일(월~일)이 가리키는 회차 날짜.
 * (오늘이 그 주의 며칠인지에 따라 같은 요일이라도 날짜가 고정됨.)
 */
export function isoDateForKoreanWeekdayInSunWeekSeoul(weekdayKo: string, from: Date = new Date()): string {
  const want = weekdayKo.trim()
  const wantIdx = SUN_START_WEEK_KO.indexOf(want)
  if (wantIdx < 0) {
    throw new Error(`Invalid weekday: ${weekdayKo}`)
  }
  const todayYmd = todayYYYYMMDDSeoul(from)
  const letterToday = koreanWeekdayLetterSeoul(from)
  const todayIdx = SUN_START_WEEK_KO.indexOf(letterToday)
  if (todayIdx < 0) {
    throw new Error(`Unexpected weekday letter: ${letterToday}`)
  }
  const sundayYmd = addDaysToSeoulYmd(todayYmd, -todayIdx)
  return addDaysToSeoulYmd(sundayYmd, wantIdx)
}

/** 서울 달력 기준 그 날의 0시부터 분 수 (0~1439). */
export function seoulMinutesSinceMidnight(from: Date = new Date()): number {
  const str = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(from)
  const [h, min] = str.split(':').map((x) => Number(x))
  return h * 60 + min
}

/** 신청 폼 당일 마감 (서울) — 기본 21:00 */
export const RECURRING_APPLY_CUTOFF_MINUTES_SEOUL = 21 * 60

/**
 * 반복 모임: 이번 주(일 시작)·서울 기준으로 아직 신청 가능한 요일만 남김.
 * - 날짜가 오늘보다 이전이면 제외
 * - 오늘인데 서울 시각이 cutoff 분 이상이면 제외
 * @param cutoffMinutesSinceMidnightSeoul 기본 21:00 (= 1260)
 */
export function filterSelectableRecurringDaysSeoul(
  activeDayLetters: string[],
  from: Date = new Date(),
  cutoffMinutesSinceMidnightSeoul: number = RECURRING_APPLY_CUTOFF_MINUTES_SEOUL
): string[] {
  const todayYmd = todayYYYYMMDDSeoul(from)
  const nowMin = seoulMinutesSinceMidnight(from)
  const dayOrder = ['월', '화', '수', '목', '금', '토', '일']
  const uniq = [...new Set(activeDayLetters.map((d) => d.trim()).filter(Boolean))]
  const filtered = uniq.filter((day) => {
    let sessionYmd: string
    try {
      sessionYmd = isoDateForKoreanWeekdayInSunWeekSeoul(day, from)
    } catch {
      return false
    }
    if (sessionYmd < todayYmd) return false
    if (sessionYmd > todayYmd) return true
    return nowMin < cutoffMinutesSinceMidnightSeoul
  })
  return filtered.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
}
