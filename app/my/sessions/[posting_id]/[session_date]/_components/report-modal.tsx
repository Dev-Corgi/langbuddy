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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { REPORT_REASONS, type ReportReason } from '@/lib/report-reasons'

export type { ReportReason }

type Props = {
  open: boolean
  onClose: () => void
  reportedUserId: string
  reportedName: string
  postingId: string
  sessionDate: string
  round: number
  isEn: boolean
  onSuccess: () => void
  /** UI-only: skip /api/reports */
  mockMode?: boolean
}

export function ReportModal({
  open,
  onClose,
  reportedUserId,
  reportedName,
  postingId,
  sessionDate,
  round,
  isEn,
  onSuccess,
  mockMode = false,
}: Props) {
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [otherText, setOtherText] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    setReason('')
    setOtherText('')
    setDescription('')
    onClose()
  }

  const handleSubmit = async () => {
    if (!reason) return

    const finalReason = reason === '기타' ? '기타' : reason
    const finalDescription =
      reason === '기타'
        ? [otherText, description].filter(Boolean).join('\n')
        : description

    if (reason === '기타' && !otherText.trim()) {
      toast.error(isEn ? 'Please describe the reason.' : '기타 사유를 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      if (mockMode) {
        await new Promise((r) => setTimeout(r, 400))
        toast.success(isEn ? 'Mock report — not saved.' : '목업 신고 — 저장되지 않습니다.')
        onSuccess()
        handleClose()
        return
      }

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId,
          reportedName,
          postingId,
          sessionDate,
          round,
          reason: finalReason,
          description: finalDescription || undefined,
        }),
      })

      if (res.status === 409) {
        toast.error(isEn ? 'You have already reported this person for this round.' : '이미 해당 라운드에 이 참가자를 신고한 기록이 있습니다.')
        handleClose()
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error || (isEn ? 'Failed to submit report.' : '신고 접수에 실패했습니다.'))
        return
      }

      toast.success(isEn ? 'Report submitted.' : '신고가 접수되었습니다.')
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
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6 pr-14 text-left">
          <DialogTitle className="font-black">
            {isEn ? 'Report participant' : '참가자 신고'}
          </DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">
            {isEn
              ? 'Reports are handled anonymously. Staff cannot see who submitted the report.'
              : '익명으로 처리되며 스텝들도 누가 신고했는지 알 수 없습니다.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="report-reason" className="text-sm font-semibold">
              {isEn ? 'Reason *' : '신고 사유 *'}
            </Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
              <SelectTrigger id="report-reason" className="w-full">
                <SelectValue placeholder={isEn ? 'Select a reason' : '사유를 선택하세요'} />
              </SelectTrigger>
              <SelectContent position="popper" className="z-60">
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {isEn ? r.labelEn : r.labelKo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === '기타' && (
            <div className="space-y-2">
              <Label htmlFor="report-other" className="text-sm font-semibold">
                {isEn ? 'Please describe *' : '직접 입력 *'}
              </Label>
              <Input
                id="report-other"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder={isEn ? 'Brief description of the reason' : '신고 사유를 간략히 입력하세요'}
                maxLength={200}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="report-description" className="text-sm font-semibold">
              {isEn ? 'Additional details (optional)' : '추가 내용 (선택)'}
            </Label>
            <Textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isEn
                  ? 'Describe what happened in more detail...'
                  : '구체적인 상황을 추가로 설명해주세요...'
              }
              rows={3}
              maxLength={1000}
              className="min-h-24 resize-none"
            />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {isEn
              ? 'False reports may result in account restrictions.'
              : '허위 신고 시 계정 이용이 제한될 수 있습니다.'}
          </p>
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            {isEn ? 'Cancel' : '취소'}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || !reason}
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
