'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Settings, X, Trash2, Loader2, LogIn, LogOut } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { StampProgressEditor, type StampProgressEditorHandle } from '@/components/admin/stamp-progress-editor'
import { PaymentMethodFields } from '@/components/admin/payment-method-fields'
import { SUPPORTED_LANGUAGES } from '@/lib/supported-languages'
import {
  isBankTransferMethod,
  type PaymentMethod,
} from '@/lib/supported-payment-methods'

type Participant = {
  id: string
  name: string
  gender: '남' | '여' | string
  nationality: '한국인' | '외국인' | string
  language: string
  checked_in_at: string | null
  userId?: string | null
  paymentMethod?: PaymentMethod | null
  paymentStatus?: string | null
  paymentReceiptUrl?: string | null
}

type SavedFields = {
  name: string
  gender: string
  nationality: string
  language: string
  paymentMethod: PaymentMethod | null
}

interface ParticipantEditorProps {
  participant: Participant
  isOpen: boolean
  onClose: () => void
  onFieldSave: (updated: Participant) => Promise<boolean>
  onReceiptUpload?: (participantId: string, file: File) => Promise<Participant | null>
  onCheckin: (participant: Participant) => Promise<void>
  onUncheckin: (participant: Participant) => Promise<void>
  /** DB에서 form_responses 및 seating_assignments 삭제 — 마이페이지 신청·배치 기록에서도 제거됨 */
  onDelete?: (participant: Participant) => Promise<void>
  isDeleting?: boolean
}

