'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { QRCodeSVG } from 'qrcode.react'
import { Loader2, Copy, Check, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { isoDateForKoreanWeekdayInSunWeekSeoul } from '@/lib/session-event-date'
import { loadLangQrSessionForDay } from '@/lib/admin-qr-sessions'
import { extractParticipantInfoFromAnswers, type CoreFormQuestion } from '@/lib/utils'

const WEEK_DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

type SheetRow = {
  id: string
  qrCode: string
  name: string
  eventDate: string
  selectedDay: string
  checkedInAt: string | null
  createdAt: string
}

function QrDebugSheetContent() {
  const searchParams = useSearchParams()
  const initialDay = searchParams.get('day') || '목'
  const supabase = useMemo(() => createClient(), [])

  const [authChecked, setAuthChecked] = useState(false)
  const [day, setDay] = useState(initialDay)
  const [loading, setLoading] = useState(true)
  const [formTitle, setFormTitle] = useState('')
  const [rows, setRows] = useState<SheetRow[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const eventDate = useMemo(() => {
    try {
      return isoDateForKoreanWeekdayInSunWeekSeoul(day)
    } catch {
      return ''
    }
  }, [day])

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/admin/login'
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', user.id)
        .single()
      if (!profile?.is_superadmin && !isSuperAdminEmail(user.email)) {
        window.location.href = '/admin/dashboard'
        return
      }
      setAuthChecked(true)
    }
    void run()
  }, [supabase])

  const loadSheet = useCallback(async () => {
    setLoading(true)
    try {
      const session = await loadLangQrSessionForDay(supabase, day)
      if (!session?.formId) {
        setRows([])
        setFormTitle('')
        return
      }

      const [{ data: form }, { data: questions }, { data: responses }] = await Promise.all([
        supabase.from('forms').select('title').eq('id', session.formId).maybeSingle(),
        supabase
          .from('form_questions')
          .select('id, system_key, question_text, question_text_en, show_in_qr')
          .eq('form_id', session.formId),
        supabase
          .from('form_responses')
          .select('id, qr_code, answers, checked_in_at, created_at')
          .eq('form_id', session.formId)
          .order('created_at', { ascending: true }),
      ])

      setFormTitle(form?.title || session.formId)
      const qList = (questions || []) as CoreFormQuestion[]

      const mapped: SheetRow[] = (responses || [])
        .filter((r) => r.qr_code)
        .map((r) => {
          const answers = (r.answers || {}) as Record<string, unknown>
          const info = extractParticipantInfoFromAnswers(answers, qList)
          const name =
            info.name ||
            (typeof answers.name === 'string' ? answers.name : '') ||
            (typeof answers.이름 === 'string' ? answers.이름 : '') ||
            '—'
          return {
            id: r.id,
            qrCode: r.qr_code as string,
            name,
            eventDate:
              typeof answers._event_date === 'string'
                ? answers._event_date.slice(0, 10)
                : '—',
            selectedDay:
              typeof answers._selected_day === 'string' ? answers._selected_day.trim() : day,
            checkedInAt: r.checked_in_at,
            createdAt: r.created_at || '',
          }
        })

      setRows(mapped)
    } catch (e) {
      console.error(e)
      toast.error('QR 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [supabase, day])

  useEffect(() => {
    if (!authChecked) return
    void loadSheet()
  }, [authChecked, loadSheet])

  const copyQr = async (row: SheetRow) => {
    try {
      await navigator.clipboard.writeText(row.qrCode)
      setCopiedId(row.id)
      toast.success('QR UUID 복사됨')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  if (!authChecked) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 print:p-4">
      <PageHeader
        title="참가자 QR 목록"
        titleEn="Participant QR sheet"
        description="실제 신청 DB의 qr_code로 테스트용 QR을 표시합니다."
        descriptionEn="QR codes from live form_responses for testing."
        backPath="/admin/qr-scanner/debug"
      />

      <Card className="rounded-[24px] border-none shadow-sm print:hidden">
        <CardContent className="p-5 flex flex-wrap items-end gap-4">
          <div className="space-y-2 min-w-[140px]">
            <Label className="text-xs font-bold">요일</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="rounded-xl font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK_DAYS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}요일
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => void loadSheet()}>
            새로고침
          </Button>
          <Button asChild variant="secondary" className="rounded-xl font-bold gap-2">
            <Link href="/admin/qr-scanner/debug">
              <ArrowLeft className="size-4" />
              디버그 스캐너
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="text-sm font-bold text-muted-foreground print:mb-4">
        {formTitle ? `${formTitle} · ` : ''}
        {day}요일 회차 {eventDate || '—'} · {rows.length}명
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="size-10 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="rounded-[24px]">
          <CardContent className="py-16 text-center text-muted-foreground font-bold">
            해당 요일 폼에 QR이 있는 신청이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.id} className="rounded-2xl overflow-hidden break-inside-avoid">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <p className="font-black text-base">{row.name}</p>
                <p className="text-xs text-muted-foreground font-medium">
                  {row.selectedDay} · {row.eventDate}
                  {row.checkedInAt ? ' · 체크인됨' : ' · 미체크인'}
                </p>
                <div className="bg-white p-2 rounded-xl border">
                  <QRCodeSVG value={row.qrCode} size={180} level="M" />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground break-all leading-snug">
                  {row.qrCode}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg font-bold gap-1 print:hidden w-full"
                  onClick={() => void copyQr(row)}
                >
                  {copiedId === row.id ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  UUID 복사
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function QrDebugSheetPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="size-10 animate-spin text-primary" />
        </div>
      }
    >
      <QrDebugSheetContent />
    </Suspense>
  )
}
