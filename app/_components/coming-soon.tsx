'use client'

import { useLocale } from "@/hooks/use-locale"
import { Construction } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function ComingSoon() {
  const locale = useLocale()

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-6 rounded-full bg-primary/10">
            <Construction className="w-16 h-16 text-primary" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-foreground">
            {locale === 'en' ? 'Coming Soon' : '준비 중입니다'}
          </h1>
          <p className="text-muted-foreground font-medium">
            {locale === 'en' 
              ? 'This page is currently under development. Please check back later!' 
              : '이 페이지는 현재 준비 중입니다. 조금만 기다려주세요!'}
          </p>
        </div>

        <Button asChild className="w-full h-12 rounded-xl font-black">
          <Link href="/">
            {locale === 'en' ? 'Back to Home' : '홈으로 돌아가기'}
          </Link>
        </Button>
      </div>
    </div>
  )
}
