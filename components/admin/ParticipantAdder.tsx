'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { UserPlus, X, QrCode } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { extractParticipantInfoFromAnswers, randomUuidV4, type CoreFormQuestion } from '@/lib/utils'

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
  formId: string
  formQuestions: CoreFormQuestion[]
  existingParticipantIds?: string[]
}

export function ParticipantAdder({ onAddParticipant, formId, formQuestions, existingParticipantIds = [] }: ParticipantAdderProps) {
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'남' | '여'>('남')
  const [nationality, setNationality] = useState<'한국인' | '외국인'>('한국인')
  const [language, setLanguage] = useState('영어')
  const [tab, setTab] = useState<'manual' | 'qr'>('manual')
  const [scannerActive, setScannerActive] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    if (scannerActive && !scannerRef.current && tab === 'qr') {
      const scanner = new Html5QrcodeScanner(
        "participant-qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      )
      
      scanner.render(onScanSuccess, onScanFailure)
      scannerRef.current = scanner
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
        scannerRef.current = null
      }
    }
  }, [scannerActive, tab])

  async function onScanSuccess(decodedText: string) {
    setScannerActive(false)
    
    try {
      console.log('🔍 [QR스캔] QR 코드:', decodedText)
      
      const { data: responseData, error: responseError } = await supabase
        .from('form_responses')
        .select('*')
        .eq('qr_code', decodedText)
        .single()

      console.log('🔍 [QR스캔] 응답 데이터:', responseData)
      console.log('🔍 [QR스캔] 응답 form_id:', responseData?.form_id)
      console.log('🔍 [QR스캔] 현재 세션 form_id:', formId)

      if (responseError || !responseData) {
        console.error('❌ [QR스캔] 유효하지 않은 QR:', responseError)
        toast.error('유효하지 않은 QR 코드입니다.')
        setScannerActive(true)
        return
      }

      if (responseData.form_id !== formId) {
        console.error('❌ [QR스캔] form_id 불일치!')
        console.error('  - 응답 form_id:', responseData.form_id)
        console.error('  - 현재 세션 form_id:', formId)
        toast.error('다른 세션의 QR 코드입니다.')
        setScannerActive(true)
        return
      }
      
      console.log('✅ [QR스캔] form_id 일치 확인!')

      const alreadyListed = existingParticipantIds.includes(responseData.id)
      if (alreadyListed && responseData.checked_in_at) {
        toast.warning('이미 체크인된 참가자입니다.')
        setScannerActive(true)
        return
      }

      const info = extractParticipantInfoFromAnswers(responseData.answers || {}, formQuestions)
      const displayName = info.name || responseData.answers?.name || responseData.answers?.이름 || 'Anonymous'

      let checkedInAt: string | null = responseData.checked_in_at

      if (!checkedInAt) {
        console.log('🔄 [QR스캔] 자동 출석체크 진행...')
        const now = new Date().toISOString()
        const { error: checkInError } = await supabase
          .from('form_responses')
          .update({ checked_in_at: now })
          .eq('id', responseData.id)

        if (checkInError) {
          console.error('❌ [QR스캔] 출석체크 실패:', checkInError)
          toast.error('출석체크에 실패했습니다.')
          setScannerActive(true)
          return
        }
        checkedInAt = now
        console.log('✅ [QR스캔] 출석체크 완료')
      }

      const newParticipant: Participant = {
        id: responseData.id,
        name: displayName,
        gender: info.gender || responseData.answers?.gender || responseData.answers?.성별 || '?',
        nationality: info.nationality || responseData.answers?.nationality || responseData.answers?.국적 || '?',
        language: responseData.answers?._selected_language || info.language || '-',
        checked_in_at: checkedInAt,
      }

      onAddParticipant(newParticipant)
      
      // QR 표시 질문들의 답변 표시
      const qrQuestions = formQuestions.filter(q => q.show_in_qr || q.system_key)
      const qrInfo = qrQuestions.map(q => {
        const answer = responseData.answers?.[q.id]
        const displayAnswer = Array.isArray(answer) ? answer.join(', ') : (answer || '-')
        return `${q.question_text}: ${displayAnswer}`
      }).join(' | ')
      
      toast.success(
        <div className="space-y-1">
          <div className="font-black">{displayName}님이 추가되었습니다.</div>
          {qrInfo && <div className="text-xs text-muted-foreground">{qrInfo}</div>}
        </div>,
        { duration: 5000 }
      )
      
      if ('vibrate' in navigator) navigator.vibrate(200)
      
    } catch (err) {
      console.error(err)
      toast.error('참가자 추가에 실패했습니다.')
    }
    
    setTimeout(() => setScannerActive(true), 2000)
  }

  function onScanFailure(error: any) {
    // Silent failure
  }

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
      checked_in_at: new Date().toISOString()
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
            onClick={() => {
              setIsOpen(false)
              setScannerActive(false)
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={tab} onValueChange={(v) => {
          setTab(v as 'manual' | 'qr')
          if (v === 'qr') {
            setScannerActive(false)
          }
        }}>
          <TabsList className="w-full mb-3">
            <TabsTrigger value="manual" className="flex-1">
              직접 입력
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex-1">
              QR 스캔
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-3">
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

            <Button
              onClick={handleManualSubmit}
              className="w-full rounded-xl font-black"
            >
              추가하기
            </Button>
          </TabsContent>

          <TabsContent value="qr" className="space-y-3">
            {!scannerActive ? (
              <Button 
                onClick={() => setScannerActive(true)}
                className="w-full h-32 rounded-3xl bg-primary hover:bg-secondary text-xl font-black flex flex-col gap-2"
              >
                <QrCode className="w-10 h-10" />
                QR 스캐너 시작
              </Button>
            ) : (
              <div className="space-y-4">
                <div id="participant-qr-reader" className="overflow-hidden rounded-2xl border-4 border-muted" />
                <Button 
                  variant="outline" 
                  onClick={() => setScannerActive(false)}
                  className="w-full h-12 rounded-xl font-bold"
                >
                  스캐너 중지
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
