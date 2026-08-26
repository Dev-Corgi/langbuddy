'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MainNav } from '@/app/_components/main-nav'
import { useLocale } from '@/hooks/use-locale'
import { DEBUG_BASE_PATH } from '@/lib/debug/debug-base-path'

export default function DebugPrivacyPage() {
  const locale = useLocale()
  const isKo = locale === 'ko'

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden relative">
      <MainNav />
      <main className="relative z-10 py-10 md:py-16">
        <div className="mx-auto w-full max-w-3xl px-4 md:px-6">
          <Link
            href={DEBUG_BASE_PATH}
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" aria-hidden />
            {isKo ? '홈으로' : 'Back to home'}
          </Link>

          <header className="mb-10 space-y-3">
            <p className="text-xs font-black tracking-wider text-primary uppercase">DEBUG · MOCK</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
              {isKo ? '개인정보 처리방침' : 'Privacy Policy'}
            </h1>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              {isKo
                ? '디버그용 정적 페이지입니다. 실제 정책 문구와 동일하게 보이게만 구성했습니다.'
                : 'Static debug page for UI layout. Content is illustrative only.'}
            </p>
          </header>

          <article className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-black text-foreground">
                {isKo ? '1. 수집하는 개인정보' : '1. Information we collect'}
              </h2>
              <p>
                {isKo
                  ? '서비스 이용을 위해 이름, 이메일, 프로필 정보 등을 수집할 수 있습니다. (목업)'
                  : 'We may collect name, email, and profile information to provide the service. (mock)'}
              </p>
            </section>
            <section>
              <h2 className="text-lg font-black text-foreground">
                {isKo ? '2. 이용 목적' : '2. Purpose of use'}
              </h2>
              <p>
                {isKo
                  ? '모임 신청, 출석 확인, 고객 지원을 위해 사용합니다. (목업)'
                  : 'Used for event applications, check-in, and support. (mock)'}
              </p>
            </section>
          </article>
        </div>
      </main>
    </div>
  )
}
