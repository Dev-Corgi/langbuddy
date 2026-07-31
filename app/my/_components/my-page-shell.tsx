'use client'

import { usePathname } from 'next/navigation'
import { MainNav } from '@/app/_components/main-nav'
import { ApplyLoginModal } from '@/components/apply-login-modal'
import { useLocale } from '@/hooks/use-locale'
import { i18n } from '@/lib/i18n'
import { useMyPageData } from '../_hooks/use-my-page-data'
import { MyPageHeader } from './my-page-header'
import { ScheduleCalendarCard } from './schedule-calendar-card'
import { ApplicationsListCard } from './applications-list-card'
import { SeatingHistoryCard } from './seating-history-card'
import { MyPageLoadingSkeleton } from './my-page-loading-skeleton'

export function MyPageShell() {
  const locale = useLocale()
  const pathname = usePathname()
  const t = i18n[locale].myPage
  const isEn = locale === 'en'

  const { ready, user, userRow, showAuth, applications, seatingSessions, markedDates, reload } =
    useMyPageData(isEn)

  const greetingName = userRow?.name || user?.email?.split('@')[0] || ''

  const weekLabels = isEn
    ? (['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const)
    : (['일', '월', '화', '수', '목', '금', '토'] as const)

  if (showAuth && !user) {
    return (
      <div className="min-h-screen bg-muted">
        <MainNav />
        <ApplyLoginModal locale={locale} returnPath={pathname || '/my'} onAuthed={() => reload()} />
      </div>
    )
  }

  if (!ready) {
    return <MyPageLoadingSkeleton />
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-12">
      <MainNav />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12">
        <MyPageHeader title={t.title} greeting={t.greeting} displayName={greetingName} />

        <ScheduleCalendarCard
          title={t.calendarTitle}
          prevLabel={t.prevMonth}
          nextLabel={t.nextMonth}
          weekLabels={[...weekLabels]}
          markedDates={markedDates}
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
        />
      </main>
    </div>
  )
}
