'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { UserPlus, X, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { PaymentMethodFields } from '@/components/admin/payment-method-fields'
import { parseWalkInCsvText, type WalkInCsvRow } from '@/lib/walk-in-csv-parser'
import type { CoreFormQuestion } from '@/lib/utils'
import type { WalkInParticipant } from '@/lib/walk-in-participant'
import { SUPPORTED_LANGUAGES } from '@/lib/supported-languages'
import {
  isBankTransferMethod,
  type PaymentMethod,
} from '@/lib/supported-payment-methods'

interface ParticipantAdderProps {
  onAddParticipant: (participant: WalkInParticipant) => void
  formId: string
  sessionDate: string
  selectedDay: string
  formQuestions: CoreFormQuestion[]
  existingParticipantIds?: string[]
}

const CSV_PLACEHOLDER = `민건우,남자,한국인,영어
손예나,여자,한국인,영어
Jacky,남자,Foreigner,영어`

async function postWalkInParticipant(
  payload: {
    formId: string
    sessionDate: string
    selectedDay: string
    name: string
    gender: string
    nationality: string
    language: string
    paymentMethod?: PaymentMethod
  }
): Promise<{ ok: true; participant: WalkInParticipant } | { ok: false; error: string }> {
  const res = await fetch('/api/admin/walk-in-participant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    participant?: WalkInParticipant
  }

  if (!res.ok || !data.participant) {
    return { ok: false, error: data.error || '참가자 추가에 실패했습니다.' }
  }
  return { ok: true, participant: data.participant }
}

async function uploadParticipantReceipt(
  participantId: string,
  file: File
): Promise<{ ok: true; participant: WalkInParticipant } | { ok: false; error: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`/api/admin/form-response-participant/${participantId}`, {
    method: 'POST',
    body: formData,
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    participant?: WalkInParticipant
  }

  if (!res.ok || !data.participant) {
    return { ok: false, error: data.error || '영수증 업로드에 실패했습니다.' }
  }
  return { ok: true, participant: data.participant }
}

