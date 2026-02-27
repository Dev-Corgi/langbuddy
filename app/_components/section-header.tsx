'use client'

import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { useLocale } from "@/hooks/use-locale"

interface SectionHeaderProps {
  title: string
  description?: string
  href?: string
  className?: string
}

export function SectionHeader({ title, description, href, className }: SectionHeaderProps) {
  const locale = useLocale()
  
  return (
    <div className={cn("flex flex-col mb-8 md:mb-12 px-1", className)}>
      <div className="space-y-1 md:space-y-2 relative">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-1.5 h-6 md:h-8 bg-primary rounded-full" />
          <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-foreground whitespace-pre-line leading-tight">
            {title}
          </h2>
        </div>
        {description && (
          <p className="text-muted-foreground text-md md:text-base font-semibold pl-3.5 md:pl-4.5 whitespace-pre-wrap">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
