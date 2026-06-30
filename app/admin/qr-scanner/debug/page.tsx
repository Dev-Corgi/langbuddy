'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { isSuperAdminEmail } from '@/lib/super-admin'
import QrScanner from 'qr-scanner'
import { toast } from 'sonner'
import {
  Bug,
  CheckCircle2,
  Loader2,
  SwitchCamera,
  XCircle,
  ClipboardList,
} from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { isoDateForKoreanWeekdayInSunWeekSeoul, koreanWeekdayLetterSeoul, todayYYYYMMDDSeoul } from '@/lib/session-event-date'
import { validateQrCode, type QrValidationResult } from '@/lib/qr-scan-validation'

const WEEK_DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

type ScanLogEntry = QrValidationResult & { qrCode: string; at: string }

export default function QrDebugScannerPage() {
  const supabase = useMemo(() => createClient(), [])
  const [authChecked, setAuthChecked] = useState(false)
  const [targetDay, setTargetDay] = useState<string>('목')
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user')
  const [manualCode, setManualCode] = useState('')
  const [validating, setValidating] = useState(false)
  const [log, setLog] = useState<ScanLogEntry[]>([])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)
  const lastScanRef = useRef<{ at: number; text: string } | null>(null)
  const targetDayRef = useRef(targetDay)
  targetDayRef.current = targetDay

  const targetEventDate = useMemo(() => {
    try {
      return isoDateForKoreanWeekdayInSunWeekSeoul(targetDay)
    } catch {
      return ''
    }
  }, [targetDay])

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

  const pushResult = useCallback((qrCode: string, result: QrValidationResult) => {
    setLog((prev) => [{ ...result, qrCode, at: new Date().toISOString() }, ...prev].slice(0, 30))
    if (result.ok) toast.success(result.message)
    else toast.error(result.message)
  }, [])

  const runValidation = useCallback(
    async (qrCode: string) => {
      setValidating(true)
      try {
        const result = await validateQrCode(supabase, qrCode, {
          mode: 'debug',
          scanMode: 'lang',
          targetDayKo: targetDayRef.current,
        })
        pushResult(qrCode, result)
      } catch (e) {
        console.error(e)
        toast.error('검증 중 오류가 발생했습니다.')
      } finally {
        setValidating(false)
      }
    },
    [supabase, pushResult]
  )

  const acceptScan = useCallback((text: string) => {
    const now = Date.now()
    const last = lastScanRef.current
    if (last && last.text === text && now - last.at < 2800) return false
    lastScanRef.current = { at: now, text }
    return true
  }, [])

  const onDecoded = useCallback(
    async (decodedText: string) => {
      if (!acceptScan(decodedText)) return
      await runValidation(decodedText)
    },
    [acceptScan, runValidation]
  )

  useEffect(() => {
    if (!cameraOn) return
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    QrScanner.WORKER_PATH = '/qr-scanner-worker.min.js'

    const stopScanner = (scanner: QrScanner) => {
      try {
        scanner.stop()
      } catch {
        /* ignore */
      }
      try {
        scanner.destroy()
      } catch {
        /* ignore */
      }
    }

    const createScanner = (facing: 'user' | 'environment') =>
      new QrScanner(
        video,
        (result) => {
          if (!cancelled) void onDecoded(result.data)
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: facing,
          maxScansPerSecond: 8,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          onDecodeError: () => {},
        }
      )

    const startCamera = async () => {
      let scanner: QrScanner | null = null
      try {
        scanner = createScanner(cameraFacing)
        await scanner.start()
        if (cancelled) {
          stopScanner(scanner)
          return
        }
        qrScannerRef.current = scanner
      } catch {
        if (scanner) stopScanner(scanner)
        const fallback = cameraFacing === 'user' ? 'environment' : 'user'
        try {
          scanner = createScanner(fallback)
          await scanner.start()
          if (cancelled) {
            stopScanner(scanner)
            return
          }
          qrScannerRef.current = scanner
          if (!cancelled) setCameraFacing(fallback)
        } catch {
          if (!cancelled) {
            toast.error('카메라를 켤 수 없습니다.')
            setCameraOn(false)
          }
        }
      }
    }

    void startCamera()
    return () => {
      cancelled = true
      if (qrScannerRef.current) {
        stopScanner(qrScannerRef.current)
        qrScannerRef.current = null
      }
    }
  }, [cameraOn, cameraFacing, onDecoded])

  if (!authChecked) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    )
  }

  const todayStr = todayYYYYMMDDSeoul()
  const todayDay = koreanWeekdayLetterSeoul()

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="QR 디버그 검증"
        titleEn="QR debug validator"
        description="체크인 상태는 변경하지 않고 QR 유효성만 검사합니다."
        descriptionEn="Validate QR codes without updating check-in status."
        backPath="/admin/qr-scanner"
      />

      <Card className="rounded-[24px] border-2 border-amber-200/80 bg-amber-50/20 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <p className="text-sm font-bold text-amber-900 leading-relaxed">
            디버그 모드 — DB의 <code className="text-xs">checked_in_at</code> 은 수정하지 않습니다.
            목요일 실제 신청 QR 테스트 시 아래에서 대상 요일을 <b>목</b>으로 두세요.
          </p>
          <div className="space-y-2 max-w-xs">
            <Label className="text-xs font-bold">검증 기준 요일</Label>
            <Select value={targetDay} onValueChange={setTargetDay}>
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
            {targetEventDate ? (
              <p className="text-xs text-muted-foreground font-medium">
                회차 날짜: {targetEventDate}
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            오늘: {todayStr} ({todayDay}) · 검증 기준: {targetDay}요일 / {targetEventDate || '—'}
          </p>
          <Button asChild variant="secondary" className="w-full rounded-xl font-black gap-2">
            <Link href={`/admin/qr-scanner/debug/sheet?day=${encodeURIComponent(targetDay)}`}>
              <ClipboardList className="size-4" />
              {targetDay}요일 참가자 QR 목록 보기
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-none shadow-lg overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="UUID 직접 입력 후 검증"
              className="rounded-xl font-mono text-xs"
            />
            <Button
              type="button"
              className="shrink-0 rounded-xl font-bold"
              disabled={validating || !manualCode.trim()}
              onClick={() => void runValidation(manualCode.trim())}
            >
              검증
            </Button>
          </div>

          {!cameraOn ? (
            <Button
              type="button"
              className="w-full h-20 rounded-3xl text-lg font-black gap-2"
              onClick={() => setCameraOn(true)}
            >
              <Bug className="size-7" />
              카메라 스캔 시작
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="relative min-h-[260px] overflow-hidden rounded-2xl border-4 border-muted bg-black">
                <video ref={videoRef} className="w-full min-h-[260px] object-cover" muted playsInline />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 h-11 rounded-xl font-bold gap-2"
                  onClick={() =>
                    setCameraFacing((f) => (f === 'user' ? 'environment' : 'user'))
                  }
                >
                  <SwitchCamera className="size-4" />
                  카메라 전환
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11 rounded-xl font-bold"
                  onClick={() => setCameraOn(false)}
                >
                  중지
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {log.length > 0 && (
        <Card className="rounded-[24px] border-none shadow-sm">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-black">최근 검증 결과</p>
            <ul className="space-y-2 max-h-[420px] overflow-y-auto">
              {log.map((entry, i) => (
                <li
                  key={`${entry.qrCode}-${entry.at}-${i}`}
                  className={cn(
                    'rounded-xl border p-3 text-sm',
                    entry.ok
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-red-200 bg-red-50/40'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {entry.ok ? (
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-black">{entry.message}</p>
                      {entry.response ? (
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          {entry.response.name} · {entry.response.selectedDay} ·{' '}
                          {entry.response.eventDate}
                          {entry.response.checkedInAt ? ' · 체크인됨' : ' · 미체크인'}
                        </p>
                      ) : null}
                      <p className="text-[10px] font-mono text-muted-foreground mt-1 break-all">
                        {entry.qrCode}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
