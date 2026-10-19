import { MainNav } from '@/app/_components/main-nav'
import { MyPageHeaderSkeleton } from './my-page-header-skeleton'
import { ScheduleCalendarCardSkeleton } from './schedule-calendar-card-skeleton'
import { ApplicationsListCardSkeleton } from './applications-list-card-skeleton'
import { SeatingHistoryCardSkeleton } from './seating-history-card-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export function MyPageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-12">
      <MainNav />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12">
        <MyPageHeaderSkeleton />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <ScheduleCalendarCardSkeleton />
        <ApplicationsListCardSkeleton />
        <SeatingHistoryCardSkeleton />
      </main>
    </div>
  )
}
