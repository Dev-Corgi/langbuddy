'use client'

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { createClient } from "@/lib/supabase"
import { useLocale } from "@/hooks/use-locale"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

type CarouselSlide = {
  id: string
  title: string
  title_en?: string
  subtitle?: string
  subtitle_en?: string
  description?: string
  description_en?: string
  period?: string
  location?: string
  image_url: string
  mobile_image_url?: string
  thumbnail_url?: string
  link_url?: string
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return matches
}

type MainCarouselProps = {
  className?: string
  autoPlayMs?: number
}

export function MainCarousel({ className, autoPlayMs = 5000 }: MainCarouselProps) {
  const [slides, setSlides] = useState<CarouselSlide[]>([])
  const [loading, setLoading] = useState(true)
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const supabase = createClient()
  const locale = useLocale()

  useEffect(() => {
    async function fetchCarousels() {
      const now = new Date().toISOString()
      console.log('🔍 Carousel Query - Current time:', now)
      
      const { data, error } = await supabase
        .from('postings')
        .select('*')
        .eq('category', '번개')
        .eq('status', 'active')
        .or(`deadline.is.null,deadline.gt.${now}`)
        .order('date', { ascending: true, nullsFirst: false })
        .limit(5)
      
      console.log('📊 Carousel Query Result:', {
        count: data?.length || 0,
        error,
        data: data?.map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          deadline: p.deadline,
          date: p.date,
          image_url: p.image_url
        }))
      })
      
      if (data && data.length > 0) {
        // Map postings to carousel slide format
        const fallbackImage = "/carousel/imgi_3_250917060052_25013145.gif"
        const mappedSlides = data.map(posting => ({
          id: posting.id,
          title: posting.title,
          title_en: posting.title_en,
          subtitle: posting.subtitle,
          subtitle_en: posting.subtitle_en,
          description: `${posting.location || ''} ${posting.time ? '• ' + posting.time : ''}`.trim(),
          description_en: `${posting.location_en || posting.location || ''} ${posting.time ? '• ' + posting.time : ''}`.trim(),
          period: posting.date,
          location: posting.location,
          image_url: posting.image_url || fallbackImage,
          mobile_image_url: posting.image_url || fallbackImage,
          thumbnail_url: posting.image_url || fallbackImage,
          link_url: `/posting/${posting.id}`
        }))
        console.log('✅ Mapped slides:', mappedSlides.length)
        setSlides(mappedSlides)
      } else {
        setSlides([
          {
            id: '1',
            title: "2026 GS아트센터\n기획 시즌",
            description: "경계 없는 예술가들의 우주적 만남",
            location: "GS아트센터",
            period: "2026.3.27 - 2026.6.30",
            image_url: "/carousel/imgi_3_250917060052_25013145.gif",
            mobile_image_url: "/carousel/imgi_156_250917061213_25013145.gif",
            thumbnail_url: "/carousel/imgi_20_9d20093d-8424-4420-b670-c3516595ff46.jpg"
          }
        ])
      }
      setLoading(false)
    }
    fetchCarousels()
  }, [supabase])

  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  
  const touchStartXRef = useRef<number | null>(null)
  const touchDeltaXRef = useRef(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const t = window.setInterval(() => {
      setDirection(1)
      setActiveIndex((prev) => (prev + 1) % slides.length)
    }, autoPlayMs)
    return () => window.clearInterval(t)
  }, [autoPlayMs, slides.length])

  const goTo = (nextIndex: number) => {
    if (slides.length <= 1) return
    if (nextIndex === activeIndex) return
    setDirection(nextIndex > activeIndex ? 1 : -1)
    setActiveIndex(nextIndex)
  }

  const goNext = () => {
    if (slides.length <= 1) return
    setDirection(1)
    setActiveIndex((prev) => (prev + 1) % slides.length)
  }

  const goPrev = () => {
    if (slides.length <= 1) return
    setDirection(-1)
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null
    touchDeltaXRef.current = 0
  }

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current == null) return
    const x = e.touches[0]?.clientX
    if (typeof x !== "number") return
    touchDeltaXRef.current = x - touchStartXRef.current
  }

  const onTouchEnd = () => {
    if (touchStartXRef.current == null) return
    const deltaX = touchDeltaXRef.current
    touchStartXRef.current = null
    
    if (deltaX < -50) goNext()
    else if (deltaX > 50) goPrev()
  }

  if (loading || slides.length === 0) return (
    <section className={cn("w-full min-w-0 overflow-x-hidden relative", className)}>
      <div className={cn(
        "relative w-full overflow-hidden bg-muted",
        isDesktop ? "h-[600px] md:h-[700px]" : "aspect-square rounded-2xl mx-auto w-[calc(100%-2rem)]"
      )}>
        <Skeleton className="absolute inset-0" />
        <div className={cn(
          "absolute inset-0 flex flex-col",
          isDesktop ? "left-1/2 -translate-x-1/2 w-full max-w-[1600px] px-16 py-24" : "px-6 py-8"
        )}>
          <Skeleton className="w-32 h-8 rounded-full" />
          <div className={cn("space-y-2 md:space-y-4", isDesktop ? "mt-20" : "mt-16")}>
            <Skeleton className="h-4 w-24 md:h-5 md:w-32" />
            <Skeleton className="h-12 w-3/4 md:h-20 md:w-2/3" />
            <Skeleton className="h-6 w-2/3 md:h-8 md:w-1/2" />
            <Skeleton className="h-16 w-40 rounded-2xl mt-6 md:mt-8" />
          </div>
        </div>
      </div>
    </section>
  )

  const active = slides[activeIndex]
  
  const displayTitle = (locale === 'en' && active?.title_en) ? active.title_en : active?.title
  const displaySubtitle = (locale === 'en' && active?.subtitle_en) ? active.subtitle_en : active?.subtitle
  const displayDescription = (locale === 'en' && active?.description_en) ? active.description_en : active?.description

  return (
    <section className={cn("w-full min-w-0 overflow-x-hidden relative", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden bg-muted",
          isDesktop ? "h-[600px] md:h-[700px]" : "aspect-square rounded-2xl mx-auto w-[calc(100%-2rem)]"
        )}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={activeIndex}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ opacity: 0, scale: 1.15 }),
              center: { opacity: 1, scale: 1 },
              exit: (dir: number) => ({ opacity: 0, scale: 1 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <motion.div
              animate={{ scale: [1, 1.08] }}
              transition={{ duration: 10, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
              className="absolute inset-0"
            >
              <Image
                src={(!isDesktop && active.mobile_image_url) ? active.mobile_image_url : (active.image_url || active.mobile_image_url || "")}
                alt={displayTitle?.replaceAll("\n", " ") || ""}
                fill
                priority
                className="object-cover"
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Improved Gradient Overlay */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none",
            isDesktop
              ? "bg-linear-to-r from-primary/60 via-primary/20 to-transparent"
              : "bg-linear-to-b from-primary/70 via-primary/30 to-transparent"
          )}
        />

        <div
          className={cn(
            "absolute inset-0 flex flex-col pointer-events-none",
            isDesktop ? "left-1/2 -translate-x-1/2 w-full max-w-[1600px] px-16 py-24" : "px-6 py-8"
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: { opacity: 0 },
                visible: { 
                  opacity: 1,
                  transition: { staggerChildren: 0.1, delayChildren: 0.3 }
                }
              }}
              className="flex flex-col h-full w-full"
            >
              {/* Top Section: Featured Badge */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: -10 },
                  visible: { opacity: 1, y: 0 }
                }}
              >
                <div className="inline-flex px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-sm md:text-md font-black text-white uppercase tracking-widest">
                  Featured Event
                </div>
              </motion.div>

              {/* Bottom Section: Text Content */}
              <div className={cn("space-y-2 md:space-y-8", isDesktop ? "mt-20" : "mt-16")}>
                {displaySubtitle ? (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      visible: { opacity: 1, x: 0 }
                    }}
                    className="flex items-center gap-2 md:gap-4"
                  >
                    <div className="w-4 md:w-10 h-px bg-white/60" />
                    <p className={cn("text-white/90 font-black uppercase tracking-[0.15em] md:tracking-[0.3em]", isDesktop ? "text-lg" : "text-md line-clamp-1")}>
                      {displaySubtitle}
                    </p>
                  </motion.div>
                ) : null}
                
                <motion.h2
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
                  }}
                  className={cn(
                    "font-black tracking-tighter text-white",
                    isDesktop ? "text-6xl whitespace-pre-line" : "text-3xl line-clamp-1"
                  )}
                >
                  {displayTitle}
                </motion.h2>

                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  className="pt-3 md:pt-4 pointer-events-auto"
                >
                  <Button 
                    className="group h-9 md:h-16 px-5 md:px-12 rounded-lg md:rounded-2xl bg-primary text-primary-foreground font-semibold text-sm md:text-xl shadow-2xl shadow-primary/40 hover:bg-primary/90 transition-all active:scale-95"
                    asChild
                  >
                    <Link href={active.link_url || "/posting"}>
                      {locale === 'en' ? 'Explore Now' : '자세히 보기'}
                      <ChevronRight className="ml-1 w-3.5 h-3.5 md:w-6 md:h-6 transition-transform group-hover:translate-x-2" />
                    </Link>
                  </Button>
                </motion.div>
              </div>

              {/* Bottom Section: Pagination & Progress */}
              <div className="flex items-center justify-between pointer-events-auto mt-24">
                <div className={cn("flex items-center gap-1.5  md:gap-4", isDesktop && "hidden")}>
                  {slides.map((s, idx) => {
                    const selected = idx === activeIndex
                    return (
                      <button
                        key={idx}
                        type="button"
                        className="relative h-1.5 w-6 rounded-full bg-white/20 overflow-hidden transition-all"
                        onClick={() => goTo(idx)}
                        aria-label={`${idx + 1}번 슬라이드로 이동`}
                      >
                        {selected && (
                          <motion.div
                            layoutId="progress"
                            className="absolute inset-0 bg-primary"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: autoPlayMs / 1000, ease: "linear" }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* <div
                  className={cn(
                    "rounded-full bg-black/20 backdrop-blur-md border border-white/10 px-3 pt-1.5 pb-2.5 text-xs md:text-sm text-white tracking-[0.2em]",
                    isDesktop ? "hidden" : "block"
                  )}
                >
                  <span className="opacity-60ks">{String(activeIndex + 1).padStart(2, '0')}</span>
                  <span className="mx-1.5 md:mx-3 text-primary">/</span>
                  <span>{String(slides.length).padStart(2, '0')}</span>
                </div> */}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Desktop Thumbnail Navigation */}
        {isDesktop ? (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-[1600px] px-16 pointer-events-auto overflow-visible">
            <div className="flex items-center gap-4 overflow-x-auto overscroll-x-contain scrollbar-hide py-4 px-4 overflow-visible">
              {slides.map((s, i) => {
                const selected = i === activeIndex
                const src = s.thumbnail_url || s.image_url
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`${i + 1}번 슬라이드로 이동`}
                    aria-pressed={selected}
                    className={cn(
                      "group relative h-14 w-14 md:h-16 md:w-16 shrink-0 rounded-2xl transition-all duration-500",
                      selected 
                        ? "scale-110 z-10 bg-primary p-[5px]" 
                        : "opacity-60 hover:opacity-100 hover:scale-105 bg-border/30 p-px"
                    )}
                  >
                    <div className="relative h-full w-full bg-muted rounded-[14px] overflow-hidden">
                      <Image
                        src={src}
                        alt=""
                        fill
                        className={cn(
                          "object-cover transition-transform duration-500",
                          selected ? "scale-110" : "group-hover:scale-110"
                        )}
                      />
                      <div
                        className={cn(
                          "absolute inset-0 transition-opacity duration-500",
                          selected ? "bg-primary/5" : "bg-black/20 opacity-0 group-hover:opacity-100"
                        )}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
