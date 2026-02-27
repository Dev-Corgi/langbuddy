'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'

interface PageHeaderProps {
  title: string
  titleEn: string
  description: string
  descriptionEn: string
  backPath?: string
}

export function PageHeader({ title, titleEn, description, descriptionEn, backPath = '/admin' }: PageHeaderProps) {
  const locale = useLocale()

  return (
    <div className="space-y-1">
      <Link href={backPath} className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors mb-2 text-sm">
        <ChevronLeft className="w-4 h-4" />
        {locale === 'en' ? 'Back to Dashboard' : '대시보드로 돌아가기'}
      </Link>
      <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
        {locale === 'en' ? titleEn : title}
      </h1>
      <p className="text-muted-foreground font-medium text-sm md:text-base">
        {locale === 'en' ? descriptionEn : description}
      </p>
    </div>
  )
}
