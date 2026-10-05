'use client'

import Link from 'next/link'
import { Flag, MessageCircleWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PastParticipationSession } from '@/lib/previous-participation-history'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessions: PastParticipationSession[]
  isEn: boolean
}

export function PastParticipationReportDialog({ open, onOpenChange, sessions, isEn }: Props) {
  const recentSessions = sessions.slice(0, 3)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <div className="p-6 pb-0 space-y-4">
          <DialogHeader className="space-y-3">
            <div className="mx-auto sm:mx-0 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageCircleWarning className="size-6 text-primary" />
            </div>
            <DialogTitle className="text-xl font-black text-foreground">
              {isEn ? 'How were your past meetups?' : '지난 모임은 어떠셨나요?'}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed font-medium text-muted-foreground">
              {isEn
                ? 'We see you have joined Lang Buddy before. If anything felt uncomfortable or you need to report a participant, you can do so anonymously from My Page. Your feedback helps keep our community safe.'
                : '이전에 Lang Buddy 모임에 참여하신 기록이 있어요. 불편한 경험이 있었거나 신고가 필요한 상황이었다면 마이페이지에서 익명으로 알려주세요. 더 안전한 모임 환경을 만드는 데 큰 도움이 됩니다.'}
            </DialogDescription>
          </DialogHeader>

          {recentSessions.length > 0 ? (
            <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {isEn ? 'Recent sessions' : '최근 참여 세션'}
              </p>
              <ul className="space-y-2">
                {recentSessions.map((session) => (
                  <li key={`${session.postingId}|${session.sessionDate}`}>
                    <Link
                      href={`/my/sessions/${session.postingId}/${session.sessionDate}`}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <span>{session.sessionLabel || session.sessionDate}</span>
                      <span className="text-xs font-black text-primary shrink-0">
                        {isEn ? 'Report' : '신고하기'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="p-6 pt-4 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            className="font-bold"
            onClick={() => onOpenChange(false)}
          >
            {isEn ? 'All good' : '괜찮아요'}
          </Button>
          <Button asChild className="font-black">
            <Link href="/my" onClick={() => onOpenChange(false)}>
              <Flag className="size-4 mr-2" />
              {isEn ? 'Go to My Page' : '마이페이지에서 확인'}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
