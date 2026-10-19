'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Clock3, Gift } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useLocale } from '@/hooks/use-locale'
import { RewardStampRow } from '@/components/rewards/reward-stamp-row'
import {
  EMPTY_REWARD_ACCOUNT,
  type RewardAccount,
} from '@/lib/early-application-rewards'

export function EarlyApplicationRewardBanner() {
  const locale = useLocale()
  const isEn = locale === 'en'
  const [account, setAccount] = useState<RewardAccount | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data } = await supabase
        .from('le_reward_accounts')
        .select('stamp_count, coupon_count, updated_at')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!cancelled) setAccount((data as RewardAccount | null) || EMPTY_REWARD_ACCOUNT)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pt-4 xl:px-40">
      <Link
        href="/posting/language"
        className="group flex flex-col gap-4 rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary/8 via-card to-amber-50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md md:flex-row md:items-center md:p-6"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Gift className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-foreground">
            {isEn ? 'Apply early and collect rewards' : '미리 신청하고 도장 모으기'}
          </p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">
            {isEn
              ? 'Apply at least 24 hours before a language exchange and check in to earn a stamp. 10 stamps unlock one free session.'
              : '언어교환 24시간 전까지 신청하고 참석하면 도장 1개! 도장 10개를 모으면 1회 무료 참가권을 드려요.'}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary">
            <Clock3 className="size-3.5" />
            {isEn ? 'The exact deadline appears after you choose a day.' : '요일을 선택하면 정확한 혜택 마감 시간을 알려드려요.'}
          </div>
        </div>
        {account ? (
          <div className="w-full shrink-0 rounded-2xl border border-border/70 bg-card/90 p-4 md:w-72">
            <div className="mb-2 flex items-center justify-between text-xs font-black">
              <span>{isEn ? `My stamps ${account.stamp_count}/10` : `내 도장 ${account.stamp_count}/10`}</span>
              <span className="text-primary">
                {isEn ? `${account.coupon_count} free pass` : `무료 참가권 ${account.coupon_count}장`}
              </span>
            </div>
            <RewardStampRow count={account.stamp_count} compact />
          </div>
        ) : (
          <span className="flex shrink-0 items-center gap-1 text-sm font-black text-primary">
            {isEn ? 'View sessions' : '언어교환 보기'}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        )}
      </Link>
    </section>
  )
}
