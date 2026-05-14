'use client'

import { BookOpen, Languages } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

export type QrScannerMode = 'study' | 'lang'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (mode: QrScannerMode) => void
  studyAvailable: boolean
  langAvailable: boolean
}

export function QrScannerModeSheet({
  open,
  onOpenChange,
  onSelect,
  studyAvailable,
  langAvailable,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl gap-0 p-0 max-h-[90dvh]">
        <SheetHeader className="px-5 pt-6 pb-4 text-left border-b">
          <SheetTitle className="text-lg font-black">모임 종류</SheetTitle>
          <SheetDescription>
            스캔할 QR이 스터디인지 언어교환인지 선택해 주세요.
          </SheetDescription>
        </SheetHeader>
        <div className="p-5 flex flex-col gap-3">
          <Button
            type="button"
            variant={studyAvailable ? 'default' : 'secondary'}
            disabled={!studyAvailable}
            className="h-16 rounded-2xl font-black text-base justify-start gap-3 px-5"
            onClick={() => {
              onSelect('study')
              onOpenChange(false)
            }}
          >
            <BookOpen className="size-6 shrink-0" />
            스터디 모임
          </Button>
          <Button
            type="button"
            variant={langAvailable ? 'default' : 'secondary'}
            disabled={!langAvailable}
            className="h-16 rounded-2xl font-black text-base justify-start gap-3 px-5"
            onClick={() => {
              onSelect('lang')
              onOpenChange(false)
            }}
          >
            <Languages className="size-6 shrink-0" />
            언어교환 모임
          </Button>
          {!studyAvailable && (
            <p className="text-xs text-muted-foreground font-bold px-1">
              오늘 활성화된 스터디 일정이 없습니다.
            </p>
          )}
          {!langAvailable && (
            <p className="text-xs text-muted-foreground font-bold px-1">
              오늘 활성화된 언어교환 일정이 없습니다.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
