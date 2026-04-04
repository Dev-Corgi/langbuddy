'use client'

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase"
import { Loader2 } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"

export function RecommendationSection({ excludeId }: { excludeId?: string }) {
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const locale = useLocale()

  useEffect(() => {
    async function fetchRecommendations() {
      const now = new Date().toISOString()
      let query = supabase
        .from('postings')
        .select('*')
        .eq('status', 'active')
        .eq('category', '번개') // Only recommend meetups
        .or(`deadline.is.null,deadline.gt.${now}`)
        .order('created_at', { ascending: false })
      
      if (excludeId) {
        query = query.neq('id', excludeId)
      }

      const { data } = await query.limit(5)
      
      if (data && data.length > 0) {
        setRecommendations(data)
      } else {
        setRecommendations([])
      }
      setLoading(false)
    }
    fetchRecommendations()
  }, [supabase, excludeId])

  if (loading) {
    return (
      <section className="w-full py-12 md:py-24 bg-white">
        <Skeleton className="h-8 w-48 mb-8 md:mb-12" />
        <div className="flex md:grid md:grid-cols-5 gap-5 md:gap-8 overflow-x-auto pb-6 md:pb-0 scrollbar-hide">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="shrink-0 w-[170px] md:w-auto">
              <Skeleton className="aspect-3/4 w-full rounded-2xl mb-5" />
              <div className="space-y-1.5 px-1">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (!loading && recommendations.length === 0) {
    return null
  }

  return (
    <section className="w-full py-12 md:py-24 bg-white">
      <h3 className="text-[20px] md:text-[24px] font-black text-zinc-900 mb-8 md:mb-12">
        {locale === 'en' ? 'Recommended for You' : '이런 활동은 어때요?'}
      </h3>

      {/* Desktop: 5-column grid / Mobile: Horizontal scroll */}
      <div className="flex md:grid md:grid-cols-5 gap-5 md:gap-8 overflow-x-auto pb-6 md:pb-0 scrollbar-hide snap-x">
        {recommendations.map((item) => (
          <Link 
            key={item.id} 
            href={`/posting/${item.id}`}
            className="shrink-0 w-[170px] md:w-auto snap-start group"
          >
            <div className="relative aspect-3/4 rounded-2xl overflow-hidden mb-5 shadow-sm border border-zinc-100">
              <Image
                src={item.image_url || "/imagebuttons/meetup.jpg"}
                alt={locale === 'en' && item.title_en ? item.title_en : item.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="space-y-1.5 px-1">
              <h4 className="text-[15px] md:text-[17px] font-black text-zinc-900 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                {locale === 'en' && item.title_en ? item.title_en : item.title}
              </h4>
              <div className="text-[13px] md:text-[14px] text-zinc-500 font-bold">
                {locale === 'en' && item.location_en ? item.location_en : item.location}
              </div>
              <div className="text-[13px] md:text-[14px] text-zinc-400 font-bold">
                {item.date}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
