'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, Loader2, Trash2 } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'

interface ResponseResetSettingsProps {
  formId: string
}

export function ResponseResetSettings({ formId }: ResponseResetSettingsProps) {
  const locale = useLocale()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [lastGlobalResetAt, setLastGlobalResetAt] = useState<string | null>(null)

  useEffect(() => {
    void fetchGlobalState()
  }, [])

  async function fetchGlobalState() {
    setLoading(true)
    const { data } = await supabase
      .from('weekly_response_reset_state')
      .select('last_reset_at')
      .eq('id', 'global')
      .maybeSingle()

    setLastGlobalResetAt(data?.last_reset_at ?? null)
    setLoading(false)
  }

  async function resetNow() {
    if (
      !confirm(
        locale === 'en'
          ? 'Delete all responses for this form now? (Form questions are kept.)'
          : '이 폼의 신청 응답을 지금 모두 삭제할까요? (질문지는 유지됩니다.)'
      )
    ) {
      return
    }

    setResetting(true)
    try {
      const { data: rows, error: idsErr } = await supabase
        .from('form_responses')
        .select('id')
        .eq('form_id', formId)

      if (idsErr) {
        alert(locale === 'en' ? 'Failed to load responses.' : '응답 목록을 불러오지 못했습니다.')
        return
      }

      const ids = (rows ?? []).map((r) => r.id).filter(Boolean)
      if (ids.length > 0) {
        const { error: seatingDelErr } = await supabase
          .from('seating_assignments')
          .delete()
          .in('participant_id', ids)

        if (seatingDelErr) {
          alert(
            locale === 'en'
              ? 'Failed to clear seating for responses.'
              : '자리 배치 데이터 초기화에 실패했습니다.'
          )
          return
        }
      }

      const { error } = await supabase.from('form_responses').delete().eq('form_id', formId)

      if (error) {
        alert(locale === 'en' ? 'Failed to delete responses.' : '응답 삭제에 실패했습니다.')
      } else {
        alert(locale === 'en' ? 'All responses deleted!' : '이 폼의 응답이 삭제되었습니다!')
      }
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <Card className="rounded-[32px]">
        <CardContent className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-[32px] border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-black flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          {locale === 'en' ? 'Response reset' : '응답 초기화'}
        </CardTitle>
        <CardDescription className="font-medium leading-relaxed">
          {locale === 'en'
            ? 'Language exchange forms are cleared automatically every Sunday at 00:00 (Seoul). Only applications and seating rows are removed — form questions and schedules stay.'
            : '언어교환에 연결된 폼은 매주 일요일 0시(서울)에 신청 응답과 자리 배치 기록이 자동으로 비워집니다. 질문지와 스케줄 연결은 그대로 유지됩니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastGlobalResetAt ? (
          <div className="text-sm text-muted-foreground font-medium p-3 rounded-xl bg-muted/50">
            {locale === 'en' ? 'Last automatic reset (all recurring forms): ' : '마지막 자동 초기화(전체 반복 모임): '}
            <span className="font-black text-foreground">
              {new Date(lastGlobalResetAt).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR', {
                timeZone: 'Asia/Seoul',
              })}
            </span>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={resetNow}
          disabled={resetting}
          variant="outline"
          className="w-full h-12 rounded-xl border-destructive text-destructive hover:bg-destructive/10 font-black"
        >
          {resetting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {locale === 'en' ? 'Deleting...' : '삭제 중...'}
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              {locale === 'en' ? 'Clear this form now' : '이 폼 응답 지금 비우기'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
