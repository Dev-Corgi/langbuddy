import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { ApplicationRow } from '../_lib/types'
import type { Locale } from '@/lib/i18n'
import { formatSessionDateLabel } from '@/lib/session-event-date'

type Props = {
  title: string
  emptyMessage: string
  isEn: boolean
  applications: ApplicationRow[]
  labels: {
    categoryLe: string
    categoryStudy: string
    categoryMeetup: string
  }
  locale: Locale
}

function categoryVariant(cat: ApplicationRow['category']): 'default' | 'secondary' | 'outline' {
  if (cat === '언어교환') return 'default'
  if (cat === '스터디') return 'secondary'
  return 'outline'
}

function categoryLabel(cat: ApplicationRow['category'], t: Props['labels']) {
  if (cat === '언어교환') return t.categoryLe
  if (cat === '스터디') return t.categoryStudy
  return t.categoryMeetup
}

export function ApplicationsListCard({ title, emptyMessage, isEn, applications, labels, locale }: Props) {
  let description: string
  if (applications.length > 0) {
    description = isEn
      ? `${applications.length} application${applications.length === 1 ? '' : 's'}`
      : `총 ${applications.length}건의 신청`
  } else {
    description = isEn ? 'Your applications will appear here.' : '신청 내역이 여기에 표시됩니다.'
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {applications.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          applications.map((a, idx) => (
            <div key={a.id}>
              {idx > 0 ? <Separator className="my-3" /> : null}
              <div className="rounded-xl border border-transparent transition-colors hover:border-border hover:bg-muted/40">
                <Link
                  href={a.applicationHref}
                  className="group block rounded-xl px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={categoryVariant(a.category)} className="font-semibold">
                      {categoryLabel(a.category, labels)}
                    </Badge>
                    <time
                      dateTime={a.eventDate}
                      className="text-xs font-medium text-muted-foreground tabular-nums"
                    >
                      {formatSessionDateLabel(a.eventDate, locale === 'en' ? 'en' : 'ko')}
                    </time>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold tracking-tight text-foreground group-hover:text-primary">
                    {a.label || '—'}
                  </p>
                </Link>
                {a.meetupHref ? (
                  <div className="px-3 pb-3">
                    <Link
                      href={a.meetupHref}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {isEn ? 'View meetup details' : '모임 안내 보기'}
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
