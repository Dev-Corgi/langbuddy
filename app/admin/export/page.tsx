'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useLocale } from '@/hooks/use-locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Download, Share2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toPng } from 'html-to-image'
import download from 'downloadjs'
import { useAdminAuth } from '@/hooks/use-admin-auth'

interface Event {
  id: string
  title: string
  title_en: string
  subtitle: string
  subtitle_en: string
  date: string
  time: string
  location: string
  location_en: string
  category: string
  image_url: string
}

export default function ExportPosterPage() {
  const locale = useLocale()
  const { ready: authReady } = useAdminAuth({ requireSuper: true })
  const supabase = createClient()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const koPosterRef = useRef<HTMLDivElement>(null)
  const enPosterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true)
      const now = new Date().toISOString().split('T')[0]
      
      // Fetch upcoming events sorted by date
      const { data, error } = await supabase
        .from('postings')
        .select('*')
        .eq('category', '번개')
        .eq('status', 'active')
        .neq('date', '미정')
        .gte('date', now)
        .order('date', { ascending: true })
        .limit(5)

      if (data) {
        setEvents(data as Event[])
      }
      setLoading(false)
    }
    fetchEvents()
  }, [supabase])

  const handleExport = async () => {
    if (!koPosterRef.current || !enPosterRef.current) return
    setExporting(true)

    try {
      const today = new Date().toISOString().split('T')[0]
      
      // Export Korean version
      const koDataUrl = await toPng(koPosterRef.current, { quality: 0.95, pixelRatio: 2 })
      download(koDataUrl, `langbuddy-poster-ko-${today}.png`)

      // Export English version
      const enDataUrl = await toPng(enPosterRef.current, { quality: 0.95, pixelRatio: 2 })
      download(enDataUrl, `langbuddy-poster-en-${today}.png`)
    } catch (err) {
      console.error('Export failed:', err)
      alert('포스터 생성 중 오류가 발생했습니다.')
    } finally {
      setExporting(false)
    }
  }

  if (!authReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  
  const formatDateRange = () => {
    const start = `${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
    const end = `${String(nextWeek.getMonth() + 1).padStart(2, '0')}.${String(nextWeek.getDate()).padStart(2, '0')}`
    return `${start} - ${end}`
  }

  const formatYearMonth = () => {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
    return `${months[today.getMonth()]} ${today.getFullYear()}`
  }

  const colors = [
    'bg-[#a31a1a]', // Primary Red-ish (oklch(0.432 0.272 29.2))
    'bg-[#e9d5c3]', // Secondary Beige (oklch(0.92 0.035 29.2))
    'bg-[#a31a1a]', // Repeat primary for consistency or use variants
    'bg-[#e9d5c3]',
    'bg-[#a31a1a]',
  ]

  const PosterTemplate = ({ lang }: { lang: 'ko' | 'en' }) => {
    return (
      <div 
        className="w-[640px] h-[900px] bg-[#fdfcfb] p-10 flex flex-col font-sans relative text-primary"
        style={{ 
          boxShadow: '0 0 20px rgba(0,0,0,0.1)',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-baseline border-b-2 border-[#a31a1a] pb-3 mb-8">
          <div className="text-2xl font-black text-[#a31a1a]">{"LANGBUDDY"}</div>
          <div className="text-2xl font-black uppercase tracking-tighter text-[#a31a1a]">{formatYearMonth()}</div>
        </div>

        <div className="flex flex-1 gap-8 overflow-hidden">
          {/* Vertical Text */}
          <div className="[writing-mode:vertical-lr] rotate-180 flex items-center justify-center shrink-0">
            <h1 className="text-[4.25rem] font-black tracking-tight uppercase whitespace-nowrap text-[#a31a1a]">
              UPCOMING EVENTS
            </h1>
          </div>

          {/* Events List */}
          <div className="flex-1 flex flex-col gap-5 min-w-0">
            {events.map((event, idx) => {
              const dateObj = new Date(event.date)
              const dayNames = lang === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
              const dayName = dayNames[dateObj.getDay()]
              const dayNum = dateObj.getDate()
              const [startTime, endTime] = (event.time || '').split(' ~ ')
              const isPrimary = idx % 2 === 0

              return (
                <div key={event.id} className="flex gap-4 h-[125px]">
                  {/* Date Box */}
                  <div className={cn(
                    "w-[90px] rounded-[32px] flex flex-col items-center justify-center shrink-0 transition-colors bg-[#a31a1a] text-white"
                  )}>
                    <div className="text-lg font-black leading-none uppercase mb-1">{dayName}</div>
                    <div className="text-3xl font-black">{dayNum}</div>
                  </div>

                  {/* Content Box (Carousel Style) */}
                  <div className="flex-1 border-2 border-[#a31a1a] rounded-[32px] flex flex-col justify-center relative min-w-0 overflow-hidden group">
                    {/* Background Image */}
                    {event.image_url ? (
                      <img 
                        src={event.image_url} 
                        alt="" 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[#e9d5c3]/30" />
                    )}
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-linear-to-r from-[#a31a1a] via-[#a31a1a]/60 to-transparent" />
                    
                    {/* Text Content */}
                    <div className="relative z-10 px-6 py-4 flex flex-col justify-center">
                      <p className="text-xs font-medium text-white/90 uppercase tracking-wider mb-1 line-clamp-1">
                        {lang === 'en' ? (event.subtitle_en || event.subtitle) : event.subtitle}
                      </p>
                      <h3 className="text-xl font-bold text-white leading-tight break-keep line-clamp-2 drop-shadow-sm">
                        {lang === 'en' ? (event.title_en || event.title) : event.title}
                      </h3>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t-2 border-[#a31a1a] flex justify-between items-end text-xs font-black text-[#a31a1a]">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]">INSTA</span> @langbuddy_official
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]">WEB</span> https://langbuddy-club.vercel.app/
            </div>
          </div>
          <div className="text-right uppercase leading-tight tracking-tight">
            LEARN LANGUAGES,<br />
            <span className="text-[#a31a1a]">MAKE FRIENDS!</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted p-4 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/admin/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors mb-2 text-sm">
              <ChevronLeft className="w-4 h-4" />
              {locale === 'en' ? 'Dashboard' : '대시보드'}
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
              <Share2 className="w-8 h-8 text-primary" />
              {locale === 'en' ? 'Export Poster' : '포스터 내보내기'}
            </h1>
            <p className="text-muted-foreground font-medium text-sm md:text-base">
              {locale === 'en' 
                ? 'Generate a poster of upcoming events to share on social media.' 
                : '다가오는 이벤트를 요약한 포스터를 생성하여 SNS에 공유하세요.'}
            </p>
          </div>
          <Button 
            onClick={handleExport} 
            disabled={exporting || events.length === 0}
            className="bg-primary hover:bg-secondary rounded-2xl h-14 px-8 font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 w-full md:w-auto transition-all active:scale-[0.98]"
          >
            {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {locale === 'en' ? 'Download Both Posters' : '두 버전 모두 다운로드'}
          </Button>
        </div>

        {events.length === 0 ? (
          <Card className="border-dashed border-2 border-border bg-transparent rounded-[32px]">
            <CardContent className="py-20 text-center">
              <p className="font-bold text-muted-foreground">
                {locale === 'en' ? 'No upcoming events found.' : '다가오는 이벤트가 없습니다.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-start">
            {/* Preview KO */}
            <div className="space-y-4">
              <h2 className="text-xl font-black text-center">{locale === 'en' ? 'Korean Version' : '한국어 버전 프리뷰'}</h2>
              <div className="flex justify-center">
                <div ref={koPosterRef}>
                  <PosterTemplate lang="ko" />
                </div>
              </div>
            </div>

            {/* Preview EN */}
            <div className="space-y-4">
              <h2 className="text-xl font-black text-center">{locale === 'en' ? 'English Version' : '영어 버전 프리뷰'}</h2>
              <div className="flex justify-center">
                <div ref={enPosterRef}>
                  <PosterTemplate lang="en" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
