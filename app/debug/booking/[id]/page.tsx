'use client'

import { useMemo, useState, useEffect } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/hooks/use-locale'
import { i18n } from '@/lib/i18n'
import { DEBUG_BASE_PATH } from '@/lib/debug/debug-base-path'
import { getMockPostingById } from '@/lib/debug/mock-data'
import { toast } from 'sonner'

export default function DebugBookingPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const locale = useLocale()
  const tDict = i18n[locale]
  const [selectedDate, setSelectedDate] = useState<number>(24)
  const [isMobile, setIsMobile] = useState(false)
  const data = useMemo(() => getMockPostingById(id) || getMockPostingById('debug-meetup-1'), [id])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-black">
          {locale === 'en' ? 'Session Information Not Found' : '모임 정보를 찾을 수 없습니다'}
        </h1>
        <Button onClick={() => router.push(DEBUG_BASE_PATH)} className="mt-8 rounded-2xl h-12 px-8 font-black">
          {locale === 'en' ? 'Go Back' : '뒤로 가기'}
        </Button>
      </div>
    )
  }

  const displayTitle = locale === 'en' && data.title_en ? data.title_en : data.title
  const displayLocation = locale === 'en' && data.location_en ? data.location_en : data.location
  const days = Array.from({ length: 28 }, (_, i) => i + 1)
  const weekDays =
    locale === 'en'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push(`${DEBUG_BASE_PATH}/posting/${data.id}`)}
            className="flex items-center gap-1 text-sm font-bold text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            {locale === 'en' ? 'Back' : '뒤로'}
          </button>
          <button type="button" onClick={() => router.push(DEBUG_BASE_PATH)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="relative aspect-video rounded-3xl overflow-hidden border border-border">
            <Image
              src={data.image_url || '/imagebuttons/meetup.jpg'}
              alt={displayTitle}
              fill
              className="object-cover"
            />
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-black">{displayTitle}</h1>
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <Info className="w-4 h-4" />
              {displayLocation}
            </p>
            <p className="text-xs text-amber-700 font-bold">
              {locale === 'en' ? 'Debug booking UI — no reservation saved.' : '디버그 예약 UI — 예약은 저장되지 않습니다.'}
            </p>

            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <button type="button" className="p-1">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-black">2026. 09</span>
                <button type="button" className="p-1">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground mb-2">
                {weekDays.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={cn(
                      'h-9 rounded-lg text-sm font-bold',
                      selectedDate === d
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-foreground'
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full h-14 rounded-2xl font-black"
              onClick={() =>
                toast.success(
                  locale === 'en'
                    ? `Mock book day ${selectedDate}`
                    : `목업 예약: ${selectedDate}일`
                )
              }
            >
              {locale === 'en' ? 'Book (mock)' : '예약하기 (목업)'}
            </Button>
            {!isMobile && (
              <p className="text-[11px] text-muted-foreground">
                {tDict.common?.host || 'LangBuddy'} mock calendar
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
