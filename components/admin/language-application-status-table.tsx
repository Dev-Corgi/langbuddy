'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Loader2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  fetchLanguageApplicationStatusByDay,
  type LanguageDayApplicationStatus,
} from '@/lib/language-application-status'
import {
  formatDayLabel,
  formatScheduleTime,
} from '@/lib/language-exchange-schedule'
import { formatSessionDateLabel } from '@/lib/session-event-date'

type Props = {
  isEn: boolean
  canOpenLanguageAdmin: boolean
}

export function LanguageApplicationStatusTable({ isEn, canOpenLanguageAdmin }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState('')
  const [weekEnd, setWeekEnd] = useState('')
  const [rows, setRows] = useState<LanguageDayApplicationStatus[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchLanguageApplicationStatusByDay(supabase, isEn ? 'en' : 'ko')
      setWeekStart(result.weekStart)
      setWeekEnd(result.weekEnd)
      setRows(result.rows)
    } catch (err) {
      console.error('[LanguageApplicationStatusTable]', err)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [supabase, isEn])

  useEffect(() => {
    void load()
  }, [load])

  const weekLabel =
    weekStart && weekEnd
      ? isEn
        ? `${formatSessionDateLabel(weekStart, 'en')} – ${formatSessionDateLabel(weekEnd, 'en')}`
        : `${formatSessionDateLabel(weekStart, 'ko')} ~ ${formatSessionDateLabel(weekEnd, 'ko')}`
      : ''

  return (
    <Card className="border-border shadow-sm rounded-[32px] overflow-hidden border-none">
      <CardHeader className="bg-muted/50 border-b border-border px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg md:text-xl font-black">
                {isEn ? 'Language exchange applications by day' : '언어교환 요일별 신청현황'}
              </CardTitle>
              {weekLabel ? (
                <p className="text-xs font-bold text-muted-foreground mt-0.5">
                  {isEn ? `This week: ${weekLabel}` : `이번 주 · ${weekLabel}`}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl font-bold"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">{isEn ? 'Refresh' : '새로고침'}</span>
            </Button>
            {canOpenLanguageAdmin ? (
              <Button asChild size="sm" className="rounded-xl font-black">
                <Link href="/admin/language">{isEn ? 'Manage' : '언어교환 관리'}</Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="secondary" className="rounded-xl font-black">
                <Link href="/admin/arrange">{isEn ? 'Seating' : '자리 배치'}</Link>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 px-6 text-center text-sm font-bold text-muted-foreground">
            {isEn
              ? 'No active language exchange days configured.'
              : '활성화된 언어교환 요일이 없습니다.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    {isEn ? 'Day' : '요일'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    {isEn ? 'Session' : '회차'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-black text-muted-foreground whitespace-nowrap">
                    {isEn ? 'Applications' : '신청'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-black text-muted-foreground whitespace-nowrap">
                    {isEn ? 'Korean' : '한국인'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-black text-muted-foreground whitespace-nowrap">
                    {isEn ? 'Foreigner' : '외국인'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-black text-muted-foreground whitespace-nowrap">
                    {isEn ? 'Check-in' : '체크인'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-black text-muted-foreground whitespace-nowrap">
                    {isEn ? 'Payment pending' : '입금대기'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const atCapacity =
                    row.maxParticipants != null && row.totalApplications >= row.maxParticipants
                  return (
                    <tr
                      key={row.day}
                      className="border-b border-border/80 hover:bg-muted/20 even:bg-muted/5"
                    >
                      <td className="px-4 py-3 font-black whitespace-nowrap">
                        {formatDayLabel(row.day, isEn ? 'en' : 'ko')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-bold text-foreground">{row.sessionDateLabel}</p>
                        <p className="text-xs font-bold text-muted-foreground mt-0.5">
                          {formatScheduleTime(row.time, isEn ? 'en' : 'ko')}
                          {row.location ? ` · ${row.location}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center min-w-12 px-2 py-1 rounded-lg font-black',
                            atCapacity ? 'bg-amber-100 text-amber-800' : 'bg-primary/10 text-primary'
                          )}
                        >
                          {row.totalApplications}
                          {row.maxParticipants != null ? (
                            <span className="text-muted-foreground font-bold">
                              /{row.maxParticipants}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-black whitespace-nowrap text-blue-700">
                        {row.koreanCount}
                      </td>
                      <td className="px-4 py-3 text-center font-black whitespace-nowrap text-violet-700">
                        {row.foreignerCount}
                      </td>
                      <td className="px-4 py-3 text-center font-black whitespace-nowrap">
                        <span
                          className={cn(
                            row.checkedInCount > 0 ? 'text-emerald-600' : 'text-muted-foreground'
                          )}
                        >
                          {row.checkedInCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-black whitespace-nowrap">
                        <span
                          className={cn(
                            row.pendingPaymentCount > 0 ? 'text-amber-600' : 'text-muted-foreground'
                          )}
                        >
                          {row.pendingPaymentCount}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
