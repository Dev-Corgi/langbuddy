export type AppCategory = '언어교환' | '번개'

export type ApplicationRow = {
  id: string
  form_id: string
  created_at: string
  answers: Record<string, unknown>
  category: AppCategory
  label: string
  eventDate: string
  /** 신청 상세·입장 QR (`/apply/complete?id=…`) */
  applicationHref: string
  /** 모임 소개 페이지 (`/posting/language` 등), 선택 */
  meetupHref?: string
}

export type SeatingMemory = {
  key: string
  posting_id: string
  session_date: string | null
  round: number
  table_label: string
  dayLabel: string
  mateNames: string[]
}

export type SeatingSession = {
  posting_id: string
  session_date: string
  dayLabel: string
  rounds: number[]
}

export function monthMatrix(year: number, month0: number): (number | null)[][] {
  const firstDow = new Date(year, month0, 1).getDay()
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  while (cells.length < 42) cells.push(null)
  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}
