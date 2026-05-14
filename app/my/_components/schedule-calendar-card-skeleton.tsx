import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function ScheduleCalendarCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <Skeleton className="h-9 w-[120px] shrink-0 rounded-lg" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="mx-auto h-4 w-6" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, di) => (
              <Skeleton key={di} className="h-9 rounded-md" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
