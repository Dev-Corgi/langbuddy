import { Gift, History, Stamp, TicketCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RewardStampRow } from '@/components/rewards/reward-stamp-row'
import type { RewardAccount, RewardLedgerEntry } from '@/lib/early-application-rewards'
import { formatSessionDateLabel } from '@/lib/session-event-date'

type Props = {
  account: RewardAccount
  entries: RewardLedgerEntry[]
  isEn: boolean
}

function entryLabel(entry: RewardLedgerEntry, isEn: boolean) {
  if (entry.entry_type === 'legacy_migration') return isEn ? 'Previous stamp balance carried over' : '기존 도장 잔액 이전'
  if (entry.entry_type === 'coupon_used') return isEn ? 'Free pass used' : '무료 참가권 사용'
  if (entry.entry_type === 'coupon_refunded') return isEn ? 'Free pass returned' : '무료 참가권 복구'
  if (entry.coupon_delta > 0) return isEn ? 'Stamp earned · free pass unlocked' : '도장 적립 · 무료 참가권 발급'
  return isEn ? 'Early-application stamp earned' : '미리 신청 도장 적립'
}

export function RewardWalletCard({ account, entries, isEn }: Props) {
  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-black">
              <Gift className="size-5 text-primary" />
              {isEn ? 'Early application rewards' : '미리 신청 혜택'}
            </CardTitle>
            <CardDescription className="mt-1.5">
              {isEn
                ? 'Apply 24 hours early and check in to collect a stamp.'
                : '언어교환 24시간 전까지 신청하고 참석하면 도장이 쌓여요.'}
            </CardDescription>
          </div>
          <div className="shrink-0 rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3 text-center">
            <TicketCheck className="mx-auto size-5 text-primary" />
            <p className="mt-1 text-xl font-black text-primary">{account.coupon_count}</p>
            <p className="text-[11px] font-bold text-muted-foreground">
              {isEn ? 'free passes' : '무료 참가권'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-border/70 bg-card/85 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-black">
              <Stamp className="size-4 text-primary" />
              {isEn ? 'Stamps' : '도장'}
            </span>
            <span className="text-sm font-black text-primary">{account.stamp_count}/10</span>
          </div>
          <RewardStampRow count={account.stamp_count} />
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {isEn
              ? `${10 - account.stamp_count} more stamp${10 - account.stamp_count === 1 ? '' : 's'} until your next free pass.`
              : `${10 - account.stamp_count}개 더 모으면 무료 참가권이 발급돼요.`}
          </p>
        </div>

        {entries.length > 0 ? (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-muted-foreground">
              <History className="size-3.5" />
              {isEn ? 'Recent activity' : '최근 적립·사용 내역'}
            </p>
            <div className="divide-y divide-border/70 rounded-2xl border border-border/70 bg-card/70 px-4">
              {entries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">{entryLabel(entry, isEn)}</p>
                    {entry.session_date ? (
                      <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                        {formatSessionDateLabel(entry.session_date, isEn ? 'en' : 'ko')}
                      </p>
                    ) : null}
                  </div>
                  <span className={entry.coupon_delta < 0 ? 'font-black text-muted-foreground' : 'font-black text-primary'}>
                    {entry.entry_type === 'early_stamp'
                      ? '+1 stamp'
                      : entry.entry_type === 'legacy_migration'
                        ? `+${entry.stamp_delta} stamp`
                      : `${entry.coupon_delta > 0 ? '+' : ''}${entry.coupon_delta}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
