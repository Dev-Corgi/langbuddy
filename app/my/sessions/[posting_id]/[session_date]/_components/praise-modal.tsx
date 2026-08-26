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
import { PRAISE_REASONS, type PraiseReason } from '@/lib/praise-reasons'

type Props = {
  open: boolean
  onClose: () => void
  praisedUserId: string
  praisedName: string
  postingId: string
  sessionDate: string
  round: number
  isEn: boolean
  onSuccess: () => void
  mockMode?: boolean
}

export function PraiseModal({
  open,
  onClose,
  praisedUserId,
  praisedName,
  postingId,
  sessionDate,
  round,
  isEn,
  onSuccess,
  mockMode = false,
}: Props) {
  const [selected, setSelected] = useState<PraiseReason[]>([])
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    setSelected([])
    setComment('')
    onClose()
  }

  const toggleReason = (value: PraiseReason) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  const handleSubmit = async () => {
    if (selected.length === 0) {
      toast.error(
        isEn ? 'Please select at least one option.' : '칭찬 항목을 하나 이상 선택해주세요.'
      )
      return
    }

    setLoading(true)
    try {
      if (mockMode) {
        await new Promise((r) => setTimeout(r, 400))
        toast.success(isEn ? 'Mock praise — not saved.' : '목업 칭찬 — 저장되지 않습니다.')
        onSuccess()
        handleClose()
        return
      }

      const res = await fetch('/api/praises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          praisedUserId,
          praisedName,
          postingId,
          sessionDate,
          round,
          reasons: selected,
          comment: comment.trim() || undefined,
        }),
      })

      if (res.status === 409) {
        toast.error(
          isEn
            ? 'You have already praised this person for this round.'
            : '이미 해당 라운드에 이 참가자를 칭찬한 기록이 있습니다.'
        )
        handleClose()
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(
          body?.error || (isEn ? 'Failed to submit praise.' : '칭찬 접수에 실패했습니다.')
        )
        return
      }

      toast.success(isEn ? 'Praise submitted.' : '칭찬이 접수되었습니다.')
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
            {isEn ? 'Praise participant' : '멤버 칭찬하기'}
          </DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">
            {isEn
              ? `Share what you appreciated about "${praisedName}". Your praise is handled anonymously.`
              : `"${praisedName}"님의 어떤 점이 좋았는지 알려주세요. 익명으로 처리됩니다.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5 overflow-y-auto flex-1">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              {isEn ? 'What would you like to praise? *' : '어떤 점을 칭찬하고 싶나요? *'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isEn ? 'You may select multiple options.' : '※ 여러 항목 선택 가능'}
            </p>
            <div className="space-y-2">
              {PRAISE_REASONS.map((r) => {
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
            <Label htmlFor="praise-comment" className="text-sm font-semibold">
              {isEn ? 'Additional comments (optional)' : '자유 의견 (선택)'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isEn
                ? 'Feel free to share more details if you would like.'
                : '더 자세히 남기고 싶다면 자유롭게 작성해주세요.'}
            </p>
            <Textarea
              id="praise-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isEn
                  ? 'e.g. They helped newcomers feel comfortable by starting conversations first!'
                  : '예: 처음 참여한 사람들에게 먼저 말을 걸어줘서 덕분에 편하게 참여할 수 있었어요!'
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
              : isEn ? 'Submit praise' : '칭찬하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
