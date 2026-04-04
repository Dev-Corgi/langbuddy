import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { SectionHeader } from "./section-header"

type ImageButtonItem = {
  title: string
  subtitle: string
  meta: string
  href: string
  imageSrc: string
}

const ITEMS: ImageButtonItem[] = [
  {
    title: "언어교환 모임",
    subtitle: "Language Exchange",
    meta: "매주 다양한 국적의 친구들과 대화해보세요",
    href: "/posting/language",
    imageSrc: "/imagebuttons/exchange.jpg",
  },
  {
    title: "동아리 정기 스터디",
    subtitle: "Regular Study",
    meta: "체계적인 커리큘럼으로 함께 성장하는 스터디",
    href: "/posting/study",
    imageSrc: "/imagebuttons/study.jpg",
  },
  {
    title: "소모임 / 번개",
    subtitle: "Lightning Gathering",
    meta: "가볍게 즐기는 일상 속 특별한 만남",
    href: "/posting",
    imageSrc: "/imagebuttons/meetup.jpg",
  },
]

type ImageButtonsProps = {
  className?: string
}

export function ImageButtons({ className }: ImageButtonsProps) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        if (user.email === 'pomato5959@gmail.com') {
          setIsSuperAdmin(true)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_superadmin')
          .eq('id', user.id)
          .single()
        
        if (profile?.is_superadmin) {
          setIsSuperAdmin(true)
        }
      }
    }
    checkAdmin()
  }, [supabase])

  const filteredItems = ITEMS.filter(item => {
    if (item.href === '/posting/language' || item.href === '/posting/study') {
      return isSuperAdmin
    }
    return true
  })

  return (
    <section className={cn("w-full min-w-0 overflow-hidden", className)}>
      <SectionHeader 
        title="동아리 활동 참여하기" 
        description="관심 있는 모임에 지금 바로 참여해보세요" 
        href="#" 
      />
      <div className={cn(
        "grid gap-6 md:gap-8 min-w-0",
        filteredItems.length === 1 ? "grid-cols-1 max-w-md" : "md:grid-cols-3"
      )}>
        {filteredItems.map((item, idx) => (
          <Link
            key={item.title}
            href={item.href}
            className={cn(
              "group relative overflow-hidden rounded-[32px] border border-border bg-card transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30 hover:-translate-y-2",
              filteredItems.length === 3 && idx === 1 ? "md:scale-105 z-10" : ""
            )}
          >
            <div className="relative min-h-[200px] md:aspect-3/4">
              <Image
                src={item.imageSrc}
                alt={item.title}
                fill
                className="object-cover object-center transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-linear-to-t from-primary/90 via-primary/40 to-transparent transition-all duration-500 group-hover:from-primary group-hover:via-primary/60" />
            </div>

            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
              <div className="text-primary-foreground text-xs md:text-sm font-normal tracking-widest uppercase mb-2 md:mb-2 transform transition-transform duration-500 group-hover:-translate-y-1">
                {item.subtitle}
              </div>
              <div className="text-primary-foreground text-xl md:text-4xl font-black tracking-tighter leading-tight md:leading-none transform transition-transform duration-500 group-hover:-translate-y-1">
                {item.title}
              </div>
              <div className="text-primary-foreground mt-1 md:mt-4 text-sm md:text-base font-bold leading-relaxed opacity-100 md:opacity-0 md:group-hover:opacity-100 transform translate-y-0 md:translate-y-4 md:group-hover:translate-y-0 transition-all duration-500">
                {item.meta}
              </div>
              <div className="mt-4 md:mt-6 flex items-center gap-2 text-primary-foreground font-black text-xs md:text-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-500 delay-100">
                <span>자세히 보기</span>
                <div className="w-6 md:w-8 h-px bg-primary-foreground" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
