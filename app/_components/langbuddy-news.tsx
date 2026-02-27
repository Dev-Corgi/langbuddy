'use client'

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { ChevronRight, ChevronLeft, Instagram } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SectionHeader } from "./section-header"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase"
import Link from "next/link"
import { useLocale } from "@/hooks/use-locale"
import { i18n } from "@/lib/i18n"

export function LangBuddyNews() {
  const locale = useLocale()
  const t = i18n[locale]
  const [activeTab, setActiveTab] = useState("all")
  const [direction, setDirection] = useState(0)
  const [mobileIndex, setMobileIndex] = useState(0)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchPosts() {
      const { data } = await supabase
        .from('instagram_posts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(6)
      
      if (data && data.length > 0) {
        setPosts(data)
      } else {
        // Fallback data if DB is empty
        setPosts([
          {
            id: '1',
            thumbnail_url: "/news/news1.jpg",
            post_url: "#",
            caption: "[LANGBUDDY NEWS] 동아리 활동 하이라이트 #1"
          },
          /*
          {
            id: '2',
            thumbnail_url: "/news/news2.jpg",
            post_url: "#",
            caption: "언어교환 모임 현장 스케치"
          },
          */
          {
            id: '3',
            thumbnail_url: "/news/news3.jpg",
            post_url: "#",
            caption: "이번 주말 번개 모임 공지!"
          }
        ])
      }
      setLoading(false)
    }
    fetchPosts()
  }, [supabase])

  const touchStartXRef = useRef<number | null>(null)
  const touchDeltaXRef = useRef(0)

  const paginate = (newDirection: number) => {
    setDirection(newDirection)
    setMobileIndex((prev) => (prev + newDirection + posts.length) % posts.length)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
    touchDeltaXRef.current = 0
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current
  }

  const onTouchEnd = () => {
    if (touchStartXRef.current === null) return
    const deltaX = touchDeltaXRef.current
    touchStartXRef.current = null

    if (deltaX > 50) paginate(-1)
    else if (deltaX < -50) paginate(1)
  }

  if (loading) return (
    <section className="mt-20">
      <SectionHeader title={t.home.news.title} description={t.home.news.description} href="#" />
      
      {/* Desktop Skeleton */}
      <div className="mt-10 hidden grid-cols-3 gap-8 md:grid">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden py-0 shadow-sm border border-border bg-card rounded-[32px]">
            <Skeleton className="aspect-square w-full" />
            <div className="px-8 py-8 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-14 w-full" />
              <div className="flex items-center justify-between mt-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="w-5 h-5 rounded" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Mobile Skeleton */}
      <div className="md:hidden relative px-4">
        <div className="relative w-full overflow-visible py-8">
          <div className="w-full overflow-visible px-2">
            <Card className="overflow-hidden py-0 shadow-xl border border-border rounded-[40px] bg-card">
              <Skeleton className="aspect-square w-full" />
              <div className="p-8 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </Card>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-6">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </div>
    </section>
  )

  return (
    <section className="mt-20">
        <SectionHeader title={t.home.news.title} description={t.home.news.description} href="#" />
        
        {/* Desktop Layout */}
        <div className="mt-10 hidden grid-cols-3 gap-8 md:grid">
          {posts.map((item) => (
            <Card key={item.id} className="group overflow-hidden py-0 shadow-sm border border-border bg-card rounded-[32px] hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-500 hover:-translate-y-2">
              <Link href={item.post_url} target="_blank" className="block">
                <div className="relative aspect-square overflow-hidden bg-muted cursor-pointer">
                  <Image src={item.thumbnail_url} alt="" fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-linear-to-t from-primary/40 via-primary/15 to-transparent transition-all duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="h-16 w-16 rounded-full bg-primary/20 backdrop-blur-xl flex items-center justify-center text-primary-foreground border border-primary-foreground/30 shadow-2xl transform scale-50 group-hover:scale-100 transition-transform duration-500">
                      <Instagram size={32} />
                    </div>
                  </div>
                </div>
                <div className="px-8 py-8 flex flex-col gap-3 bg-card">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Instagram size={14} className="text-primary" />
                    </div>
                    <span className="text-[12px] font-black text-primary uppercase tracking-widest">Instagram</span>
                  </div>
                  <div className="line-clamp-2 text-xl font-black leading-tight tracking-tighter text-card-foreground min-h-[56px] group-hover:text-primary transition-colors duration-300">
                    {item.caption}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-[13px] font-bold text-muted-foreground/60">@langbuddy_official</div>
                    <ChevronRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-500" />
                  </div>
                </div>
              </Link>
            </Card>
          ))}
        </div>

        {/* Mobile Slider Layout */}
        <div className="md:hidden relative px-4 overflow-visible">
          <div className="relative w-full overflow-visible py-8">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={mobileIndex}
                custom={direction}
                variants={{
                  enter: (dir: number) => ({ x: dir > 0 ? '20%' : '-20%', opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (dir: number) => ({ x: dir > 0 ? '-20%' : '20%', opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 400, damping: 40 }}
                className="w-full overflow-visible px-2"
              >
                <Link href={posts[mobileIndex].post_url} target="_blank" className="block">
                  <Card className="overflow-hidden py-0 shadow-xl border border-border rounded-[40px] bg-card">
                    <div className="relative aspect-square bg-muted group">
                      <Image src={posts[mobileIndex].thumbnail_url} alt="" fill className="object-cover" />
                      <div className="absolute inset-0 bg-linear-to-t from-primary/40 via-primary/15 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-14 w-14 rounded-full bg-primary/20 backdrop-blur-xl flex items-center justify-center text-primary-foreground border border-primary-foreground/30 shadow-lg">
                          <Instagram size={28} />
                        </div>
                      </div>
                      {posts[mobileIndex].badge_text && (
                        <div className="absolute left-6 top-6 rounded-full bg-primary px-4 py-1.5 text-[10px] font-black text-primary-foreground uppercase shadow-lg shadow-primary/30">
                          {posts[mobileIndex].badge_text}
                        </div>
                      )}
                    </div>
                    <div className="p-8 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Instagram size={16} className="text-primary" />
                        </div>
                        <span className="text-xs font-black text-primary uppercase tracking-widest">Instagram</span>
                      </div>
                      <div className="line-clamp-2 text-xl font-black leading-tight text-card-foreground">
                        {posts[mobileIndex].caption}
                      </div>
                      <div className="text-xs font-bold text-muted-foreground/60 tracking-tight">@langbuddy_official</div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-5 flex items-center justify-center gap-6">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-xl border-border bg-card"
              onClick={() => paginate(-1)}
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="text-base font-bold tracking-tighter">
              <span className="text-foreground">{mobileIndex + 1}</span>
              <span className="mx-1 text-muted-foreground/40">/</span>
              <span className="text-muted-foreground/40">{posts.length}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-xl border-border bg-card"
              onClick={() => paginate(1)}
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </div>
    </section>
  )
}
