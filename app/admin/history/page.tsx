'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, History, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useLocale } from '@/hooks/use-locale'
import { PageHeader } from '@/components/admin/page-header'
import { SeatingHistoryRoundGrid } from '@/components/admin/seating-history-round-grid'
import { HistoryParticipantModal } from '@/components/admin/history-participant-modal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { HistoryParticipant, HistoryRoundView } from '@/lib/seating-history-view'

type SessionSummary = {
  session_date: string
  archive_count: number
  live_count: number
  total_count: number
}

type SessionsResponse = {
  sessions: SessionSummary[]
  minDate: string | null
  maxDate: string | null
  totalRows: number
}

function parseYmd(ymd: string) {
  const [year = '', month = '', day = ''] = ymd.split('-')
  return { year, month, day }
}

function weekdayLabel(ymd: string, isEn: boolean) {
  const d = new Date(`${ymd}T00:00:00+09:00`)
  return d.toLocaleDateString(isEn ? 'en-US' : 'ko-KR', {
    weekday: 'short',
    timeZone: 'Asia/Seoul',
  })
}

function monthLabel(month: string, isEn: boolean) {
  const n = Number.parseInt(month, 10)
  if (isEn) {
    return new Date(2000, n - 1, 1).toLocaleDateString('en-US', { month: 'long' })
  }
  return `${n}월`
}

