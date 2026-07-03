'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  STAMP_SLIDER_MAX,
  sliderStampToStored,
  storedStampToSlider,
} from '@/lib/le-stamp'

type Props = {
  userId: string
  /** 제공 시 초기 fetch 생략 (QR 체크인 모달 등) */
  initialSlider?: number | null
  /** participant/user 변경 시 상태 리셋 */
  resetKey?: string
  disabled?: boolean
}

export type StampProgressEditorHandle = {
  flushPendingSave: () => Promise<boolean>
}

export const StampProgressEditor = forwardRef<StampProgressEditorHandle, Props>(
  function StampProgressEditor(
    { userId, initialSlider, resetKey, disabled = false },
    ref
  ) {
    const [stampSlider, setStampSlider] = useState(0)
    const [savedStamp, setSavedStamp] = useState<number | null>(null)
    const [savingStamp, setSavingStamp] = useState(false)
    const [loadingStamp, setLoadingStamp] = useState(initialSlider == null)
    const saveSeqRef = useRef(0)

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
      void (async () => {
        try {
          const res = await fetch(`/api/admin/users/${userId}`)
          const data = (await res.json().catch(() => ({}))) as {
            error?: string
            user?: { le_stamp_progress?: number | null }
          }
          if (cancelled) return
          if (!res.ok || !data.user) {
            throw new Error(data.error || 'load_failed')
          }
          applyInitial(storedStampToSlider(data.user.le_stamp_progress))
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

    const saveStamp = useCallback(
      async (slider: number, opts?: { silent?: boolean }): Promise<boolean> => {
        if (savedStamp != null && slider === savedStamp) return true

        const seq = ++saveSeqRef.current
        setSavingStamp(true)
        try {
          const res = await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ le_stamp_progress: slider }),
          })
          const body = (await res.json().catch(() => ({}))) as {
            error?: string
            user?: { le_stamp_progress?: number | null }
          }
          if (!res.ok) {
            throw new Error(body.error || 'save_failed')
          }
          if (seq !== saveSeqRef.current) return true

          const stored = Number(
            body.user?.le_stamp_progress ?? sliderStampToStored(slider)
          )
          const displayAfter = storedStampToSlider(stored)
          setSavedStamp(displayAfter)
          setStampSlider(displayAfter)

          if (!opts?.silent) {
            toast.success(
              slider >= STAMP_SLIDER_MAX
                ? '스탬프 0으로 저장했습니다 (쿠폰 사용).'
                : `스탬프 ${stored}개로 저장했습니다.`
            )
          }
          return true
        } catch {
          if (seq === saveSeqRef.current) {
            toast.error('스탬프 저장에 실패했습니다.')
          }
          return false
        } finally {
          if (seq === saveSeqRef.current) {
            setSavingStamp(false)
          }
        }
      },
      [savedStamp, userId]
    )

    useEffect(() => {
      if (loadingStamp || savedStamp == null || stampSlider === savedStamp) return

      const timer = setTimeout(() => {
        void saveStamp(stampSlider, { silent: true })
      }, 400)

      return () => clearTimeout(timer)
    }, [stampSlider, savedStamp, loadingStamp, saveStamp])

    useImperativeHandle(
      ref,
      () => ({
        flushPendingSave: async () => {
          if (savedStamp == null || stampSlider === savedStamp) return true
          return saveStamp(stampSlider, { silent: true })
        },
      }),
      [saveStamp, savedStamp, stampSlider]
    )

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
          className="w-full h-2 accent-primary cursor-pointer disabled:opacity-50"
          aria-label="스탬프 개수"
          disabled={disabled || savingStamp}
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
        {savingStamp || stampDirty ? (
          <p className="text-[11px] font-medium text-muted-foreground text-center">
            {savingStamp ? '스탬프 저장 중…' : '스탬프 변경 저장 대기…'}
          </p>
        ) : null}
      </div>
    )
  }
)

StampProgressEditor.displayName = 'StampProgressEditor'
