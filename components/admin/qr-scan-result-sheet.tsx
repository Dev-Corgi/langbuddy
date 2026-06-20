'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { AdminCheckinModalPayload } from '@/lib/admin-checkin-display'
import {
  STAMP_SLIDER_MAX,
  sliderStampToStored,
  storedStampToSlider,
} from '@/lib/le-stamp'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export type QrScanResultSheetPayload = AdminCheckinModalPayload

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: QrScanResultSheetPayload | null
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-border/80 last:border-0">
      <span className="text-sm font-bold text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="text-sm font-black text-right break-words">
        {value || '—'}
      </span>
    </div>
  )
}

export function QrScanResultSheet({ open, onOpenChange, payload }: Props) {
  const [stampSlider, setStampSlider] = useState(0)
  const [savedStamp, setSavedStamp] = useState<number | null>(null)
  const [savingStamp, setSavingStamp] = useState(false)

  useEffect(() => {
    if (!payload?.stampEditable || payload.stampSlider == null) return
    const initial = payload.stampSlider
    setStampSlider(initial)
    setSavedStamp(initial)
  }, [payload?.userId, payload?.stampSlider, payload?.stampEditable, open])

  const handleSaveStamp = useCallback(async () => {
    if (!payload?.userId || !payload.stampEditable) return
    setSavingStamp(true)
    try {
      const stored = sliderStampToStored(stampSlider)
      const res = await fetch(`/api/admin/users/${payload.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ le_stamp_progress: stored }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || 'save_failed')
      }
      const displayAfter = storedStampToSlider(stored)
      setSavedStamp(displayAfter)
      setStampSlider(displayAfter)
      toast.success(
        stampSlider >= STAMP_SLIDER_MAX
          ? '스탬프 0으로 저장했습니다 (쿠폰 사용).'
          : `스탬프 ${stored}개로 저장했습니다.`
      )
    } catch {
      toast.error('스탬프 저장에 실패했습니다.')
    } finally {
      setSavingStamp(false)
    }
  }, [payload?.userId, payload?.stampEditable, stampSlider])

  const tableDisplay =
    payload?.tableUndecided || !payload?.tableLabel
      ? '미정'
      : payload.tableLabel

  const stampDirty =
    payload?.stampEditable &&
    savedStamp != null &&
    stampSlider !== savedStamp

  const stampAtCouponRedeem = stampSlider >= STAMP_SLIDER_MAX

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg overflow-hidden">
        <DialogHeader className="px-5 pt-6 pb-2 text-left shrink-0 border-b">
          <DialogTitle className="text-xl font-black">체크인 완료</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 flex-1 overflow-y-auto max-h-[min(70vh,520px)]">
          {payload?.showTable !== false && (
            <div className="mb-5 rounded-2xl bg-primary/10 p-5 text-center border-2 border-primary/25">
              <p className="text-xs font-black text-muted-foreground tracking-wide mb-1">
                배치된 자리
              </p>
              <p className="text-5xl sm:text-6xl font-black text-primary leading-tight">
                {tableDisplay}
              </p>
            </div>
          )}

          {payload && (
            <div className="rounded-2xl bg-muted/40 px-4 py-1 border mb-4">
              <InfoRow label="이름" value={payload.name} />
              <InfoRow label="한국인/외국인" value={payload.nationalityLabel} />
              <InfoRow label="결제 수단" value={payload.paymentMethod} />
              {payload.sessionUsedCoupon ? (
                <InfoRow label="이번 신청" value="무료쿠폰 (실물 확인)" />
              ) : null}
              <InfoRow label="선택 음료" value={payload.drink} />
              {payload.showTable === false && (
                <InfoRow label="배치된 자리" value="—" />
              )}
            </div>
          )}

          {payload?.stampEditable ? (
            <div className="rounded-2xl border-2 border-amber-200/80 bg-amber-50/30 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-foreground">스탬프</p>
                <span className="text-lg font-black text-primary tabular-nums">
                  {stampSlider}
                  <span className="text-xs font-bold text-muted-foreground ml-1">
                    / {STAMP_SLIDER_MAX}
                  </span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={STAMP_SLIDER_MAX}
                step={1}
                value={stampSlider}
                onChange={(e) => setStampSlider(Number(e.target.value))}
                className="w-full h-2 accent-primary cursor-pointer"
                aria-label="스탬프 개수"
              />
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground px-0.5">
                <span>0</span>
                <span>10 (쿠폰→0)</span>
              </div>
              {stampAtCouponRedeem ? (
                <p className="text-xs font-bold text-amber-800 leading-relaxed">
                  10 = 실물 쿠폰 사용. 저장하면 스탬프 0으로 기록됩니다.
                </p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                  현장에서 확인 후 스탬프를 맞춰 주세요. 일반 참가는 +1, 쿠폰 사용은
                  10(→0)으로 설정합니다.
                </p>
              )}
              <Button
                type="button"
                variant={stampDirty ? 'default' : 'outline'}
                className={cn('w-full h-11 rounded-xl font-black', stampDirty && 'shadow-md')}
                disabled={!stampDirty || savingStamp}
                onClick={() => void handleSaveStamp()}
              >
                {savingStamp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    저장 중…
                  </>
                ) : (
                  '스탬프 저장'
                )}
              </Button>
            </div>
          ) : payload ? (
            <p className="text-xs font-medium text-muted-foreground text-center py-2">
              비회원(현장 추가) — 스탬프 없음
            </p>
          ) : null}
        </div>

        <DialogFooter className="p-5 pt-2 border-t bg-background shrink-0 sm:justify-stretch">
          <Button
            type="button"
            className="w-full h-14 rounded-2xl font-black text-base"
            onClick={() => onOpenChange(false)}
          >
            확인 · 다음 스캔
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
