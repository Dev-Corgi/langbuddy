'use client'

import { useState, useCallback } from 'react'
import { UserPlus, X, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import type { CoreFormQuestion } from '@/lib/utils'
import type { WalkInParticipant } from '@/lib/walk-in-participant'

interface ParticipantAdderProps {
  onAddParticipant: (participant: WalkInParticipant) => void
  formId: string
  sessionDate: string
  selectedDay: string
  formQuestions: CoreFormQuestion[]
  existingParticipantIds?: string[]
}

export function ParticipantAdder({
  onAddParticipant,
  formId,
  sessionDate,
  selectedDay,
  formQuestions: _formQuestions,
  existingParticipantIds = [],
}: ParticipantAdderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'남' | '여'>('남')
  const [nationality, setNationality] = useState<'한국인' | '외국인'>('한국인')
  const [language, setLanguage] = useState('영어')

  const handleManualSubmit = useCallback(async () => {
    if (!formId) {
      toast.error('오늘 세션 폼이 없습니다.')
      return
    }
    if (!name.trim()) {
      toast.error('이름을 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/walk-in-participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId,
          sessionDate,
          selectedDay,
          name: name.trim(),
          gender,
          nationality,
          language: language.trim() || '영어',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        participant?: WalkInParticipant
      }

      if (!res.ok || !data.participant) {
        toast.error(data.error || '참가자 추가에 실패했습니다.')
        return
      }

      if (existingParticipantIds.includes(data.participant.id)) {
        toast.info(`${data.participant.name}님은 이미 목록에 있습니다.`)
        return
      }

      onAddParticipant(data.participant)
      toast.success(`${data.participant.name}님이 추가되었습니다.`)

      setName('')
      setLanguage('영어')
      setGender('남')
      setNationality('한국인')
      setIsOpen(false)
    } catch (err) {
      console.error('[ParticipantAdder]', err)
      toast.error('참가자 추가에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }, [
    formId,
    sessionDate,
    selectedDay,
    name,
    gender,
    nationality,
    language,
    onAddParticipant,
    existingParticipantIds,
  ])

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full h-12 rounded-2xl font-black gap-2 text-base"
        variant="default"
        disabled={!formId}
      >
        <UserPlus className="w-4 h-4" />
        참가자 추가
      </Button>
    )
  }

  return (
    <Card className="border-none shadow-lg rounded-[24px] overflow-hidden bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            참가자 추가
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setIsOpen(false)}
            disabled={submitting}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground">이름</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="참가자 이름"
            className="rounded-xl"
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">성별</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={gender === '남' ? 'default' : 'outline'}
                className="flex-1 rounded-xl text-xs font-bold"
                onClick={() => setGender('남')}
                disabled={submitting}
              >
                남
              </Button>
              <Button
                type="button"
                variant={gender === '여' ? 'default' : 'outline'}
                className="flex-1 rounded-xl text-xs font-bold"
                onClick={() => setGender('여')}
                disabled={submitting}
              >
                여
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">국적</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={nationality === '한국인' ? 'default' : 'outline'}
                className="flex-1 rounded-xl text-xs font-bold"
                onClick={() => setNationality('한국인')}
                disabled={submitting}
              >
                한국인
              </Button>
              <Button
                type="button"
                variant={nationality === '외국인' ? 'default' : 'outline'}
                className="flex-1 rounded-xl text-xs font-bold"
                onClick={() => setNationality('외국인')}
                disabled={submitting}
              >
                외국인
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground">언어</label>
          <Input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="영어, 일본어 등"
            className="rounded-xl"
            disabled={submitting}
          />
        </div>

        <Button
          onClick={() => void handleManualSubmit()}
          className="w-full rounded-xl font-black"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              저장 중…
            </>
          ) : (
            '추가하기'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
