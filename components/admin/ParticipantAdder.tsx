'use client'

import { useState, useCallback } from 'react'
import { UserPlus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { randomUuidV4, type CoreFormQuestion } from '@/lib/utils'

type Participant = {
  id: string
  name: string
  gender: '남' | '여' | string
  nationality: '한국인' | '외국인' | string
  language: string
  checked_in_at: string | null
}

interface ParticipantAdderProps {
  onAddParticipant: (participant: Participant) => void
  /** 자리배치 페이지 호환용 — QR 체크인은 `/admin/qr-scanner`에서 처리 */
  formId: string
  formQuestions: CoreFormQuestion[]
  existingParticipantIds?: string[]
}

export function ParticipantAdder({
  onAddParticipant,
  formId: _formId,
  formQuestions: _formQuestions,
  existingParticipantIds: _existingParticipantIds,
}: ParticipantAdderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'남' | '여'>('남')
  const [nationality, setNationality] = useState<'한국인' | '외국인'>('한국인')
  const [language, setLanguage] = useState('영어')

  const handleManualSubmit = useCallback(() => {
    if (!name.trim()) {
      toast.error('이름을 입력해주세요.')
      return
    }

    const newParticipant: Participant = {
      id: randomUuidV4(),
      name: name.trim(),
      gender,
      nationality,
      language,
      checked_in_at: new Date().toISOString(),
    }

    onAddParticipant(newParticipant)
    toast.success(`${name.trim()}님이 추가되었습니다.`)

    setName('')
    setLanguage('영어')
    setGender('남')
    setNationality('한국인')
    setIsOpen(false)
  }, [name, gender, nationality, language, onAddParticipant])

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full h-12 rounded-2xl font-black gap-2 text-base"
        variant="default"
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
              >
                남
              </Button>
              <Button
                type="button"
                variant={gender === '여' ? 'default' : 'outline'}
                className="flex-1 rounded-xl text-xs font-bold"
                onClick={() => setGender('여')}
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
              >
                한국인
              </Button>
              <Button
                type="button"
                variant={nationality === '외국인' ? 'default' : 'outline'}
                className="flex-1 rounded-xl text-xs font-bold"
                onClick={() => setNationality('외국인')}
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
          />
        </div>

        <Button onClick={handleManualSubmit} className="w-full rounded-xl font-black">
          추가하기
        </Button>
      </CardContent>
    </Card>
  )
}
