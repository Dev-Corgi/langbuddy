'use client'

import { Calendar, Clock, MapPin } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"

interface PostingInfoProps {
  item: any
  size?: 'sm' | 'md'
  className?: string
}

export function PostingInfo({ item, size = 'md', className = '' }: PostingInfoProps) {
  const locale = useLocale()
  
  const iconSize = 'w-4 h-4'
  const textSize = 'text-[13px]'
  const titleSize = 'text-xl md:text-xl'
  const subtitleSize = 'text-sm'

  return (
    <div className={`space-y-1 ${className}`}>
            {/* 4. Title Row */}
      <h3 className={`mt-3 font-black text-foreground line-clamp-1 leading-tight tracking-tight group-hover:text-primary transition-colors ${titleSize}`}>
        {locale === 'en' && item.title_en ? item.title_en : item.title}
      </h3>

      {/* 5. Subtitle Row */}
      <p className={`text-muted-foreground font-bold line-clamp-1 ${subtitleSize}`}>
        {locale === 'en' && item.subtitle_en ? item.subtitle_en : item.subtitle}
      </p>
      
      {/* 1. Date Row */}
      <div className="flex items-center gap-2 text-foreground/70">
        <Calendar className={`${iconSize} text-muted-foreground shrink-0`} />
        <span className={`font-bold ${textSize} tracking-tight`}>
          {item.is_recurring 
            ? (locale === 'en' ? `Every ${item.recurring_days?.join(', ')}` : `매주 ${item.recurring_days?.join(', ')}`)
            : (item.is_date_undecided || !item.date || item.date === '미정' ? (locale === 'en' ? 'Date Undecided' : '날짜 미정') : item.date)
          }
        </span>
      </div>

      {/* 2. Time Row */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className={`${iconSize} text-muted-foreground shrink-0`} />
        <span className={`font-bold ${textSize} tracking-tight`}>
          {item.is_time_undecided || !item.time || item.time === '미정' 
            ? (locale === 'en' ? 'Time TBD' : '시간 미정')
            : item.time
          }
        </span>
      </div>

      {/* 3. Location Row */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <MapPin className={`${iconSize} text-muted-foreground shrink-0`} />
        <span className={`font-bold ${textSize} tracking-tight`}>
          {item.is_location_undecided || !item.location || item.location === '미정'
            ? (locale === 'en' ? 'Location TBD' : '장소 미정')
            : (locale === 'en' && item.location_en ? item.location_en : item.location)
          }
        </span>
      </div>
    </div>
  )
}
