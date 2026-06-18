'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { isSuperAdminEmail } from '@/lib/super-admin'
import QrScanner from 'qr-scanner'
import { toast } from 'sonner'
import { QrCode, Loader2, SwitchCamera } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  formResponseMatchesTodaySession,
  koreanWeekdayLetterSeoul,
  todayYYYYMMDDSeoul,
} from '@/lib/session-event-date'
import { loadTodayQrSessions, type TodayQrSessionInfo } from '@/lib/admin-qr-sessions'
import { QrScannerModeSheet, type QrScannerMode } from '@/components/admin/qr-scanner-mode-sheet'

function classifyResponseFormId(
  formId: string,
  sessions: TodayQrSessionInfo
): 'study' | 'lang' | 'unknown' {
  if (sessions.study?.formId === formId) return 'study'
  if (sessions.lang?.formId === formId) return 'lang'
  return 'unknown'
}

export default function AdminQrScannerPage() {
  const supabase = useMemo(() => createClient(), [])
  const [authChecked, setAuthChecked] = useState(false)
  const [contextLoading, setContextLoading] = useState(true)
  const [sessions, setSessions] = useState<TodayQrSessionInfo | null>(null)

  const [modeSheetOpen, setModeSheetOpen] = useState(false)
  const [scanMode, setScanMode] = useState<QrScannerMode | null>(null)
  const scanModeRef = useRef<QrScannerMode | null>(null)
  scanModeRef.current = scanMode

  const [cameraOn, setCameraOn] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)
  const lastScanRef = useRef<{ at: number; text: string } | null>(null)
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  const acceptScan = useCallback((text: string) => {
    const now = Date.now()
    const last = lastScanRef.current
    if (last && last.text === text && now - last.at < 2800) return false
    lastScanRef.current = { at: now, text }
    return true
  }, [])

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
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

      setContextLoading(true)
      try {
        const s = await loadTodayQrSessions(supabase)
        setSessions(s)
      } finally {
        setContextLoading(false)
      }
    }
    void run()
  }, [supabase])

  const onDecoded = useCallback(
    async (decodedText: string) => {
      if (!acceptScan(decodedText)) {
        return
      }

      const mode = scanModeRef.current
      const ctx = sessionsRef.current
      if (!mode || !ctx) return

      const todayStr = todayYYYYMMDDSeoul()
      const currentDay = koreanWeekdayLetterSeoul()

      try {
        const { data: responseData, error: responseError } = await supabase
          .from('form_responses')
          .select('*')
          .eq('qr_code', decodedText)
          .maybeSingle()

        if (responseError || !responseData) {
          toast.error('유효하지 않은 QR 코드입니다.')
          return
        }

        const kind = classifyResponseFormId(responseData.form_id, ctx)
        if (kind === 'unknown') {
          toast.error('유효하지 않은 QR 코드입니다.')
          return
        }

        if (mode === 'study' && kind === 'lang') {
          toast.error('잘못된 QR 코드입니다.')
          return
        }
        if (mode === 'lang' && kind === 'study') {
          toast.error('잘못된 QR 코드입니다.')
          return
        }

        if (
          !formResponseMatchesTodaySession(
            responseData.answers as Record<string, unknown>,
            todayStr,
            currentDay
          )
        ) {
          toast.error('오늘 일정에 해당하지 않는 신청입니다.')
          return
        }

        if (!responseData.checked_in_at) {
          const nowIso = new Date().toISOString()
          const { error: upErr } = await supabase
            .from('form_responses')
            .update({ checked_in_at: nowIso })
            .eq('id', responseData.id)
          if (upErr) {
            toast.error('체크인 처리에 실패했습니다.')
            return
          }
        }

        toast.success('✅ qr 스캔 완료되었습니다')
        if ('vibrate' in navigator) navigator.vibrate(200)
      } catch (e) {
        console.error(e)
        toast.error('처리 중 오류가 발생했습니다.')
      }
    },
    [acceptScan, supabase]
  )

  useEffect(() => {
    if (!cameraOn || !scanMode) return

    const video = videoRef.current
    if (!video) return

    let cancelled = false
    QrScanner.WORKER_PATH = '/qr-scanner-worker.min.js'

    const runDecoded = async (text: string) => {
      if (!cancelled) await onDecoded(text)
    }

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
        (result) => void runDecoded(result.data),
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
      const fallbackFacing: 'user' | 'environment' =
        cameraFacing === 'user' ? 'environment' : 'user'

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
        try {
          scanner = createScanner(fallbackFacing)
          await scanner.start()
          if (cancelled) {
            stopScanner(scanner)
            return
          }
          qrScannerRef.current = scanner
          if (!cancelled) setCameraFacing(fallbackFacing)
        } catch {
          if (!cancelled) {
            toast.error(
              '카메라를 켤 수 없습니다. 권한·HTTPS를 확인해 주세요.'
            )
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
  }, [cameraOn, scanMode, cameraFacing, onDecoded])

  if (!authChecked || contextLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    )
  }

  const studyOk = Boolean(sessions?.study?.formId)
  const langOk = Boolean(sessions?.lang?.formId)

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto space-y-6">
      <PageHeader
        title="QR 체크인"
        titleEn="QR check-in"
        description="거치용 기기에서 연속으로 QR을 스캔할 때 사용합니다."
        descriptionEn="For a dedicated device scanning QR codes continuously."
        backPath="/admin/dashboard"
      />

      <Card className="rounded-[24px] border-none shadow-lg overflow-hidden">
        <CardContent className="p-5 space-y-4">
          {scanMode && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black">
                모드:{' '}
                <span className="text-primary">
                  {scanMode === 'study' ? '스터디' : '언어교환'}
                </span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="font-bold rounded-xl"
                onClick={() => {
                  setCameraOn(false)
                  setScanMode(null)
                  setModeSheetOpen(true)
                }}
              >
                변경
              </Button>
            </div>
          )}

          {!cameraOn && (
            <Button
              type="button"
              className="w-full h-24 rounded-3xl text-lg font-black gap-2 shadow-md"
              onClick={() => {
                if (scanMode) {
                  setCameraOn(true)
                } else {
                  setModeSheetOpen(true)
                }
              }}
            >
              <QrCode className="size-8" />
              QR 스캐너 시작
            </Button>
          )}

          {cameraOn && (
            <div className="space-y-3">
              <div className="relative min-h-[280px] overflow-hidden rounded-2xl border-4 border-muted bg-black [&_svg]:stroke-primary [&_.scan-region-highlight]:border-2 [&_.scan-region-highlight]:border-primary/60 [&_.scan-region-highlight]:rounded-xl">
                <video
                  ref={videoRef}
                  className="w-full min-h-[280px] object-cover"
                  muted
                  playsInline
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 h-12 rounded-2xl font-bold gap-2"
                  onClick={() =>
                    setCameraFacing((f) =>
                      f === 'user' ? 'environment' : 'user'
                    )
                  }
                >
                  <SwitchCamera className="size-5 shrink-0" />
                  {cameraFacing === 'user' ? '후면 카메라' : '전면 카메라'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-2xl font-bold"
                  onClick={() => setCameraOn(false)}
                >
                  일시 중지
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground font-bold">
                현재: {cameraFacing === 'user' ? '전면' : '후면'} 카메라
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <QrScannerModeSheet
        open={modeSheetOpen}
        onOpenChange={setModeSheetOpen}
        studyAvailable={studyOk}
        langAvailable={langOk}
        onSelect={(mode) => {
          setScanMode(mode)
          setCameraOn(true)
        }}
      />
    </div>
  )
}
