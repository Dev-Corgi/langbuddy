'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import {
  STAMP_SLIDER_MAX,
  sliderStampToStored,
  storedStampToSlider,
} from '@/lib/le-stamp'
import { cn } from '@/lib/utils'

type Props = {
  userId: string
  /** 제공 시 초기 fetch 생략 (QR 체크인 모달 등) */
  initialSlider?: number | null
  /** participant/user 변경 시 상태 리셋 */
  resetKey?: string
}

export function StampProgressEditor({ userId, initialSlider, resetKey }: Props) {
  const [stampSlider, setStampSlider] = useState(0)
  const [savedStamp, setSavedStamp] = useState<number | null>(null)
  const [savingStamp, setSavingStamp] = useState(false)
  const [loadingStamp, setLoadingStamp] = useState(initialSlider == null)

  useEffect(() => {
    let cancelled = false

    const applyInitial = (slider: number) => {
      if (cancelled) return
      setStampSlider(slider)
      setSavedStamp(slider)
      setLoadingStamp(false)
    }

    if (initialSlider != null) {
      applyInitial(initialSlider)
      return () => {
        cancelled = true
      }
    }

    setLoadingStamp(true)
    const supabase = createClient()
    void (async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('le_stamp_progress')
          .eq('id', userId)
          .maybeSingle()
        if (cancelled) return
        applyInitial(storedStampToSlider(data?.le_stamp_progress))
      } catch {
        if (!cancelled) {
          setLoadingStamp(false)
          toast.error('스탬프 정보를 불러오지 못했습니다.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, initialSlider, resetKey])

  const handleSaveStamp = useCallback(async () => {
    setSavingStamp(true)
    try {
      const stored = sliderStampToStored(stampSlider)
      const res = await fetch(`/api/admin/users/${userId}`, {
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
  }, [userId, stampSlider])

  const stampDirty = savedStamp != null && stampSlider !== savedStamp
  const stampAtCouponRedeem = stampSlider >= STAMP_SLIDER_MAX

  if (loadingStamp) {
    return (
      <div className="rounded-2xl border-2 border-amber-200/80 bg-amber-50/30 px-4 py-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
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
          현장에서 확인 후 스탬프를 맞춰 주세요. 일반 참가는 +1, 쿠폰 사용은 10(→0)으로
          설정합니다.
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
  )
}
