'use client'

import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

type StudyPayload = {
  variant: 'study'
  name: string
  language: string
  drink: string
}

type LangPayload = {
  variant: 'lang'
  name: string
 /** 한국인 / 외국인 등 */
  nationalityLabel: string
  language: string
  drink: string
  tableUndecided: boolean
  tableLabel: string | null
}

export type QrScanResultSheetPayload = StudyPayload | LangPayload

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: QrScanResultSheetPayload | null
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-border/80 last:border-0">
      <span className="text-sm font-bold text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-black text-right break-words">{value || '—'}</span>
    </div>
  )
}

export function QrScanResultSheet({ open, onOpenChange, payload }: Props) {
  const handleContinue = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl gap-0 p-0 max-h-[92dvh] flex flex-col"
        showCloseButton
      >
        <SheetHeader className="px-5 pt-6 pb-2 text-left shrink-0">
          <SheetTitle className="text-lg font-black">스캔 결과</SheetTitle>
        </SheetHeader>

        <div className="px-5 flex-1 overflow-y-auto pb-4">
          {payload?.variant === 'lang' && (
            <div className="mb-6 rounded-2xl bg-muted/50 p-5 space-y-2 text-center border-2 border-primary/20">
              <p className="text-xs font-black text-muted-foreground tracking-wide">테이블</p>
              {payload.tableUndecided || !payload.tableLabel ? (
                <p className="text-5xl sm:text-6xl font-black text-primary leading-tight py-2">
                  미정
                </p>
              ) : (
                <p className="text-5xl sm:text-6xl font-black text-primary leading-tight py-2">
                  {payload.tableLabel}
                </p>
              )}
            </div>
          )}

          {payload?.variant === 'study' && (
            <>
              <InfoRow label="이름" value={payload.name} />
              <InfoRow label="언어" value={payload.language} />
              <InfoRow label="음료" value={payload.drink} />
            </>
          )}

          {payload?.variant === 'lang' && (
            <>
              <InfoRow label="이름" value={payload.name} />
              <InfoRow label="한국인/외국인" value={payload.nationalityLabel} />
              <InfoRow label="선택 언어" value={payload.language} />
              <InfoRow label="음료" value={payload.drink} />
            </>
          )}
        </div>

        <SheetFooter className="p-5 pt-2 border-t bg-background shrink-0">
          <Button
            type="button"
            className="w-full h-14 rounded-2xl font-black text-base"
            onClick={handleContinue}
          >
            다음 스캔
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
