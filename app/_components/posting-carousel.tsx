'use client'

import { useState, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionHeader } from "./section-header"
import { createClient } from "@/lib/supabase"
import { useLocale } from "@/hooks/use-locale"
import { i18n } from "@/lib/i18n"
import { PostingInfo } from "./posting-info"

export function PostingCarousel() {
  const locale = useLocale()
  const t = i18n[locale]
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartXRef = useRef<number | null>(null)
  const touchDeltaXRef = useRef(0)
  const supabase = createClient()

  useEffect(() => {
    async function fetchPostings() {
      const now = new Date().toISOString()
      const { data } = await supabase
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
        if (item.is_recurring) return 2000
        if (!item.date || item.date === '미정' || item.is_date_undecided) return 1000
        
        const targetDate = new Date(item.date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const diffTime = targetDate.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (diffDays < 0) return 3000 + Math.abs(diffDays)
        return diffDays
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

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const paginate = (newDirection: number) => {
    const itemsToShow = isMobile ? 1 : 3
    if (items.length <= itemsToShow) return
    const maxIndex = items.length - itemsToShow
    
    setIndex((prev) => {
      const next = prev + newDirection
      if (next < 0) return 0
      if (next > maxIndex) return maxIndex
      return next
    })
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return
    touchStartXRef.current = e.touches[0].clientX
    touchDeltaXRef.current = 0
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || touchStartXRef.current === null) return
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current
  }

  const onTouchEnd = () => {
    if (!isMobile || touchStartXRef.current === null) return
    const deltaX = touchDeltaXRef.current
    touchStartXRef.current = null

    if (deltaX > 50) {
      paginate(-1)
    } else if (deltaX < -50) {
      paginate(1)
    }
  }

  if (loading) return (
    <section className="w-full">
      <SectionHeader title={locale === 'en' ? 'Upcoming Meetups' : '오픈 예정 모임'} className="px-4 xl:px-0" />
      <div className="flex gap-4 md:gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="shrink-0 w-full md:w-[calc(33.333%-16px)]">
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

  if (items.length === 0) return (
    <div className="py-20 text-center bg-muted/50 rounded-[32px] border-2 border-dashed border-border">
      <p className="font-bold text-muted-foreground">
        {locale === 'en' ? 'No postings available.' : '등록된 포스팅이 없습니다.'}
      </p>
    </div>
  )

  return (
    <section className="w-full">
      <SectionHeader title={locale === 'en' ? 'Upcoming Meetups' : '오픈 예정 모임'} className="px-4 xl:px-0" />
      
      <div className="relative group/controls">
        <div 
          ref={containerRef} 
          className="overflow-hidden relative"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <motion.div
            className="flex gap-4 md:gap-6"
            animate={{ 
              x: isMobile 
                ? `calc(-${index * 100}% - ${index * 16}px)` 
                : `calc(-${index * (100 / 3)}% - ${index * 24}px)` 
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {sortedItems.map((item) => {
              const dDay = calculateDday(item.date)
              return (
                <div 
                  key={item.id} 
                  className={cn(
                    "shrink-0",
                    isMobile ? "w-full" : "w-[calc((100%/3)-(1.5rem*2/3))]"
                  )}
                >
                  <div className="relative aspect-square md:aspect-4/3 rounded-2xl overflow-hidden bg-muted group/card">
                    {/* Background Blur Image */}
                    <Image
                      src={item.image_url || "/postingpage/imgi_4_2026012915421534.jpg"}
                      alt=""
                      fill
                      className="object-cover blur-2xl scale-110 opacity-50"
                    />
                    {/* Main Poster Image */}
                    <Link 
                      href={`/posting/${item.id}`}
                      className="absolute inset-0 flex items-center justify-center p-6 md:p-8"
                    >
                      <div className="relative w-full h-full shadow-2xl transition-transform duration-300 group-hover/card:scale-[1.05]">
                        <Image
                          src={item.image_url || "/postingpage/imgi_4_2026012915421534.jpg"}
                          alt={locale === 'en' && item.title_en ? item.title_en : item.title}
                          fill
                          className="object-contain rounded-lg"
                        />
                      </div>
                    </Link>
                    {dDay && (
                      <div className="absolute top-4 left-4 px-2.5 py-1 rounded-lg bg-primary/80 backdrop-blur-md text-white text-[11px] font-black tracking-tight z-10">
                        {dDay}
                      </div>
                    )}
                  </div>
                  
                  <Link href={`/posting/${item.id}`} className="mt-4 block group">
                    <PostingInfo item={item} size="sm" />
                    
                    {/* 5. Additional Info Row */}
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] md:text-[13px] text-primary font-black">
                          {item.cost || (locale === 'en' ? 'Free' : '무료')}
                        </span>
                        {item.max_participants && (
                          <span className="text-[11px] text-muted-foreground/60 font-medium">
                            | {locale === 'en' ? 'Max' : '최대'} {item.max_participants.toString().replace(/명/g, '')}{locale === 'en' ? '' : '명'}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </motion.div>
        </div>

        {/* Controls */}
        {!isMobile && items.length > 3 && (
          <>
            <button
              onClick={() => paginate(-1)}
              className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-12 w-12 rounded-full bg-card shadow-lg border border-border flex items-center justify-center hover:bg-accent transition-all z-10 opacity-0 group-hover/controls:opacity-100",
                index === 0 && "pointer-events-none opacity-0"
              )}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => paginate(1)}
              className={cn(
                "absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-12 w-12 rounded-full bg-card shadow-lg border border-border flex items-center justify-center hover:bg-accent transition-all z-10 opacity-0 group-hover/controls:opacity-100",
                index >= items.length - 3 && "pointer-events-none opacity-0"
              )}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Mobile Pagination Dots */}
        {isMobile && items.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-6">
            {items.map((_, i) => (
              <div
                key={i}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                  index === i ? "w-4 bg-foreground" : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
