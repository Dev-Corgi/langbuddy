'use client'

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronDown, ArrowUpDown, Loader2, Calendar, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase"
import { useLocale } from "@/hooks/use-locale"
import { i18n } from "@/lib/i18n"

export function PostingList() {
  const locale = useLocale()
  const t = i18n[locale]
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchPostings() {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('postings')
        .select('*')
        .eq('category', '번개')
        .eq('status', 'active')
        .or(`deadline.is.null,deadline.gt.${now}`)
      
      if (data) setItems(data)
      setLoading(false)
    }
    fetchPostings()
  }, [supabase])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const getDdayValue = (item: any) => {
        if (item.is_recurring) return 2000 // 매주 반복은 미정 뒤로
        if (!item.date || item.date === '미정' || item.is_date_undecided) return 1000 // 일시 미정
        
        const targetDate = new Date(item.date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const diffTime = targetDate.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (diffDays < 0) return 3000 + Math.abs(diffDays) // 지난 일정은 가장 뒤로
        return diffDays // 오늘(0)부터 미래순
      }
      return getDdayValue(a) - getDdayValue(b)
    })
  }, [items])

  const calculateDday = (dateStr: string) => {
    if (!dateStr || dateStr === '미정') return null
    const targetDate = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'D-Day'
    if (diffDays > 0) return `D-${diffDays}`
    return null
  }

  if (loading) {
    return (
      <section className="w-full">
        <div className="flex items-center gap-2 mb-6 px-4 md:px-0">
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-x-6 gap-y-10 px-4 md:px-0">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="group relative">
              <Skeleton className="aspect-3/4 w-full rounded-[24px]" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-2 mt-3">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-32 text-center border-2 border-dashed border-border rounded-[40px] bg-muted/30">
        <p className="text-xl font-black text-muted-foreground">
          {locale === 'en' ? 'No lightning meetings available.' : '등록된 번개 모임이 없습니다.'}
        </p>
      </div>
    )
  }

  return (
    <section className="w-full">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 px-4 md:px-0">
        <button className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-sm font-medium bg-card hover:bg-accent transition-colors">
          <ArrowUpDown className="w-3.5 h-3.5" />
          오픈순
        </button>
      </div>

      {/* Grid for Desktop / List for Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-x-6 gap-y-10 px-4 md:px-0">
        {sortedItems.map((item) => {
          const dDay = calculateDday(item.date)
          return (
            <div key={item.id}>
              <Link href={`/posting/${item.id}`} className="group cursor-pointer">
                {/* Mobile: Horizontal Layout / Desktop: Vertical Layout */}
                <div className="flex md:flex-col gap-4 md:gap-0">
                  {/* Poster Image */}
                  <div className="relative w-[120px] md:w-full aspect-3/4 rounded-[20px] overflow-hidden shrink-0 border border-border shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-1 group-hover:border-primary/20">
                    <Image
                      src={item.image_url || "/postingpage/imgi_5_26001991_p.gif"}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {dDay && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-background/80 backdrop-blur-md text-foreground text-[11px] font-black tracking-tight z-10 border border-border/50">
                        {dDay}
                      </div>
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="flex flex-col md:mt-4 min-w-0 flex-1 gap-1.5">
                    {/* 1. D-Day Row */}
                    <div className="h-6 flex items-center">
                      {dDay ? (
                        <span className="text-primary font-black text-[13px] md:text-sm uppercase tracking-tight">
                          {dDay}
                        </span>
                      ) : item.is_recurring ? (
                        <span className="text-emerald-500 font-black text-[13px] md:text-sm uppercase tracking-tight">
                          {locale === 'en' ? 'Every Week' : '매주 반복'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-black text-[13px] md:text-sm uppercase tracking-tight">
                          {locale === 'en' ? 'TBD' : '일시 미정'}
                        </span>
                      )}
                    </div>

                    {/* 2. Date Row */}
                    <div className="flex items-center gap-2 text-foreground/70">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="font-bold text-[13px] md:text-sm tracking-tight">
                        {item.is_recurring 
                          ? (locale === 'en' ? `Every ${item.recurring_days?.join(', ')}` : `매주 ${item.recurring_days?.join(', ')}`)
                          : (item.is_date_undecided || !item.date || item.date === '미정' ? (locale === 'en' ? 'Date Undecided' : '날짜 미정') : item.date)
                        }
                      </span>
                    </div>

                    {/* 3. Time Row */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4 text-muted-foreground/70" />
                      <span className="font-medium text-[13px] md:text-sm tracking-tight">
                        {item.is_time_undecided || !item.time || item.time === '미정' 
                          ? (locale === 'en' ? 'Time TBD' : '시간 미정')
                          : item.time
                        }
                      </span>
                    </div>
                    
                    {/* 4. Title Row */}
                    <h3 className="mt-1 text-[16px] md:text-[18px] font-black text-foreground line-clamp-2 leading-[1.3] tracking-tight group-hover:text-primary transition-colors">
                      {locale === 'en' && item.title_en ? item.title_en : item.title}
                    </h3>
                    
                    {/* 5. Additional Info Row */}
                    <div className="mt-2 space-y-1">
                      <p className="text-[13px] md:text-sm text-muted-foreground font-medium line-clamp-1">
                        {locale === 'en' && item.location_en ? item.location_en : item.location}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] md:text-[15px] text-primary font-black">
                          {item.cost || (locale === 'en' ? 'Free' : '무료')}
                        </span>
                        {item.max_participants && (
                          <span className="text-xs text-muted-foreground/60 font-medium">
                            | {locale === 'en' ? 'Max' : '최대'} {item.max_participants.toString().replace(/명/g, '')}{locale === 'en' ? '' : '명'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              {/* Mobile Divider */}
              <div className="mt-6 border-b border-border md:hidden" />
            </div>
          )
        })}
      </div>
    </section>
  )
}
