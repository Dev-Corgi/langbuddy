import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STAMPS_PER_COUPON } from '@/lib/early-application-rewards'

type Props = {
  count: number
  compact?: boolean
  className?: string
}

export function RewardStampRow({ count, compact = false, className }: Props) {
  const safeCount = Math.max(0, Math.min(STAMPS_PER_COUPON, count))

  return (
    <div className={cn('grid grid-cols-10 gap-1.5', className)} aria-label={`${safeCount}/${STAMPS_PER_COUPON}`}>
      {Array.from({ length: STAMPS_PER_COUPON }, (_, index) => {
        const filled = index < safeCount
        return (
          <span
            key={index}
            className={cn(
              'flex aspect-square items-center justify-center rounded-full border font-black transition-colors',
              compact ? 'min-w-4 text-[8px]' : 'min-w-6 text-[10px]',
              filled
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background text-muted-foreground/40'
            )}
          >
            {filled ? <Check className={compact ? 'size-2.5' : 'size-3'} strokeWidth={3} /> : index + 1}
          </span>
        )
      })}
    </div>
  )
}
