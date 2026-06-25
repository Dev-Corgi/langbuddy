'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { MainNav } from '@/app/_components/main-nav'
import Image from 'next/image'
import { Calendar, MapPin, Share2, Info, Loader2, Clock, Wallet, User as UserIcon, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RecommendationSection } from '@/app/_components/recommendation-section'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useLocale } from '@/hooks/use-locale'
import { i18n } from '@/lib/i18n'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { NovelRenderer } from '@/components/admin/novel-renderer'

export default function PostingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const supabase = createClient()
  const locale = useLocale()
  const tDict = i18n[locale]
  
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    async function fetchData() {
      let query = supabase.from('postings').select('*')
      
      if (id === 'study') {
        query = query.eq('category', '스터디').is('day_of_week', null).order('created_at', { ascending: false }).limit(1)
      } else if (id === 'language') {
        query = query.eq('category', '언어교환').is('day_of_week', null).order('created_at', { ascending: false }).limit(1)
      } else {
        query = query.eq('id', id)
      }

      const { data: result, error } = await query.single()
      
      if (result) {
        // 언어교환 또는 스터디의 경우 활성화된 스케줄 가져오기
        if (result.category === '언어교환') {
          const { data: schedules } = await supabase
            .from('language_exchange_schedules')
            .select('*')
            .eq('posting_id', result.id)
            .eq('is_active', true)
            .order('day_of_week')
          
          if (schedules && schedules.length > 0) {
            result.recurring_days = schedules.map(s => s.day_of_week)
            result.is_recurring = true
          }
        } else if (result.category === '스터디') {
          const { data: schedules } = await supabase
            .from('study_schedules')
            .select('*')
            .eq('posting_id', result.id)
            .eq('is_active', true)
            .order('day_of_week')
          
          if (schedules && schedules.length > 0) {
            result.recurring_days = schedules.map(s => s.day_of_week)
            result.is_recurring = true
          }
        }
        setData(result)
      } else {
        setData(null)
      }
      setLoading(false)
    }

    fetchData()
  }, [id, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="mx-auto max-w-screen-2xl px-6 py-8 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
            {/* Left: Image */}
            <div className="lg:col-span-5">
              <Skeleton className="aspect-3/4 w-full rounded-[32px]" />
            </div>

            {/* Right: Content */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-10 w-full rounded-full" />
                <Skeleton className="h-10 w-full rounded-full" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-12 w-48" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-20">
            <Skeleton className="h-8 w-48 mb-8" />
            <div className="flex md:grid md:grid-cols-5 gap-5 md:gap-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="shrink-0 w-[170px] md:w-auto">
                  <Skeleton className="aspect-3/4 w-full rounded-2xl mb-5" />
                  <Skeleton className="h-5 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!loading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="mx-auto max-w-screen-2xl px-6 py-32 text-center">
          <h1 className="text-3xl font-black text-foreground">
            {locale === 'en' ? 'Posting Not Found' : '포스팅을 찾을 수 없습니다'}
          </h1>
          <p className="text-muted-foreground mt-4 font-medium">
            {locale === 'en' ? 'The posting you are looking for does not exist or has been removed.' : '찾으시는 포스팅이 존재하지 않거나 삭제되었습니다.'}
          </p>
          <Button asChild className="mt-8 rounded-2xl h-14 px-8 font-black">
            <Link href="/posting">{locale === 'en' ? 'Back to List' : '목록으로 돌아가기'}</Link>
          </Button>
        </main>
      </div>
    )
  }

  const handleApply = () => {
    // Study and Language Exchange categories always use the custom form
    if (data?.category === '스터디' || data?.category === '언어교환') {
      router.push(`/posting/${id}/apply`)
      return
    }

    if (data?.apply_type === 'link') {
      setIsModalOpen(true)
    } else if (data?.apply_type === 'form') {
      router.push(`/posting/${id}/apply`)
    } else {
      // Fallback for old data
      setIsModalOpen(true)
    }
  }

  const displayTitle = locale === 'en' && data?.title_en ? data.title_en : data?.title;
  const displayLocation = locale === 'en' && data?.location_en ? data.location_en : data?.location;
  const displayCost = locale === 'en' && data?.cost_en ? data.cost_en : data?.cost;
  const displayHost = locale === 'en' && data?.host_en ? data.host_en : data?.host;
  const displayContent =
    locale === 'en'
      ? (data?.rich_content_en || data?.description_en || data?.rich_content || data?.description || '')
      : (data?.rich_content || data?.description_ko || data?.description || '');

  const isLanguageExchange = data?.category === '언어교환';
  const isStudy = data?.category === '스터디';
  const isRecurringEvent = isLanguageExchange || isStudy;
  
  const displayDate = data?.is_recurring 
    ? (locale === 'en' 
        ? `Every ${data.recurring_days?.join(', ')}` 
        : `매주 ${data.recurring_days?.join(',')}`)
    : data?.date;
  
  const displayTime = isRecurringEvent 
    ? (locale === 'en' ? 'See application form' : '신청폼 참고')
    : data?.time;
  
  const displayLocationText = isRecurringEvent
    ? (locale === 'en' ? 'See application form' : '신청폼 참고')
    : displayLocation;

  const isStudyOrLanguage = data?.category === '스터디' || data?.category === '언어교환';
  const hasRecurringSettings = data?.is_recurring && data?.recurring_settings;

  return (
    <div className="min-h-screen bg-card">
      <MainNav activePrimaryLabel={data?.category} />
      
      <main className="mx-auto max-w-screen-2xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_400px] gap-12">
          {/* Left: Content */}
          <div className="space-y-10">
            <div className="relative aspect-video rounded-[32px] overflow-hidden border border-border shadow-xl">
              <Image 
                src={data?.image_url || "/imagebuttons/meetup.jpg"} 
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

                {isStudyOrLanguage && hasRecurringSettings && (
                  <div className="mt-6 p-6 rounded-[24px] bg-surface/20 border border-surface/50 space-y-4">
                    <h3 className="font-black text-secondary-foreground flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      {locale === 'en' ? 'Day-specific Schedule' : '요일별 상세 안내'}
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {Object.entries(data.recurring_settings).map(([day, settings]: [string, any]) => {
                        return (
                          <div key={day} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl bg-card border border-border gap-3 shadow-sm shadow-surface/10">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-black text-xs shrink-0">
                                {day}
                              </div>
                              <span className="font-bold text-foreground">{settings.location || displayLocation}</span>
                            </div>
                            {settings.languages && settings.languages.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {settings.languages.map((lang: string) => (
                                  <div className='flex items-center justify-center rounded-full bg-secondary'>
                                  <span key={lang} className="px-3 py-1 rounded-full bg-surface/30 text-secondary-foreground text-[11px] font-black uppercase tracking-wider">
                                    {lang}
                                  </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
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
              
              {/* Rich Content Area */}
              <div className="overflow-hidden">
                <NovelRenderer 
                  content={displayContent}
                  className="prose prose-zinc max-w-none prose-headings:font-black prose-p:font-medium prose-p:text-muted-foreground prose-img:rounded-[24px] prose-img:shadow-lg prose-img:max-w-full prose-img:h-auto [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-[24px]"
                />
              </div>
            </div>
          </div>

          {/* Right: Sticky Card */}
          <div className="hidden md:block">
            <div className="sticky top-32 space-y-6">
              <div className="border-black shadow-2xl rounded-[32px] p-8 space-y-8">
                <div className="space-y-4">
                  <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">{locale === 'en' ? 'Registration' : '참가 신청'}</div>
                </div>
                
                <div className="space-y-3">
                  <Button 
                    onClick={handleApply}
                    className="w-full h-16 rounded-2xl bg-primary hover:bg-secondary text-xl font-black shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                  >
                    {locale === 'en' ? 'Apply Now' : '지금 신청하기'}
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full h-16 rounded-2xl border-border text-muted-foreground font-bold hover:bg-surface/10 hover:text-primary hover:border-surface transition-all"
                  >
                    <Share2 className="w-5 h-5 mr-2" />
                    {locale === 'en' ? 'Share' : '공유하기'}
                  </Button>
                </div>

                <div className="flex gap-3 p-4 rounded-2xl bg-muted text-[13px] font-medium text-muted-foreground leading-snug">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
                  <p>{locale === 'en' ? 'Schedule is subject to change. Cancellation will be notified in advance.' : '모임 일정은 상황에 따라 변경될 수 있으며, 취소 시 사전 공지됩니다.'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Apply Button */}
        <div className="md:hidden mt-12 space-y-4">
          <Button 
            onClick={handleApply}
            className="w-full h-16 rounded-2xl bg-primary hover:bg-secondary text-xl font-black shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
          >
            {locale === 'en' ? 'Apply Now' : '지금 신청하기'}
          </Button>
          <div className="flex gap-3 p-4 rounded-2xl bg-muted text-[13px] font-medium text-muted-foreground leading-snug">
            <Info className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
            <p>{locale === 'en' ? 'Schedule is subject to change. Cancellation will be notified in advance.' : '모임 일정은 상황에 따라 변경될 수 있으며, 취소 시 사전 공지됩니다.'}</p>
          </div>
        </div>

        <div className="mt-20">
          <RecommendationSection excludeId={data?.id} />
        </div>
      </main>

      {/* Application Modal (using Sheet) */}
      <Sheet open={isModalOpen} onOpenChange={setIsModalOpen}>
        <SheetContent side="bottom" className="rounded-t-[32px] h-[400px] p-8">
          <SheetHeader>
            <SheetTitle className="text-2xl font-black text-primary">
              {locale === 'en' ? 'External Application' : '외부 신청 페이지'}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground font-medium">
              {locale === 'en' 
                ? 'This event uses an external form. Please click the button below to continue.' 
                : '이 이벤트는 외부 폼을 사용하여 신청을 받습니다. 아래 버튼을 눌러 이동해 주세요.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-10">
            <Button asChild className="w-full h-16 rounded-2xl bg-primary hover:bg-secondary text-xl font-black shadow-lg shadow-primary/20">
              <a href={data?.apply_link || '#'} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-6 h-6 mr-2" />
                {locale === 'en' ? 'Go to Application' : '신청하러 가기'}
              </a>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Card({ children, className, ...props }: any) {
  return (
    <div className={cn("bg-card border", className)} {...props}>
      {children}
    </div>
  )
}
