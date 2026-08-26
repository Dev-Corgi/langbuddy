'use client'

import { MainNav } from '@/app/_components/main-nav'
import { MyPageHeader } from '@/app/my/_components/my-page-header'
import { ScheduleCalendarCard } from '@/app/my/_components/schedule-calendar-card'
import { ApplicationsListCard } from '@/app/my/_components/applications-list-card'
import { SeatingHistoryCard } from '@/app/my/_components/seating-history-card'
import { useLocale } from '@/hooks/use-locale'
import { i18n } from '@/lib/i18n'
import { DEBUG_BASE_PATH } from '@/lib/debug/debug-base-path'
import {
  MOCK_USER,
  MOCK_MARKED_DATES,
  buildMockApplications,
  buildMockSeatingSessions,
} from '@/lib/debug/mock-data'

export default function DebugMyPage() {
  const locale = useLocale()
  const isEn = locale === 'en'
  const t = i18n[locale].myPage
  const applications = buildMockApplications(DEBUG_BASE_PATH)
  const seatingSessions = buildMockSeatingSessions()
  const weekLabels = isEn
    ? (['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const)
    : (['일', '월', '화', '수', '목', '금', '토'] as const)

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-12">
      <MainNav />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12">
        <MyPageHeader title={t.title} greeting={t.greeting} displayName={MOCK_USER.name} />

        <ScheduleCalendarCard
          title={t.calendarTitle}
          prevLabel={t.prevMonth}
          nextLabel={t.nextMonth}
          weekLabels={[...weekLabels]}
          markedDates={MOCK_MARKED_DATES}
          isEn={isEn}
        />

        <ApplicationsListCard
          title={t.applicationsTitle}
          emptyMessage={t.noApplications}
          isEn={isEn}
          applications={applications}
          labels={{
            categoryLe: t.categoryLe,
            categoryMeetup: t.categoryMeetup,
          }}
          locale={locale}
        />

        <SeatingHistoryCard
          title={t.seatingTitle}
          emptyMessage={t.noSeating}
          seatingDetail={t.seatingDetail}
          roundLabel={t.round}
          sessions={seatingSessions}
          isEn={isEn}
          hrefBase={DEBUG_BASE_PATH}
        />
      </main>
    </div>
  )
}
