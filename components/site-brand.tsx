import Image from 'next/image'

import { cn } from '@/lib/utils'
import { siteConfig } from '@/lib/site-config'

export function SiteBrand({ className }: { className?: string }) {
  if (siteConfig.logoUrl) {
    return (
      <Image
        src={siteConfig.logoUrl}
        alt={siteConfig.name}
        width={160}
        height={48}
        className={cn('h-8 w-auto object-contain', className)}
        priority
      />
    )
  }

  return (
    <span className={cn('font-black text-primary tracking-tighter leading-none', className)}>
      {siteConfig.name}
    </span>
  )
}