export function ParticipantEditor({
  participant,
  isOpen,
  onClose,
  onFieldSave,
  onReceiptUpload,
  onCheckin,
  onUncheckin,
  onDelete,
  isDeleting = false,
}: ParticipantEditorProps) {
  const [name, setName] = useState(participant.name)
  const [gender, setGender] = useState<'남' | '여'>(participant.gender as '남' | '여')
  const [nationality, setNationality] = useState<'한국인' | '외국인'>(participant.nationality as '한국인' | '외국인')
  const [language, setLanguage] = useState<string>(participant.language)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    participant.paymentMethod ?? null
  )
  const [receiptUrl, setReceiptUrl] = useState<string | null>(
    participant.paymentReceiptUrl ?? null
  )
  const [paymentStatus, setPaymentStatus] = useState<string | null>(
    participant.paymentStatus ?? null
  )
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null)
  const [pendingReceiptPreview, setPendingReceiptPreview] = useState<string | null>(null)
  const [flushing, setFlushing] = useState(false)
  const [checkinBusy, setCheckinBusy] = useState(false)
  const [stampDirty, setStampDirty] = useState(false)
  const stampEditorRef = useRef<StampProgressEditorHandle>(null)
  const pendingPreviewRef = useRef<string | null>(null)

  const savedFieldsRef = useRef<SavedFields>({
    name: participant.name,
    gender: participant.gender,
    nationality: participant.nationality,
    language: participant.language,
    paymentMethod: participant.paymentMethod ?? null,
  })

  const clearPendingReceiptPreview = useCallback(() => {
    if (pendingPreviewRef.current) {
      URL.revokeObjectURL(pendingPreviewRef.current)
      pendingPreviewRef.current = null
    }
    setPendingReceiptPreview(null)
    setPendingReceiptFile(null)
  }, [])

  useEffect(() => {
    setName(participant.name)
    setGender(participant.gender as '남' | '여')
    setNationality(participant.nationality as '한국인' | '외국인')
    setLanguage(participant.language)
    setPaymentMethod(participant.paymentMethod ?? null)
    setReceiptUrl(participant.paymentReceiptUrl ?? null)
    setPaymentStatus(participant.paymentStatus ?? null)
    clearPendingReceiptPreview()
    setStampDirty(false)
    savedFieldsRef.current = {
      name: participant.name,
      gender: participant.gender,
      nationality: participant.nationality,
      language: participant.language,
      paymentMethod: participant.paymentMethod ?? null,
    }
  }, [participant, clearPendingReceiptPreview])

  useEffect(() => {
    return () => {
      if (pendingPreviewRef.current) {
        URL.revokeObjectURL(pendingPreviewRef.current)
      }
    }
  }, [])

  const buildPatch = useCallback((): Participant => {
    return {
      ...participant,
      name: name.trim(),
      gender,
      nationality,
      language,
      paymentMethod,
      paymentStatus,
      paymentReceiptUrl: receiptUrl,
    }
  }, [participant, name, gender, nationality, language, paymentMethod, paymentStatus, receiptUrl])

  const hasFieldChanges = useCallback(
    (patch: Participant) => {
      const prev = savedFieldsRef.current
      return (
        patch.name !== prev.name ||
        patch.gender !== prev.gender ||
        patch.nationality !== prev.nationality ||
        patch.language !== prev.language ||
        (patch.paymentMethod ?? null) !== prev.paymentMethod
      )
    },
    []
  )

  const hasPendingChanges = useCallback(() => {
    const patch = buildPatch()
    return (
      hasFieldChanges(patch) ||
      pendingReceiptFile != null ||
      stampDirty
    )
  }, [buildPatch, hasFieldChanges, pendingReceiptFile, stampDirty])

  const persistFieldsIfChanged = useCallback(
    async (patch: Participant): Promise<boolean> => {
      if (!hasFieldChanges(patch)) return true
      if (!patch.name.trim()) {
        toast.error('이름을 입력해주세요.')
        return false
      }

      const ok = await onFieldSave(patch)
      if (ok) {
        savedFieldsRef.current = {
          name: patch.name,
          gender: patch.gender,
          nationality: patch.nationality,
          language: patch.language,
          paymentMethod: patch.paymentMethod ?? null,
        }
      }
      return ok
    },
    [hasFieldChanges, onFieldSave]
  )

  const flushPendingChanges = useCallback(async (): Promise<boolean> => {
    const patch = buildPatch()

    if (pendingReceiptFile && onReceiptUpload) {
      const updated = await onReceiptUpload(participant.id, pendingReceiptFile)
      if (!updated) return false
      setPaymentMethod(updated.paymentMethod ?? '계좌이체')
      setReceiptUrl(updated.paymentReceiptUrl ?? null)
      setPaymentStatus(updated.paymentStatus ?? 'pending')
      savedFieldsRef.current.paymentMethod = updated.paymentMethod ?? '계좌이체'
      clearPendingReceiptPreview()
      patch.paymentMethod = updated.paymentMethod ?? '계좌이체'
      patch.paymentReceiptUrl = updated.paymentReceiptUrl ?? null
      patch.paymentStatus = updated.paymentStatus ?? 'pending'
    }

    const fieldsOk = await persistFieldsIfChanged(patch)
    if (!fieldsOk) return false

    return (await stampEditorRef.current?.flushPendingSave()) ?? true
  }, [
    buildPatch,
    clearPendingReceiptPreview,
    onReceiptUpload,
    participant.id,
    pendingReceiptFile,
    persistFieldsIfChanged,
  ])

  const handleClose = useCallback(async () => {
    if (checkinBusy || flushing || isDeleting) return

    if (!hasPendingChanges()) {
      onClose()
      return
    }

    setFlushing(true)
    try {
      const ok = await flushPendingChanges()
      if (ok) onClose()
    } finally {
      setFlushing(false)
    }
  }, [checkinBusy, flushPendingChanges, flushing, hasPendingChanges, isDeleting, onClose])

  const handleCheckin = useCallback(async () => {
    if (checkinBusy || flushing || isDeleting) return

    setFlushing(true)
    try {
      if (!(await flushPendingChanges())) return

      const patch = buildPatch()
      setCheckinBusy(true)
      try {
        await onCheckin({ ...patch, checked_in_at: participant.checked_in_at })
      } catch {
        /* arrange 페이지에서 오류 토스트 처리 */
      } finally {
        setCheckinBusy(false)
      }
    } finally {
      setFlushing(false)
    }
  }, [
    buildPatch,
    checkinBusy,
    flushPendingChanges,
    flushing,
    isDeleting,
    onCheckin,
    participant.checked_in_at,
  ])

  const handleUncheckin = useCallback(async () => {
    if (checkinBusy || flushing || isDeleting) return

    setFlushing(true)
    try {
      if (!(await flushPendingChanges())) return

      const patch = buildPatch()
      setCheckinBusy(true)
      try {
        await onUncheckin({ ...patch, checked_in_at: participant.checked_in_at })
      } catch {
        /* arrange 페이지에서 오류 토스트 처리 */
      } finally {
        setCheckinBusy(false)
      }
    } finally {
      setFlushing(false)
    }
  }, [
    buildPatch,
    checkinBusy,
    flushPendingChanges,
    flushing,
    isDeleting,
    onUncheckin,
    participant.checked_in_at,
  ])

  const handleDelete = useCallback(async () => {
    if (!onDelete || flushing || checkinBusy) return
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
  }, [checkinBusy, flushing, onDelete, participant, onClose])

  const handlePaymentMethodChange = useCallback(
    (value: PaymentMethod) => {
      setPaymentMethod(value)
      if (!isBankTransferMethod(value)) {
        setReceiptUrl(null)
        setPaymentStatus(null)
        clearPendingReceiptPreview()
      } else if (!receiptUrl && !pendingReceiptFile) {
        setPaymentStatus(null)
      }
    },
    [clearPendingReceiptPreview, pendingReceiptFile, receiptUrl]
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

  if (!isOpen) return null

  const busy = flushing || checkinBusy || isDeleting
  const checkedIn = Boolean(participant.checked_in_at)
  const dirty =
    hasFieldChanges(buildPatch()) || pendingReceiptFile != null || stampDirty

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="absolute inset-0"
        onClick={() => void handleClose()}
      />
      <div className="relative w-full max-w-sm mx-4 max-h-[min(90vh,720px)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <Card className="border-none shadow-2xl rounded-[24px] overflow-hidden bg-card flex flex-col max-h-[inherit]">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                참가자 정보 수정
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => void handleClose()}
                disabled={busy}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto flex-1 min-h-0 pb-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">이름</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="참가자 이름"
                className="rounded-xl"
                disabled={busy}
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
                    disabled={busy}
                  >
                    남
                  </Button>
                  <Button
                    type="button"
                    variant={gender === '여' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl text-xs font-bold"
                    onClick={() => setGender('여')}
                    disabled={busy}
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
                    disabled={busy}
                  >
                    한국인
                  </Button>
                  <Button
                    type="button"
                    variant={nationality === '외국인' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl text-xs font-bold"
                    onClick={() => setNationality('외국인')}
                    disabled={busy}
                  >
                    외국인
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">언어</label>
              <div className="flex gap-2 flex-wrap">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <Button
                    key={lang}
                    type="button"
                    variant={language === lang ? 'default' : 'outline'}
                    className="flex-1 rounded-xl text-xs font-bold min-w-[60px]"
                    onClick={() => setLanguage(lang)}
                    disabled={busy}
                  >
                    {lang}
                  </Button>
                ))}
              </div>
            </div>

            <PaymentMethodFields
              paymentMethod={paymentMethod}
              onPaymentMethodChange={handlePaymentMethodChange}
              paymentStatus={paymentStatus}
              disabled={busy}
              receiptUrl={receiptUrl}
              pendingReceiptPreview={pendingReceiptPreview}
              onReceiptFileSelect={onReceiptUpload ? handleReceiptFileSelect : undefined}
              pendingReceiptHint={
                pendingReceiptFile ? '선택됨 — 닫을 때 업로드됩니다' : undefined
              }
            />

            {checkedIn ? (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl font-bold gap-2"
                disabled={busy}
                onClick={() => void handleUncheckin()}
              >
                {checkinBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                체크인 해제
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full rounded-xl font-black gap-2"
                disabled={busy}
                onClick={() => void handleCheckin()}
              >
                {checkinBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                체크인
              </Button>
            )}

            {participant.userId ? (
              <StampProgressEditor
                ref={stampEditorRef}
                userId={participant.userId}
                resetKey={participant.id}
                disabled={busy}
                autoSave={false}
                onDirtyChange={setStampDirty}
              />
            ) : (
              <p className="text-xs font-medium text-muted-foreground text-center py-1">
                비회원(현장 추가) — 스탬프 없음
              </p>
            )}

            {onDelete ? (
              <Button
                type="button"
                variant="destructive"
                className="w-full rounded-xl font-bold gap-2"
                disabled={busy}
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

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                {flushing
                  ? '저장 중…'
                  : dirty
                    ? '변경 사항 있음 — 닫을 때 저장'
                    : '변경 없음'}
              </p>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl font-bold"
                onClick={() => void handleClose()}
                disabled={busy}
              >
                닫기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
