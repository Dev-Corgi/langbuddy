import { Ticket } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  hint: string
  couponsLabel: string
  couponCountLabel: string
  stampSlots: number
  filled: number
  coupons: number
}

export function StampRewardsCard({
  title,
  hint,
  couponsLabel,
  couponCountLabel,
  stampSlots,
  filled,
  coupons,
}: Props) {
  const progressPct = Math.min(100, Math.round((filled / stampSlots) * 100))

  return (
    <Card className="h-full border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Ticket className="size-5 text-primary" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>
              {filled} / {stampSlots}
            </span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: stampSlots }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition-colors',
                i < filled
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-muted/50 text-muted-foreground'
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <p className="text-sm font-semibold text-foreground">
          {couponsLabel}: <span className="text-primary">{coupons}</span> {couponCountLabel}
        </p>
      </CardContent>
    </Card>
  )
}
