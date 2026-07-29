'use client'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { AdminCheckinModalPayload } from '@/lib/admin-checkin-display'

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
  const tableDisplay =
    payload?.tableUndecided || !payload?.tableLabel
      ? '미정'
      : payload.tableLabel

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
              <InfoRow label="선택 음료" value={payload.drink} />
              {payload.showTable === false && (
                <InfoRow label="배치된 자리" value="—" />
              )}
            </div>
          )}

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