export default function AdminSeatingHistoryPage() {
  const locale = useLocale()
  const isEn = locale === 'en'
  const { ready } = useAdminAuth({ requireSuper: true })

  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sessionsData, setSessionsData] = useState<SessionsResponse | null>(null)
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedDay, setSelectedDay] = useState('')
  const [availableRounds, setAvailableRounds] = useState<number[]>([])
  const [currentRound, setCurrentRound] = useState('1')
  const [roundView, setRoundView] = useState<HistoryRoundView | null>(null)
  const [loadingRounds, setLoadingRounds] = useState(false)
  const [loadingView, setLoadingView] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<HistoryParticipant | null>(null)

  const sessionMap = useMemo(() => {
    const map = new Map<string, SessionSummary>()
    for (const s of sessionsData?.sessions ?? []) {
      map.set(s.session_date, s)
    }
    return map
  }, [sessionsData])

  const sessionDates = useMemo(
    () => (sessionsData?.sessions ?? []).map((s) => s.session_date).sort((a, b) => b.localeCompare(a)),
    [sessionsData]
  )

  const yearOptions = useMemo(() => {
    const years = new Set<string>()
    for (const ymd of sessionDates) {
      years.add(parseYmd(ymd).year)
    }
    return [...years].sort((a, b) => b.localeCompare(a))
  }, [sessionDates])

  const monthOptions = useMemo(() => {
    if (!selectedYear) return []
    const months = new Set<string>()
    for (const ymd of sessionDates) {
      const { year, month } = parseYmd(ymd)
      if (year === selectedYear) months.add(month)
    }
    return [...months].sort((a, b) => Number(a) - Number(b))
  }, [sessionDates, selectedYear])

  const dayOptions = useMemo(() => {
    if (!selectedYear || !selectedMonth) return []
    return sessionDates.filter((ymd) => {
      const { year, month } = parseYmd(ymd)
      return year === selectedYear && month === selectedMonth
    })
  }, [sessionDates, selectedYear, selectedMonth])

  const selectedDate = useMemo(() => {
    if (!selectedYear || !selectedMonth || !selectedDay) return ''
    const ymd = `${selectedYear}-${selectedMonth}-${selectedDay}`
    return sessionMap.has(ymd) ? ymd : ''
  }, [selectedYear, selectedMonth, selectedDay, sessionMap])

  const applyDateParts = useCallback((ymd: string) => {
    const { year, month, day } = parseYmd(ymd)
    setSelectedYear(year)
    setSelectedMonth(month)
    setSelectedDay(day)
  }, [])

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch('/api/admin/seating-history/sessions')
      if (!res.ok) throw new Error('sessions_failed')
      const data = (await res.json()) as SessionsResponse
      setSessionsData(data)
      if (data.sessions.length > 0) {
        applyDateParts(data.sessions[0].session_date)
      }
    } catch {
      toast.error(isEn ? 'Failed to load sessions.' : '세션 목록을 불러오지 못했습니다.')
    } finally {
      setLoadingSessions(false)
    }
  }, [applyDateParts, isEn])

  useEffect(() => {
    if (!ready) return
    void loadSessions()
  }, [ready, loadSessions])

  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    const months = sessionDates
      .filter((ymd) => parseYmd(ymd).year === year)
      .map((ymd) => parseYmd(ymd).month)
    const uniqueMonths = [...new Set(months)].sort((a, b) => Number(a) - Number(b))
    const nextMonth = uniqueMonths[uniqueMonths.length - 1] ?? ''
    setSelectedMonth(nextMonth)
    if (nextMonth) {
      const days = sessionDates.filter((ymd) => {
        const p = parseYmd(ymd)
        return p.year === year && p.month === nextMonth
      })
      setSelectedDay(parseYmd(days[0] ?? '').day)
    } else {
      setSelectedDay('')
    }
  }

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    const days = sessionDates.filter((ymd) => {
      const p = parseYmd(ymd)
      return p.year === selectedYear && p.month === month
    })
    setSelectedDay(parseYmd(days[0] ?? '').day)
  }

  const loadRounds = useCallback(async () => {
    if (!selectedDate) {
      setAvailableRounds([])
      return
    }
    setLoadingRounds(true)
    try {
      const params = new URLSearchParams({ session_date: selectedDate })
      const res = await fetch(`/api/admin/seating-history/rounds?${params}`)
      if (!res.ok) throw new Error('rounds_failed')
      const data = (await res.json()) as { rounds: number[] }
      const rounds = data.rounds || []
      setAvailableRounds(rounds)
      if (rounds.length > 0 && !rounds.includes(Number(currentRound))) {
        setCurrentRound(String(rounds[0]))
      }
    } catch {
      setAvailableRounds([])
      toast.error(isEn ? 'Failed to load rounds.' : '라운드 정보를 불러오지 못했습니다.')
    } finally {
      setLoadingRounds(false)
    }
  }, [selectedDate, currentRound, isEn])

  useEffect(() => {
    if (!ready || !selectedDate) return
    void loadRounds()
  }, [ready, selectedDate, loadRounds])

  const loadRoundView = useCallback(async () => {
    if (!selectedDate || !currentRound) {
      setRoundView(null)
      return
    }
    if (!availableRounds.includes(Number(currentRound))) {
      setRoundView(null)
      return
    }

    setLoadingView(true)
    try {
      const params = new URLSearchParams({
        session_date: selectedDate,
        round: currentRound,
      })
      const res = await fetch(`/api/admin/seating-history/round?${params}`)
      if (res.status === 404) {
        setRoundView(null)
        return
      }
      if (!res.ok) throw new Error('view_failed')
      const data = (await res.json()) as { view: HistoryRoundView }
      setRoundView(data.view)
    } catch {
      setRoundView(null)
      toast.error(isEn ? 'Failed to load seating view.' : '자리배치를 불러오지 못했습니다.')
    } finally {
      setLoadingView(false)
    }
  }, [selectedDate, currentRound, availableRounds, isEn])

  useEffect(() => {
    if (!ready || loadingRounds) return
    void loadRoundView()
  }, [ready, loadingRounds, loadRoundView])

  const selectedSession = selectedDate ? sessionMap.get(selectedDate) ?? null : null

  if (!ready || loadingSessions) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5">
        <PageHeader
          title="자리 히스토리"
          titleEn="Seating History"
          description="날짜와 라운드를 선택하면 자리배치 화면과 같은 테이블 뷰로 확인할 수 있습니다."
          descriptionEn="Pick a date and round to review past seating in the same table layout as arrange."
          backPath="/admin/dashboard"
        />

        <Card className="rounded-3xl border border-border/60 bg-card shadow-sm">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
              <CalendarDays className="size-4" />
              {isEn ? 'Session' : '세션 선택'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            {sessionsData?.sessions.length ? (
              <div className="flex flex-wrap items-end gap-3 md:gap-4">
                <div className="space-y-1 w-[88px] shrink-0">
                  <span className="text-xs text-muted-foreground">{isEn ? 'Year' : '연도'}</span>
                  <Select value={selectedYear} onValueChange={handleYearChange}>
                    <SelectTrigger className="h-10 rounded-full border-border/70 bg-muted/30 font-semibold">
                      <SelectValue placeholder={isEn ? 'Year' : '연도'} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 w-[88px] shrink-0">
                  <span className="text-xs text-muted-foreground">{isEn ? 'Month' : '월'}</span>
                  <Select
                    value={selectedMonth}
                    onValueChange={handleMonthChange}
                    disabled={!selectedYear || monthOptions.length === 0}
                  >
                    <SelectTrigger className="h-10 rounded-full border-border/70 bg-muted/30 font-semibold">
                      <SelectValue placeholder={isEn ? 'Month' : '월'} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {monthOptions.map((month) => (
                        <SelectItem key={month} value={month}>
                          {monthLabel(month, isEn)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 min-w-[180px] flex-1">
                  <span className="text-xs text-muted-foreground">{isEn ? 'Day' : '일'}</span>
                  <Select
                    value={selectedDay}
                    onValueChange={setSelectedDay}
                    disabled={!selectedYear || !selectedMonth || dayOptions.length === 0}
                  >
                    <SelectTrigger className="h-10 rounded-full border-border/70 bg-muted/30 font-semibold">
                      <SelectValue placeholder={isEn ? 'Day' : '일'} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {dayOptions.map((ymd) => {
                        const { day } = parseYmd(ymd)
                        const session = sessionMap.get(ymd)
                        return (
                          <SelectItem key={ymd} value={day}>
                            {isEn
                              ? `${Number(day)} (${weekdayLabel(ymd, isEn)})`
                              : `${Number(day)}일 (${weekdayLabel(ymd, isEn)})`}
                            {session ? ` · ${session.total_count}` : ''}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border py-14 text-center">
                <History className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm font-bold text-muted-foreground">
                  {isEn ? 'No saved seating history yet.' : '저장된 자리 히스토리가 없습니다.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedDate ? (
          <Card className="rounded-3xl border border-border/60 bg-card shadow-sm">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
                <Users className="size-4" />
                {isEn ? 'Seating layout' : '자리배치 보기'}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-5">
              {loadingRounds ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : availableRounds.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-border py-14 text-center">
                  <p className="text-sm font-bold text-muted-foreground">
                    {isEn
                      ? 'No rounds saved for this date.'
                      : '이 날짜에 저장된 라운드가 없습니다.'}
                  </p>
                </div>
              ) : (
                <Tabs value={currentRound} onValueChange={setCurrentRound} className="w-full">
                  <TabsList className="bg-muted p-1 rounded-2xl h-14">
                    {[1, 2, 3].map((r) => (
                      <TabsTrigger
                        key={r}
                        value={String(r)}
                        disabled={!availableRounds.includes(r)}
                        className={cn(
                          'rounded-xl px-8 h-full font-black text-lg',
                          'data-[state=active]:bg-card data-[state=active]:shadow-md',
                          !availableRounds.includes(r) && 'opacity-40'
                        )}
                      >
                        {r} Round
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {[1, 2, 3].map((r) => (
                    <TabsContent key={r} value={String(r)} className="mt-6 focus-visible:outline-none">
                      {loadingView ? (
                        <div className="py-16 flex justify-center">
                          <Loader2 className="size-8 animate-spin text-primary" />
                        </div>
                      ) : roundView && roundView.round === r ? (
                        <div className="space-y-4">
                          {(roundView.posting_title || roundView.day_label) && (
                            <div className="rounded-2xl bg-muted/40 border border-border px-4 py-3">
                              {roundView.posting_title ? (
                                <p className="text-sm font-black text-foreground">{roundView.posting_title}</p>
                              ) : null}
                              {roundView.day_label ? (
                                <p className="text-xs font-bold text-muted-foreground mt-1">
                                  {isEn ? 'Day' : '요일'}: {roundView.day_label}
                                </p>
                              ) : null}
                            </div>
                          )}
                            <SeatingHistoryRoundGrid
                              view={roundView}
                              isEn={isEn}
                              onSelectParticipant={setSelectedParticipant}
                            />
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-border py-14 text-center">
                          <p className="text-sm font-bold text-muted-foreground">
                            {isEn ? 'No data for this round.' : '이 라운드 데이터가 없습니다.'}
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {selectedParticipant && roundView ? (
        <HistoryParticipantModal
          participant={selectedParticipant}
          sessionDate={roundView.session_date}
          round={roundView.round}
          source={roundView.source}
          isOpen={true}
          isEn={isEn}
          onClose={() => setSelectedParticipant(null)}
        />
      ) : null}
    </div>
  )
}
