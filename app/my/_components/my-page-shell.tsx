'use client'

import { usePathname } from 'next/navigation'
import { MainNav } from '@/app/_components/main-nav'
import { ApplyLoginModal } from '@/components/apply-login-modal'
import { useLocale } from '@/hooks/use-locale'
import { i18n } from '@/lib/i18n'
import { useMyPageData } from '../_hooks/use-my-page-data'
import { MyPageHeader } from './my-page-header'
import { StampRewardsCard } from './stamp-rewards-card'
import { ScheduleCalendarCard } from './schedule-calendar-card'
import { ApplicationsListCard } from './applications-list-card'
import { SeatingHistoryCard } from './seating-history-card'
import { MyPageLoadingSkeleton } from './my-page-loading-skeleton'

export function MyPageShell() {
  const locale = useLocale()
  const pathname = usePathname()
  const t = i18n[locale].myPage
  const isEn = locale === 'en'

  const { ready, user, userRow, showAuth, applications, seatingHistory, markedDates, reload } =
    useMyPageData(isEn)

  const greetingName = userRow?.name || user?.email?.split('@')[0] || ''
  const stampSlots = 10
  const stampFill = Math.min(stampSlots, Number(userRow?.le_stamp_progress ?? 0))

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

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 lg:items-stretch">
          <StampRewardsCard
            title={t.stampTitle}
            hint={t.stampHint}
            stampSlots={stampSlots}
            filled={stampFill}
          />
          <ScheduleCalendarCard
            title={t.calendarTitle}
            prevLabel={t.prevMonth}
            nextLabel={t.nextMonth}
            weekLabels={[...weekLabels]}
            markedDates={markedDates}
            isEn={isEn}
          />
        </div>

        <ApplicationsListCard
          title={t.applicationsTitle}
          emptyMessage={t.noApplications}
          isEn={isEn}
          applications={applications}
          labels={{
            categoryLe: t.categoryLe,
            categoryStudy: t.categoryStudy,
            categoryMeetup: t.categoryMeetup,
          }}
          locale={locale}
        />

        <SeatingHistoryCard
          title={t.seatingTitle}
          emptyMessage={t.noSeating}
          roundLabel={t.round}
          tableLabel={t.table}
          withLabel={t.with}
          history={seatingHistory}
          isEn={isEn}
        />
      </main>
    </div>
  )
}
