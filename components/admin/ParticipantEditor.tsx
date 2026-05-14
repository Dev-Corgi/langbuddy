'use client'

import { useState, useCallback, useEffect } from 'react'
import { Settings, X, Trash2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type Participant = {
  id: string
  name: string
  gender: '남' | '여' | string
  nationality: '한국인' | '외국인' | string
  language: string
  checked_in_at: string | null
}

interface ParticipantEditorProps {
  participant: Participant
  isOpen: boolean
  onClose: () => void
  onSave: (updated: Participant) => void
  /** DB에서 form_responses 및 seating_assignments 삭제 — 마이페이지 신청·배치 기록에서도 제거됨 */
  onDelete?: (participant: Participant) => Promise<void>
  isDeleting?: boolean
}

export function ParticipantEditor({
  participant,
  isOpen,
  onClose,
  onSave,
  onDelete,
  isDeleting = false,
}: ParticipantEditorProps) {
  const [name, setName] = useState(participant.name)
  const [gender, setGender] = useState<'남' | '여'>(participant.gender as '남' | '여')
  const [nationality, setNationality] = useState<'한국인' | '외국인'>(participant.nationality as '한국인' | '외국인')
  const [language, setLanguage] = useState<string>(participant.language)

  useEffect(() => {
    setName(participant.name)
    setGender(participant.gender as '남' | '여')
    setNationality(participant.nationality as '한국인' | '외국인')
    setLanguage(participant.language)
  }, [participant])

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      toast.error('이름을 입력해주세요.')
      return
    }

    const updated: Participant = {
      ...participant,
      name: name.trim(),
      gender,
      nationality,
      language,
    }

    onSave(updated)
    onClose()
  }, [name, gender, nationality, language, participant, onSave, onClose])

  const handleDelete = useCallback(async () => {
    if (!onDelete) return
    const ok = window.confirm(
      `「${participant.name}」님의 신청을 삭제할까요?\n\n` +
        '신청·체크인·자리 배치 기록이 모두 제거되며, 사용자 마이페이지에서도 사라집니다. 이 작업은 되돌릴 수 없습니다.'
    )
    if (!ok) return
    try {
      await onDelete(participant)
      onClose()
    } catch {
      /* arrange 페이지에서 오류 토스트 처리 */
    }
  }, [onDelete, participant, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <Card className="border-none shadow-2xl rounded-[24px] overflow-hidden bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                참가자 정보 수정
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={onClose}
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
              <div className="flex gap-2 flex-wrap">
                {['영어', '일본어', '중국어', '스페인어', '프랑스어'].map((lang) => (
                  <Button
                    key={lang}
                    type="button"
                    variant={language === lang ? 'default' : 'outline'}
                    className="flex-1 rounded-xl text-xs font-bold min-w-[60px]"
                    onClick={() => setLanguage(lang)}
                  >
                    {lang}
                  </Button>
                ))}
              </div>
            </div>

            {onDelete ? (
              <Button
                type="button"
                variant="destructive"
                className="w-full rounded-xl font-bold gap-2"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                참가자 삭제
              </Button>
            ) : null}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl font-bold"
                onClick={onClose}
                disabled={isDeleting}
              >
                취소
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl font-black"
                onClick={handleSubmit}
                disabled={isDeleting}
              >
                저장
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
