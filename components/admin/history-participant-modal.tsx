'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, Settings, User, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES } from '@/lib/supported-languages'
import { formatPaymentMethodLabel } from '@/lib/supported-payment-methods'
import type { HistoryParticipant } from '@/lib/seating-history-view'

type UserDetail = {
  email?: string | null
  kakao_id?: string | null
  onboarding_completed?: boolean
}

type HistoryParticipantModalProps = {
  participant: HistoryParticipant
  sessionDate: string
  round: number
  source: 'archive' | 'live'
  isOpen: boolean
  isEn: boolean
  onClose: () => void
}

function formatKst(iso: string | null | undefined, isEn: boolean) {
  if (!iso) return isEn ? '—' : '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(isEn ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul' })
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm font-black text-foreground">
        {value || '—'}
      </div>
    </div>
  )
}

function ChipGroup({
  label,
  options,
  value,
}: {
  label: string
  options: string[]
  value: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <span
            key={opt}
            className={cn(
              'rounded-xl px-3 py-2 text-xs font-black border',
              value === opt
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/20 text-muted-foreground border-border opacity-50'
            )}
          >
            {opt}
          </span>
        ))}
      </div>
    </div>
  )
}

export function HistoryParticipantModal({
  participant,
  sessionDate,
  round,
  source,
  isOpen,
  isEn,
  onClose,
}: HistoryParticipantModalProps) {
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)

  useEffect(() => {
    if (!isOpen || !participant.user_id) {
      setUserDetail(null)
      return
    }

    let cancelled = false
    setLoadingUser(true)
    void (async () => {
      try {
        const res = await fetch(`/api/admin/users/${participant.user_id}`)
        if (!res.ok) throw new Error('fetch_failed')
        const body = await res.json()
        if (!cancelled) setUserDetail(body.user ?? null)
      } catch {
        if (!cancelled) setUserDetail(null)
      } finally {
        if (!cancelled) setLoadingUser(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, participant.user_id])

  if (!isOpen) return null

  const checkedIn = Boolean(participant.checked_in_at)
  const paymentLabel = formatPaymentMethodLabel(
    participant.payment_method,
    participant.payment_status
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative w-full max-w-sm mx-4 max-h-[min(90vh,720px)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="border-none shadow-2xl rounded-[24px] overflow-hidden bg-card flex flex-col max-h-[inherit]">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-black flex items-center gap-2 min-w-0">
                <Settings className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">
                  {isEn ? 'Participant info' : '참가자 정보'}
                </span>
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg shrink-0"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="secondary" className="rounded-lg font-bold">
                {sessionDate}
              </Badge>
              <Badge variant="secondary" className="rounded-lg font-bold">
                {round} Round
              </Badge>
              <Badge variant="secondary" className="rounded-lg font-bold">
                {participant.table_label} Table
              </Badge>
              <Badge
                className={cn(
                  'rounded-lg font-bold border-0',
                  source === 'live'
                    ? 'bg-emerald-500/15 text-emerald-700'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {source === 'live'
                  ? isEn
                    ? 'Current week'
                    : '현재 주'
                  : isEn
                    ? 'Archive'
                    : '아카이브'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 overflow-y-auto flex-1 min-h-0 pb-5">
            <ReadOnlyField label={isEn ? 'Name' : '이름'} value={participant.name} />

            <div className="grid grid-cols-2 gap-3">
              <ChipGroup
                label={isEn ? 'Gender' : '성별'}
                options={['남', '여']}
                value={participant.gender}
              />
              <ChipGroup
                label={isEn ? 'Nationality' : '국적'}
                options={['한국인', '외국인']}
                value={participant.nationality}
              />
            </div>

            <ChipGroup
              label={isEn ? 'Language' : '언어'}
              options={[...SUPPORTED_LANGUAGES]}
              value={participant.language}
            />

            {participant.payment_method ? (
              <ReadOnlyField
                label={isEn ? 'Payment' : '결제'}
                value={paymentLabel || participant.payment_method}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-3">
              <ReadOnlyField
                label={isEn ? 'Check-in' : '체크인'}
                value={
                  checkedIn
                    ? formatKst(participant.checked_in_at, isEn)
                    : isEn
                      ? 'Not checked in'
                      : '미체크인'
                }
              />
              <ReadOnlyField
                label={isEn ? 'Applied at' : '신청일'}
                value={formatKst(participant.applied_at, isEn)}
              />
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <p className="text-sm font-black">{isEn ? 'Account' : '계정 정보'}</p>
              </div>

              {loadingUser ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : participant.user_id ? (
                <div className="space-y-2">
                  <ReadOnlyField
                    label={isEn ? 'Email' : '이메일'}
                    value={userDetail?.email || '—'}
                  />
                  <ReadOnlyField
                    label={isEn ? 'KakaoTalk ID' : '카카오톡 ID'}
                    value={userDetail?.kakao_id || '—'}
                  />
                  <ReadOnlyField
                    label={isEn ? 'Onboarding' : '온보딩'}
                    value={
                      userDetail?.onboarding_completed
                        ? isEn
                          ? 'Completed'
                          : '완료'
                        : isEn
                          ? 'Pending'
                          : '미완료'
                    }
                  />
                  <Button asChild variant="outline" className="w-full rounded-xl font-bold gap-2">
                    <Link href={`/admin/users/${participant.user_id}`}>
                      {isEn ? 'Open user profile' : '유저 상세 보기'}
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                  {isEn
                    ? 'No linked account for this archived record.'
                    : '연결된 계정 정보가 없는 기록입니다.'}
                </p>
              )}
            </div>

            {source === 'archive' ? (
              <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                {isEn
                  ? 'Historical snapshot — editing is not available here.'
                  : '히스토리 스냅샷입니다. 이 화면에서는 수정할 수 없습니다.'}
              </p>
            ) : null}

            <Button type="button" variant="outline" className="w-full rounded-xl font-bold" onClick={onClose}>
              {isEn ? 'Close' : '닫기'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
