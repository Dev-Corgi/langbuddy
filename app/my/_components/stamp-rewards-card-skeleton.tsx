import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function StampRewardsCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-[280px]" />
      </CardHeader>
      <CardContent className="space-y-5">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  )
}
