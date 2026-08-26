'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Building2, ChevronLeft, ChevronRight, Loader2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type ReportStatus = 'pending' | 'reviewed' | 'dismissed'

type FacilityReportRow = {
  id: string
  created_at: string
  session_date: string
  reasons: string[]
  comment: string | null
  status: ReportStatus
  admin_note: string | null
  posting_id: string
  posting_title: string
  reporter_name: string
}

type FetchResult = {
  reports: FacilityReportRow[]
  total: number
  page: number
  pageSize: number
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const map: Record<ReportStatus, { label: string; className: string }> = {
    pending: { label: '대기중', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    reviewed: { label: '처리완료', className: 'bg-green-100 text-green-800 border-green-300' },
    dismissed: { label: '기각', className: 'bg-muted text-muted-foreground border-border' },
  }
  const s = map[status]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', s.className)}>
      {s.label}
    </span>
  )
}

export function FacilityReportsPanel() {
  const [statusTab, setStatusTab] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<FetchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [updating, setUpdating] = useState(false)

  const fetchReports = useCallback(async (status: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/admin/facility-reports?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('시설 신고 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports(statusTab, page)
  }, [statusTab, page, fetchReports])

  const selectedReport = data?.reports.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    setAdminNote(selectedReport?.admin_note || '')
  }, [selectedReport?.id, selectedReport?.admin_note])

  const handleTabChange = (v: string) => {
    setStatusTab(v)
    setPage(1)
    setSelectedId(null)
  }

  const handleUpdate = async (status: ReportStatus) => {
    if (!selectedId) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/facility-reports/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note: adminNote }),
      })
      if (!res.ok) throw new Error('update failed')
      toast.success('상태가 업데이트되었습니다.')
      await fetchReports(statusTab, page)
    } catch {
      toast.error('업데이트에 실패했습니다.')
    } finally {
      setUpdating(false)
    }
  }

  const handleNoteOnly = async () => {
    if (!selectedId) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/facility-reports/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note: adminNote }),
      })
      if (!res.ok) throw new Error('update failed')
      toast.success('메모가 저장되었습니다.')
      await fetchReports(statusTab, page)
    } catch {
      toast.error('메모 저장에 실패했습니다.')
    } finally {
      setUpdating(false)
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1

  return (
    <div className="space-y-6">
      <Tabs value={statusTab} onValueChange={handleTabChange}>
        <TabsList>
          {(['all', 'pending', 'reviewed', 'dismissed'] as const).map((s) => (
            <TabsTrigger key={s} value={s}>
              {s === 'all' ? '전체' : s === 'pending' ? '대기중' : s === 'reviewed' ? '처리완료' : '기각'}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.reports.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Building2 className="size-10 mb-3 opacity-30" />
              <p className="text-sm">시설 불편 신고 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.reports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                  className={cn(
                    'w-full text-left rounded-xl border px-4 py-3.5 transition-colors',
                    r.id === selectedId
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 bg-card hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground truncate">
                          {r.posting_title}
                        </span>
                        <span className="text-xs text-muted-foreground">{r.reporter_name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <Badge variant="outline" className="text-xs">
                          {r.session_date}
                        </Badge>
                        <span className="text-xs font-medium text-foreground line-clamp-1">
                          {r.reasons.join(' · ')}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{r.comment}</p>
                      )}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </button>
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedReport && (
          <div className="w-80 shrink-0">
            <div className="sticky top-6 rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-black text-foreground">시설 신고 상세</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">모임</span>
                  <span className="font-semibold text-right">{selectedReport.posting_title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">신고자</span>
                  <span className="font-semibold">{selectedReport.reporter_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">세션일</span>
                  <span className="font-semibold tabular-nums">{selectedReport.session_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">상태</span>
                  <StatusBadge status={selectedReport.status} />
                </div>
              </div>

              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">불편 사유</p>
                <ul className="text-sm space-y-1">
                  {selectedReport.reasons.map((reason) => (
                    <li key={reason} className="text-foreground">· {reason}</li>
                  ))}
                </ul>
              </div>

              {selectedReport.comment && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">자유 의견</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedReport.comment}</p>
                  </div>
                </>
              )}

              <Separator />
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="size-3" />
                  관리자 메모
                </label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="처리 메모를 입력하세요..."
                  rows={3}
                  className="text-sm"
                />
                <Button size="sm" variant="outline" className="w-full" onClick={handleNoteOnly} disabled={updating}>
                  메모 저장
                </Button>
              </div>

              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">상태 변경</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleUpdate('reviewed')}
                    disabled={updating || selectedReport.status === 'reviewed'}
                  >
                    처리완료
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleUpdate('dismissed')}
                    disabled={updating || selectedReport.status === 'dismissed'}
                  >
                    기각
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
