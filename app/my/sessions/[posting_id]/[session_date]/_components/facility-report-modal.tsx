'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  FACILITY_REPORT_REASONS,
  type FacilityReportReason,
} from '@/lib/facility-report-reasons'

type Props = {
  open: boolean
  onClose: () => void
  postingId: string
  sessionDate: string
  isEn: boolean
  onSuccess: () => void
  mockMode?: boolean
}

export function FacilityReportModal({
  open,
  onClose,
  postingId,
  sessionDate,
  isEn,
  onSuccess,
  mockMode = false,
}: Props) {
  const [selected, setSelected] = useState<FacilityReportReason[]>([])
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    setSelected([])
    setComment('')
    onClose()
  }

  const toggleReason = (value: FacilityReportReason) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  const handleSubmit = async () => {
    if (selected.length === 0) {
      toast.error(
        isEn ? 'Please select at least one option.' : '불편 항목을 하나 이상 선택해주세요.'
      )
      return
    }

    setLoading(true)
    try {
      if (mockMode) {
        await new Promise((r) => setTimeout(r, 400))
        toast.success(isEn ? 'Mock report — not saved.' : '목업 — 저장되지 않습니다.')
        onSuccess()
        handleClose()
        return
      }

      const res = await fetch('/api/facility-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postingId,
          sessionDate,
          reasons: selected,
          comment: comment.trim() || undefined,
        }),
      })

      if (res.status === 409) {
        toast.error(
          isEn
            ? 'You have already submitted a facility report for this session.'
            : '이미 이 세션에 시설 불편 신고를 제출했습니다.'
        )
        handleClose()
        onSuccess()
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(
          body?.error ||
            (isEn ? 'Failed to submit report.' : '시설 불편 신고 접수에 실패했습니다.')
        )
        return
      }

      toast.success(isEn ? 'Report submitted.' : '시설 불편 신고가 접수되었습니다.')
      onSuccess()
      handleClose()
    } catch {
      toast.error(isEn ? 'Network error. Please try again.' : '네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6 pr-14 text-left shrink-0">
          <DialogTitle className="font-black">
            {isEn ? 'Facility issue report' : '장소·시설 불편 신고'}
          </DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">
            {isEn
              ? 'Tell us what was uncomfortable about the venue or facilities for this session.'
              : '장소나 시설 관련 불편사항이 있었다면 피드백을 주세요!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5 overflow-y-auto flex-1">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              {isEn ? 'What was uncomfortable? *' : '어떤 점이 불편했나요? *'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isEn ? 'You may select multiple options.' : '※ 여러 항목 선택 가능'}
            </p>
            <div className="space-y-2">
              {FACILITY_REPORT_REASONS.map((r) => {
                const checked = selected.includes(r.value)
                return (
                  <label
                    key={r.value}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors',
                      checked
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleReason(r.value)}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span className="text-sm font-medium leading-snug">
                      {isEn ? r.labelEn : r.labelKo}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="facility-comment" className="text-sm font-semibold">
              {isEn ? 'Additional details (optional)' : '자유 의견 (선택)'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isEn
                ? 'Describe the situation in your own words if you would like.'
                : '불편했던 상황을 자유롭게 적어주세요.'}
            </p>
            <Textarea
              id="facility-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isEn
                  ? 'e.g. The AC blew directly on our table and it was too cold.'
                  : '예: 에어컨 바람이 테이블 쪽으로 직접 와서 너무 추웠어요.'
              }
              rows={4}
              maxLength={1000}
              className="min-h-24 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 px-6 py-4 sm:justify-end shrink-0">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            {isEn ? 'Cancel' : '취소'}
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={loading || selected.length === 0}
          >
            {loading
              ? isEn ? 'Submitting...' : '접수 중...'
              : isEn ? 'Submit report' : '신고 접수'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
