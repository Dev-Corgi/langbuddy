import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

export function ApplicationsListCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            {i > 0 ? <Separator className="my-3" /> : null}
            <div className="space-y-3 px-3 py-3">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4 max-w-md" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
