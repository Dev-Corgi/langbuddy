'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MapPin, Share2, Info, Clock, User as UserIcon, ExternalLink } from 'lucide-react'
import { MainNav } from '@/app/_components/main-nav'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { NovelRenderer } from '@/components/admin/novel-renderer'
import { LanguageExchangeScheduleInfo } from '@/components/language-exchange-schedule-info'
import { buildSchedulesByDay } from '@/lib/language-exchange-schedule'
import { useLocale } from '@/hooks/use-locale'
import { i18n } from '@/lib/i18n'
import { DEBUG_BASE_PATH } from '@/lib/debug/debug-base-path'
import { getMockPostingById, MOCK_LE_SCHEDULES } from '@/lib/debug/mock-data'

export default function DebugPostingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const locale = useLocale()
  const tDict = i18n[locale]
  const [isModalOpen, setIsModalOpen] = useState(false)

  const data = useMemo(() => getMockPostingById(id), [id])
  const schedulesByDay = useMemo(() => {
    if (!data || data.category !== '언어교환') return {}
    return buildSchedulesByDay(MOCK_LE_SCHEDULES as any)
  }, [data])

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="mx-auto max-w-screen-2xl px-6 py-32 text-center">
          <h1 className="text-3xl font-black text-foreground">
            {locale === 'en' ? 'Posting Not Found' : '포스팅을 찾을 수 없습니다'}
          </h1>
          <Button asChild className="mt-8 rounded-2xl h-14 px-8 font-black">
            <Link href={`${DEBUG_BASE_PATH}/posting`}>
              {locale === 'en' ? 'Back to List' : '목록으로 돌아가기'}
            </Link>
          </Button>
        </main>
      </div>
    )
  }

  const handleApply = () => {
    if (data.category === '언어교환' || data.apply_type === 'form') {
      router.push(`${DEBUG_BASE_PATH}/posting/${id}/apply`)
      return
    }
    if (data.apply_type === 'link') {
      setIsModalOpen(true)
    }
  }

  const displayTitle = locale === 'en' && data.title_en ? data.title_en : data.title
  const displayLocation = locale === 'en' && data.location_en ? data.location_en : data.location
  const displayHost = locale === 'en' && data.host_en ? data.host_en : data.host
  const displayContent =
    locale === 'en'
      ? (data as any).rich_content_en || (data as any).description_en || (data as any).description || ''
      : (data as any).rich_content || (data as any).description_ko || (data as any).description || ''

  const isLanguageExchange = data.category === '언어교환'
  const displayDate = data.is_recurring
    ? locale === 'en'
      ? `Every ${(data.recurring_days || []).join(', ')}`
      : `매주 ${(data.recurring_days || []).join(',')}`
    : data.date
  const displayTime = isLanguageExchange
    ? locale === 'en'
      ? 'Varies by day'
      : '요일별 상이'
    : data.time
  const displayLocationText = isLanguageExchange
    ? locale === 'en'
      ? 'Varies by day'
      : '요일별 상이'
    : displayLocation
  const hasScheduleByDay = isLanguageExchange && Object.keys(schedulesByDay).length > 0

  return (
    <div className="min-h-screen bg-card">
      <MainNav activePrimaryLabel={data.category} />
      <main className="mx-auto max-w-screen-2xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_400px] gap-12">
          <div className="space-y-10">
            <div className="relative aspect-video rounded-[32px] overflow-hidden border border-border shadow-xl">
              <Image
                src={data.image_url || '/imagebuttons/meetup.jpg'}
                alt={displayTitle}
                fill
                className="object-cover"
              />
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl font-black text-foreground tracking-tight">{displayTitle}</h1>
                <div className="flex flex-wrap gap-x-8 gap-y-4 text-muted-foreground font-bold">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    {displayDate}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    {displayTime}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    {displayLocationText}
                  </div>
                </div>

                {hasScheduleByDay && (
                  <div className="mt-6">
                    <LanguageExchangeScheduleInfo
                      schedulesByDay={schedulesByDay}
                      days={data.recurring_days}
                      locale={locale}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 p-6 rounded-[24px] bg-muted border border-border">
                <div className="space-y-1">
                  <p className="text-xs font-black text-muted-foreground uppercase">{tDict.common.host}</p>
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-foreground" />
                    <p className="text-lg font-black text-foreground">{displayHost}</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-muted" />
              <div className="overflow-hidden">
                <NovelRenderer
                  content={displayContent}
                  className="prose prose-zinc max-w-none prose-headings:font-black prose-p:font-medium prose-p:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="sticky top-32 space-y-6">
              <div className="border-black shadow-2xl rounded-[32px] p-8 space-y-8">
                <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">
                  {locale === 'en' ? 'Registration' : '참가 신청'}
                </div>
                <div className="space-y-3">
                  <Button
                    onClick={handleApply}
                    className="w-full h-16 rounded-2xl bg-primary hover:bg-secondary text-xl font-black shadow-lg shadow-primary/20"
                  >
                    {locale === 'en' ? 'Apply Now' : '지금 신청하기'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-16 rounded-2xl border-border text-muted-foreground font-bold"
                  >
                    <Share2 className="w-5 h-5 mr-2" />
                    {locale === 'en' ? 'Share' : '공유하기'}
                  </Button>
                </div>
                <div className="flex gap-3 p-4 rounded-2xl bg-muted text-[13px] font-medium text-muted-foreground leading-snug">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
                  <p>
                    {locale === 'en'
                      ? 'Mock apply — nothing is saved.'
                      : '목업 신청 — 저장되지 않습니다.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden mt-12 space-y-4">
          <Button
            onClick={handleApply}
            className="w-full h-16 rounded-2xl bg-primary hover:bg-secondary text-xl font-black"
          >
            {locale === 'en' ? 'Apply Now' : '지금 신청하기'}
          </Button>
        </div>
      </main>

      <Sheet open={isModalOpen} onOpenChange={setIsModalOpen}>
        <SheetContent side="bottom" className="rounded-t-[32px] h-[400px] p-8">
          <SheetHeader>
            <SheetTitle className="text-2xl font-black text-primary">
              {locale === 'en' ? 'External Application' : '외부 신청 페이지'}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground font-medium">
              {locale === 'en'
                ? 'Debug mock — external form link is not opened for real.'
                : '디버그 목업 — 외부 폼은 실제로 열리지 않습니다.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-10">
            <Button
              className="w-full h-16 rounded-2xl bg-primary text-xl font-black"
              onClick={() => setIsModalOpen(false)}
            >
              <ExternalLink className="w-6 h-6 mr-2" />
              {locale === 'en' ? 'Close (mock)' : '닫기 (목업)'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
