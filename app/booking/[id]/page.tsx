'use client'

import { useState, useEffect } from "react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, X, Info, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useLocale } from "@/hooks/use-locale"
import { i18n } from "@/lib/i18n"

export default function BookingPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const supabase = createClient()
  const locale = useLocale()
  const tDict = i18n[locale]
  
  const [selectedDate, setSelectedDate] = useState<number>(24)
  const [isMobile, setIsMobile] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    async function fetchData() {
      const { data: result } = await supabase
        .from('postings')
        .select('*')
        .eq('id', id)
        .single()
      
      if (result) {
        setData(result)
      } else {
        setData({
          title: "로드씨어터 〈클럽 라틴〉",
          location: "예술의전당 자유소극장",
          month: "2026.02",
          cast: "김다흰, 박동욱, 전석호",
          seats: [
            { grade: "R석", count: "80석" },
            { grade: "S석", count: "13석" },
            { grade: "A석", count: "28석" },
          ]
        })
      }
      setLoading(false)
    }
    fetchData()
  }, [id, supabase])

  const days = Array.from({ length: 28 }, (_, i) => i + 1)
  const weekDays = locale === 'en' ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["일", "월", "화", "수", "목", "금", "토"]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  const displayTitle = locale === 'en' && data?.title_en ? data.title_en : data?.title;
  const displayLocation = locale === 'en' && data?.location_en ? data.location_en : data?.location;

  return (
    <div className="min-h-screen bg-card text-foreground overflow-x-hidden pb-10">
      {/* Header */}
      <header className="relative h-[200px] md:h-[280px] w-full overflow-hidden bg-zinc-950">
        <div className="absolute inset-0">
          <Image
            src={data?.image_url || "/carousel/imgi_3_250917060052_25013145.gif"}
            alt=""
            fill
            className="object-cover blur-md scale-110 opacity-50"
          />
        </div>
        <div className="absolute inset-0 bg-linear-to-b from-black/30 via-black/10 to-black/70" />
        
        <div className="relative z-10 mx-auto max-w-[1200px] h-full flex flex-col justify-between p-6 md:p-10">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-card" />
              <div className="w-2.5 h-2.5 rounded-full bg-card/30 border border-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-card/30 border border-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-card/30 border border-white/10" />
            </div>
            <button onClick={() => router.back()} className="text-white/80 hover:text-white transition-colors">
              <X className="w-8 h-8" />
            </button>
          </div>
          
          <div className="space-y-1">
            <h1 className="text-[24px] md:text-[40px] font-black text-white tracking-tight leading-tight">
              {displayTitle}
            </h1>
            <p className="text-[15px] md:text-[20px] text-white/70 font-bold">
              {displayLocation}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] grid grid-cols-1 md:grid-cols-[1.3fr_1fr] md:gap-16 md:py-16">
        {/* Calendar Section */}
        <section className="p-6 md:p-0">
          <div className="flex items-center justify-center gap-6 mb-10">
            <span className="text-[26px] md:text-[32px] font-black tracking-tighter">
              {locale === 'en' ? 'February 2026' : data.month || '2026.02'}
            </span>
            <ChevronRight className="w-8 h-8 text-muted-foreground/60 cursor-pointer hover:text-foreground transition-colors" />
          </div>

          <div className="grid grid-cols-7 text-center mb-6 text-[14px] md:text-[16px] font-black text-muted-foreground">
            {weekDays.map((d, i) => (
              <div key={d} className={cn(i === 0 && "text-red-400")}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-3 md:gap-y-6">
            {days.map((day) => {
              const isSelected = selectedDate === day
              const isToday = day === 22
              const isPast = day < 22
              const isSunday = (day + 5) % 7 === 0 // Assuming Feb 1, 2026 is Sunday
              
              return (
                <button
                  key={day}
                  onClick={() => !isPast && setSelectedDate(day)}
                  disabled={isPast}
                  className="relative flex flex-col items-center justify-center py-2 transition-all group"
                >
                  <div className={cn(
                    "flex items-center justify-center w-11 h-11 md:w-16 md:h-16 rounded-full text-[18px] md:text-[22px] font-black transition-all",
                    isSelected ? "bg-primary text-primary-foreground shadow-xl shadow-primary/40" : 
                    isPast ? "text-muted-foreground/30" : 
                    isSunday ? "text-red-400" : 
                    "text-foreground group-hover:bg-muted"
                  )}>
                    {day}
                  </div>
                  {isToday && (
                    <div className="absolute -bottom-4 flex flex-col items-center">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">TODAY</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Info & Selection Section */}
        <section className="border-t border-border md:border-none">
          <div className="px-6 py-4 md:px-0 bg-muted md:bg-transparent flex items-center gap-2 text-[13px] md:text-[15px] text-muted-foreground font-bold">
            <Info className="w-4.5 h-4.5 opacity-60" />
            {locale === 'en' ? 'This item is not available for waiting list.' : '예매대기가 불가한 상품입니다.'}
          </div>

          <div className="p-6 md:p-0 mt-4 space-y-8 pb-32 md:pb-0">
            <div className="flex items-center justify-between">
              <span className="text-primary text-[24px] md:text-[28px] font-black">
                {locale === 'en' ? '07:30 PM' : '오후 7:30'}
              </span>
              <Button className="bg-primary hover:bg-primary/90 rounded-full h-11 md:h-14 px-8 md:px-10 text-[17px] md:text-[19px] font-black flex items-center gap-1 shadow-xl shadow-primary/30 transition-all active:scale-95">
                {locale === 'en' ? 'Select' : '선택'}
                <ChevronRight className="w-5 h-5 stroke-3" />
              </Button>
            </div>

            <div className="bg-muted/50 rounded-[24px] border border-border p-8 md:p-10">
              <p className="text-muted-foreground text-[15px] md:text-[17px] font-black mb-8">
                {locale === 'en' && data?.host_en ? data.host_en : (data?.host || data?.cast)}
              </p>
              
              <div className="space-y-5 md:space-y-6">
                {(data.seats || [
                  { grade: locale === 'en' ? "Regular" : "일반석", count: "Available" },
                ]).map((seat: any) => (
                  <div key={seat.grade} className="flex justify-between items-center border-b border-border pb-3 last:border-0 last:pb-0">
                    <span className="text-foreground text-[16px] md:text-[18px] font-bold">{seat.grade}</span>
                    <span className="text-red-500 text-[16px] md:text-[18px] font-black">{seat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
