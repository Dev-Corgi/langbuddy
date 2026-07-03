'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Settings, X, Trash2, Loader2, LogIn, LogOut, ImageIcon, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { StampProgressEditor, type StampProgressEditorHandle } from '@/components/admin/stamp-progress-editor'
import { SUPPORTED_LANGUAGES } from '@/lib/supported-languages'
import {
  PAYMENT_METHODS,
  formatPaymentMethodLabel,
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
  const [savingFields, setSavingFields] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [checkinBusy, setCheckinBusy] = useState(false)
  const stampEditorRef = useRef<StampProgressEditorHandle>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  const savedFieldsRef = useRef<SavedFields>({
    name: participant.name,
    gender: participant.gender,
    nationality: participant.nationality,
    language: participant.language,
    paymentMethod: participant.paymentMethod ?? null,
  })

  useEffect(() => {
    setName(participant.name)
    setGender(participant.gender as '남' | '여')
    setNationality(participant.nationality as '한국인' | '외국인')
    setLanguage(participant.language)
    setPaymentMethod(participant.paymentMethod ?? null)
    setReceiptUrl(participant.paymentReceiptUrl ?? null)
    setPaymentStatus(participant.paymentStatus ?? null)
    savedFieldsRef.current = {
      name: participant.name,
      gender: participant.gender,
      nationality: participant.nationality,
      language: participant.language,
      paymentMethod: participant.paymentMethod ?? null,
    }
  }, [participant])

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

  const persistIfChanged = useCallback(
    async (patch: Participant): Promise<boolean> => {
      const prev = savedFieldsRef.current
      if (
        patch.name === prev.name &&
        patch.gender === prev.gender &&
        patch.nationality === prev.nationality &&
        patch.language === prev.language &&
        (patch.paymentMethod ?? null) === prev.paymentMethod
      ) {
        return true
      }
      if (!patch.name.trim()) {
        toast.error('이름을 입력해주세요.')
        return false
      }

      setSavingFields(true)
      try {
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
      } finally {
        setSavingFields(false)
      }
    },
    [onFieldSave]
  )

  useEffect(() => {
    const trimmed = name.trim()
    if (trimmed === savedFieldsRef.current.name) return

    const timer = setTimeout(() => {
      void persistIfChanged(buildPatch())
    }, 400)

    return () => clearTimeout(timer)
  }, [name, buildPatch, persistIfChanged])

  const handleGenderChange = useCallback(
    (value: '남' | '여') => {
      setGender(value)
      void persistIfChanged({ ...buildPatch(), gender: value })
    },
    [buildPatch, persistIfChanged]
  )

  const handleNationalityChange = useCallback(
    (value: '한국인' | '외국인') => {
      setNationality(value)
      void persistIfChanged({ ...buildPatch(), nationality: value })
    },
    [buildPatch, persistIfChanged]
  )

  const handleLanguageChange = useCallback(
    (value: string) => {
      setLanguage(value)
      void persistIfChanged({ ...buildPatch(), language: value })
    },
    [buildPatch, persistIfChanged]
  )

  const handlePaymentMethodChange = useCallback(
    (value: PaymentMethod) => {
      setPaymentMethod(value)
      if (!isBankTransferMethod(value)) {
        setReceiptUrl(null)
        setPaymentStatus(null)
      } else if (!receiptUrl) {
        setPaymentStatus(null)
      }
      void persistIfChanged({ ...buildPatch(), paymentMethod: value })
    },
    [buildPatch, persistIfChanged, receiptUrl]
  )

  const handleReceiptFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !onReceiptUpload) return
      if (checkinBusy || savingFields || isDeleting || uploadingReceipt) return

      setUploadingReceipt(true)
      try {
        const updated = await onReceiptUpload(participant.id, file)
        if (updated) {
          setPaymentMethod(updated.paymentMethod ?? '계좌이체')
          setReceiptUrl(updated.paymentReceiptUrl ?? null)
          setPaymentStatus(updated.paymentStatus ?? 'pending')
          savedFieldsRef.current.paymentMethod = updated.paymentMethod ?? '계좌이체'
        }
      } finally {
        setUploadingReceipt(false)
      }
    },
    [
      checkinBusy,
      isDeleting,
      onReceiptUpload,
      participant.id,
      savingFields,
      uploadingReceipt,
    ]
  )

  const flushPendingChanges = useCallback(async (): Promise<boolean> => {
    const fieldsOk = await persistIfChanged(buildPatch())
    if (!fieldsOk) return false
    return (await stampEditorRef.current?.flushPendingSave()) ?? true
  }, [buildPatch, persistIfChanged])

  const handleClose = useCallback(async () => {
    if (checkinBusy || savingFields || isDeleting || uploadingReceipt) return
    const ok = await flushPendingChanges()
    if (ok) onClose()
  }, [checkinBusy, flushPendingChanges, isDeleting, onClose, savingFields, uploadingReceipt])

  const handleCheckin = useCallback(async () => {
    if (checkinBusy || savingFields || isDeleting || uploadingReceipt) return
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
  }, [
    buildPatch,
    checkinBusy,
    flushPendingChanges,
    isDeleting,
    onCheckin,
    participant.checked_in_at,
    savingFields,
    uploadingReceipt,
  ])

  const handleUncheckin = useCallback(async () => {
    if (checkinBusy || savingFields || isDeleting || uploadingReceipt) return
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
  }, [
    buildPatch,
    checkinBusy,
    flushPendingChanges,
    isDeleting,
    onUncheckin,
    participant.checked_in_at,
    savingFields,
    uploadingReceipt,
  ])

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

  const busy = savingFields || checkinBusy || isDeleting || uploadingReceipt
  const checkedIn = Boolean(participant.checked_in_at)
  const showBankTransfer = isBankTransferMethod(paymentMethod)

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
                    onClick={() => handleGenderChange('남')}
                    disabled={busy}
                  >
                    남
                  </Button>
                  <Button
                    type="button"
                    variant={gender === '여' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl text-xs font-bold"
                    onClick={() => handleGenderChange('여')}
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
                    onClick={() => handleNationalityChange('한국인')}
                    disabled={busy}
                  >
                    한국인
                  </Button>
                  <Button
                    type="button"
                    variant={nationality === '외국인' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl text-xs font-bold"
                    onClick={() => handleNationalityChange('외국인')}
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
                    onClick={() => handleLanguageChange(lang)}
                    disabled={busy}
                  >
                    {lang}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">결제 수단</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <Button
                    key={method}
                    type="button"
                    variant={paymentMethod === method ? 'default' : 'outline'}
                    className="rounded-xl text-xs font-bold h-10"
                    onClick={() => handlePaymentMethodChange(method)}
                    disabled={busy}
                  >
                    {method}
                  </Button>
                ))}
              </div>
              {paymentMethod ? (
                <p className="text-[11px] font-medium text-muted-foreground">
                  {formatPaymentMethodLabel(paymentMethod, paymentStatus)}
                </p>
              ) : null}
            </div>

            {showBankTransfer ? (
              <div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-border/60">
                <p className="text-xs font-bold text-muted-foreground">입금 영수증</p>
                {receiptUrl ? (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative aspect-video rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receiptUrl}
                      alt="입금 영수증"
                      className="w-full h-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex items-center justify-center aspect-video rounded-lg border border-dashed border-border bg-muted/20">
                    <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                )}
                {onReceiptUpload ? (
                  <>
                    <input
                      ref={receiptInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleReceiptFileChange(e)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl text-xs font-bold gap-2"
                      disabled={busy}
                      onClick={() => receiptInputRef.current?.click()}
                    >
                      {uploadingReceipt ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {receiptUrl ? '영수증 변경' : '영수증 업로드'}
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}

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
                {savingFields || uploadingReceipt ? '저장 중…' : '변경 사항은 자동 저장됩니다.'}
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