function CsvPreviewTable({ rows }: { rows: WalkInCsvRow[] }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto max-h-48">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-2 py-2 text-left font-black text-muted-foreground">#</th>
              <th className="px-2 py-2 text-left font-black text-muted-foreground">이름</th>
              <th className="px-2 py-2 text-left font-black text-muted-foreground">성별</th>
              <th className="px-2 py-2 text-left font-black text-muted-foreground">국적</th>
              <th className="px-2 py-2 text-left font-black text-muted-foreground">언어</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.lineNum} className="border-b border-border/60 even:bg-muted/10">
                <td className="px-2 py-1.5 font-bold text-muted-foreground">{idx + 1}</td>
                <td className="px-2 py-1.5 font-bold">{row.name}</td>
                <td className="px-2 py-1.5 font-bold">{row.gender}</td>
                <td className="px-2 py-1.5 font-bold">{row.nationality}</td>
                <td className="px-2 py-1.5 font-bold">{row.language}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
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
  const [tab, setTab] = useState<'manual' | 'csv'>('manual')
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'남' | '여'>('남')
  const [nationality, setNationality] = useState<'한국인' | '외국인'>('한국인')
  const [language, setLanguage] = useState('영어')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('현장현금')
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null)
  const [pendingReceiptPreview, setPendingReceiptPreview] = useState<string | null>(null)
  const [csvText, setCsvText] = useState('')
  const pendingPreviewRef = useRef<string | null>(null)

  const clearPendingReceiptPreview = useCallback(() => {
    if (pendingPreviewRef.current) {
      URL.revokeObjectURL(pendingPreviewRef.current)
      pendingPreviewRef.current = null
    }
    setPendingReceiptPreview(null)
    setPendingReceiptFile(null)
  }, [])

  useEffect(() => {
    return () => {
      if (pendingPreviewRef.current) {
        URL.revokeObjectURL(pendingPreviewRef.current)
      }
    }
  }, [])

  const handlePaymentMethodChange = useCallback(
    (value: PaymentMethod) => {
      setPaymentMethod(value)
      if (!isBankTransferMethod(value)) {
        clearPendingReceiptPreview()
      }
    },
    [clearPendingReceiptPreview]
  )

  const handleReceiptFileSelect = useCallback(
    (file: File) => {
      if (pendingPreviewRef.current) {
        URL.revokeObjectURL(pendingPreviewRef.current)
      }
      const preview = URL.createObjectURL(file)
      pendingPreviewRef.current = preview
      setPendingReceiptFile(file)
      setPendingReceiptPreview(preview)
      if (!isBankTransferMethod(paymentMethod)) {
        setPaymentMethod('계좌이체')
      }
    },
    [paymentMethod]
  )

  const csvParse = useMemo(() => {
    if (!csvText.trim()) return null
    return parseWalkInCsvText(csvText)
  }, [csvText])

  const resetManualForm = useCallback(() => {
    setName('')
    setLanguage('영어')
    setGender('남')
    setNationality('한국인')
    setPaymentMethod('현장현금')
    clearPendingReceiptPreview()
  }, [clearPendingReceiptPreview])

  const closePanel = useCallback(() => {
    setIsOpen(false)
    setTab('manual')
    resetManualForm()
    setCsvText('')
  }, [resetManualForm])

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
      const result = await postWalkInParticipant({
        formId,
        sessionDate,
        selectedDay,
        name: name.trim(),
        gender,
        nationality,
        language: language.trim() || '영어',
        paymentMethod,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      let participant = result.participant

      if (pendingReceiptFile) {
        const uploadResult = await uploadParticipantReceipt(participant.id, pendingReceiptFile)
        if (!uploadResult.ok) {
          toast.error(uploadResult.error)
          toast.info(`${participant.name}님은 추가되었습니다. 영수증은 참가자 수정에서 다시 올려주세요.`)
          if (!existingParticipantIds.includes(participant.id)) {
            onAddParticipant(participant)
          }
          resetManualForm()
          closePanel()
          return
        }
        participant = uploadResult.participant as WalkInParticipant
      }

      if (existingParticipantIds.includes(participant.id)) {
        toast.info(`${participant.name}님은 이미 목록에 있습니다.`)
        return
      }

      onAddParticipant(participant)
      toast.success(`${participant.name}님이 추가되었습니다.`)
      resetManualForm()
      closePanel()
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
    paymentMethod,
    pendingReceiptFile,
    onAddParticipant,
    existingParticipantIds,
    resetManualForm,
    closePanel,
  ])

  const handleCsvSubmit = useCallback(async () => {
    if (!formId) {
      toast.error('오늘 세션 폼이 없습니다.')
      return
    }
    if (!csvText.trim()) {
      toast.error('CSV 행을 입력해주세요.')
      return
    }

    const parsed = parseWalkInCsvText(csvText)
    if (parsed.errors.length > 0) {
      toast.error(`데이터 검증 실패 (${parsed.errors.length}건)`, {
        description: parsed.errors.slice(0, 4).join('\n'),
      })
      return
    }
    if (parsed.rows.length === 0) {
      toast.error('추가할 참가자가 없습니다.')
      return
    }

    setSubmitting(true)
    const knownIds = new Set(existingParticipantIds)
    let added = 0
    let skipped = 0

    try {
      for (const row of parsed.rows) {
        const result = await postWalkInParticipant({
          formId,
          sessionDate,
          selectedDay,
          name: row.name,
          gender: row.gender,
          nationality: row.nationality,
          language: row.language,
        })

        if (!result.ok) {
          toast.error(`${row.lineNum}번째 줄 (${row.name}): ${result.error}`)
          if (added > 0) {
            toast.info(`${added}명은 이미 추가되었습니다.`)
          }
          return
        }

        if (knownIds.has(result.participant.id)) {
          skipped++
          continue
        }

        knownIds.add(result.participant.id)
        onAddParticipant(result.participant)
        added++
      }

      if (added === 0 && skipped > 0) {
        toast.info('입력한 참가자가 모두 이미 목록에 있습니다.')
        return
      }

      const skipNote = skipped > 0 ? ` (${skipped}명 중복 제외)` : ''
      toast.success(`${added}명 추가 완료${skipNote}`)
      setCsvText('')
      closePanel()
    } catch (err) {
      console.error('[ParticipantAdder CSV]', err)
      toast.error('CSV 처리 중 오류가 발생했습니다.')
      if (added > 0) {
        toast.info(`${added}명은 이미 추가되었습니다.`)
      }
    } finally {
      setSubmitting(false)
    }
  }, [
    formId,
    csvText,
    sessionDate,
    selectedDay,
    onAddParticipant,
    existingParticipantIds,
    closePanel,
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
            onClick={closePanel}
            disabled={submitting}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'manual' | 'csv')}>
          <TabsList className="grid w-full grid-cols-2 h-10 p-1 rounded-xl bg-muted mb-3">
            <TabsTrigger
              value="manual"
              className="rounded-lg text-xs font-black data-[state=active]:bg-card data-[state=active]:shadow-sm"
              disabled={submitting}
            >
              직접 입력
            </TabsTrigger>
            <TabsTrigger
              value="csv"
              className="rounded-lg text-xs font-black data-[state=active]:bg-card data-[state=active]:shadow-sm"
              disabled={submitting}
            >
              CSV 입력
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-3 mt-0">
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
              <div className="flex gap-2">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <Button
                    key={lang}
                    type="button"
                    variant={language === lang ? 'default' : 'outline'}
                    className="flex-1 rounded-xl text-xs font-bold"
                    onClick={() => setLanguage(lang)}
                    disabled={submitting}
                  >
                    {lang}
                  </Button>
                ))}
              </div>
            </div>

            <PaymentMethodFields
              paymentMethod={paymentMethod}
              onPaymentMethodChange={handlePaymentMethodChange}
              disabled={submitting}
              pendingReceiptPreview={pendingReceiptPreview}
              onReceiptFileSelect={handleReceiptFileSelect}
              pendingReceiptHint={
                pendingReceiptFile ? '선택됨 — 추가 시 업로드됩니다' : undefined
              }
            />

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
          </TabsContent>

          <TabsContent value="csv" className="space-y-3 mt-0">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">
                CSV 행 입력
                <span className="font-medium text-muted-foreground/80 ml-1">
                  (이름,성별,국적,언어)
                </span>
              </label>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={CSV_PLACEHOLDER}
                className="min-h-[140px] rounded-xl font-mono text-xs resize-y"
                disabled={submitting}
              />
            </div>

            {csvParse && csvParse.errors.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                {csvParse.errors.slice(0, 5).map((err) => (
                  <p key={err} className="text-xs font-bold text-destructive">
                    {err}
                  </p>
                ))}
                {csvParse.errors.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    외 {csvParse.errors.length - 5}건…
                  </p>
                )}
              </div>
            )}

            {csvParse && csvParse.errors.length === 0 && csvParse.rows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground">
                  미리보기 ({csvParse.rows.length}명)
                </p>
                <CsvPreviewTable rows={csvParse.rows} />
              </div>
            )}

            <Button
              onClick={() => void handleCsvSubmit()}
              className="w-full rounded-xl font-black"
              disabled={
                submitting ||
                !csvText.trim() ||
                !csvParse ||
                csvParse.errors.length > 0 ||
                csvParse.rows.length === 0
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  추가 중…
                </>
              ) : (
                <>
                  {csvParse && csvParse.errors.length === 0 && csvParse.rows.length > 0
                    ? `${csvParse.rows.length}명 추가하기`
                    : '추가하기'}
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
