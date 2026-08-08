'use client'

import { useState, useCallback, useRef, useId, useMemo, useEffect } from 'react'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { detectInAppBrowser } from '@/lib/in-app-browser'

interface PaymentReceiptUploaderProps {
  onUploadComplete?: (url: string) => void
  onFileSelect: (file: File) => void
  onRemove?: () => void
  /** 부모가 보관하는 blob/url — remount·백그라운드 복귀 후에도 미리보기 유지 */
  previewUrl?: string | null
  existingUrl?: string
  disabled?: boolean
  /** 갤러리/카메라 피커 열림 — 부모가 데이터 refetch 억제 */
  onPickerActivity?: (active: boolean) => void
  locale?: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/heic',
  'image/heif',
  'image/webp',
]
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp']

export function PaymentReceiptUploader({
  onUploadComplete,
  onFileSelect,
  onRemove,
  previewUrl,
  existingUrl,
  disabled = false,
  onPickerActivity,
  locale = 'ko',
}: PaymentReceiptUploaderProps) {
  const isEn = locale === 'en'
  const inputId = useId()
  const inApp = useMemo(() => detectInAppBrowser(), [])
  const externalPreview = previewUrl ?? existingUrl ?? null
  const [preview, setPreview] = useState<string | null>(externalPreview)
  const [previewBroken, setPreviewBroken] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputDisabled = disabled || isUploading
  const pickerActiveRef = useRef(false)

  useEffect(() => {
    setPreview(externalPreview)
    if (externalPreview) setPreviewBroken(false)
  }, [externalPreview])

  useEffect(() => {
    const endPicker = () => {
      if (!pickerActiveRef.current) return
      pickerActiveRef.current = false
      onPickerActivity?.(false)
    }
    window.addEventListener('focus', endPicker)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') endPicker()
    })
    return () => {
      window.removeEventListener('focus', endPicker)
    }
  }, [onPickerActivity])

  const validateFile = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const typeOk = file.type ? ALLOWED_TYPES.includes(file.type) : ALLOWED_EXTENSIONS.includes(ext)
    const extOk = ALLOWED_EXTENSIONS.includes(ext)

    if (!typeOk && !extOk) {
      toast.error(
        isEn
          ? 'Only JPG, PNG, HEIC, or WEBP images are allowed.'
          : 'JPG, PNG, HEIC, WEBP 형식의 이미지만 업로드 가능합니다.'
      )
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(isEn ? 'File size must be 5MB or less.' : '파일 크기는 5MB 이하여야 합니다.')
      return false
    }
    return true
  }

  const handleFile = async (file: File) => {
    if (!validateFile(file)) return

    pickerActiveRef.current = false
    onPickerActivity?.(false)
    setIsUploading(true)

    try {
      onFileSelect(file)
    } catch {
      toast.error(isEn ? 'Something went wrong while processing the file.' : '파일 업로드 중 오류가 발생했습니다.')
      onRemove?.()
    } finally {
      setIsUploading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  const openFilePicker = useCallback(() => {
    if (inputDisabled) return
    pickerActiveRef.current = true
    onPickerActivity?.(true)
    inputRef.current?.click()
  }, [inputDisabled, onPickerActivity])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (inputDisabled) return
      const file = e.dataTransfer.files?.[0]
      if (file) void handleFile(file)
    },
    [inputDisabled]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!inputDisabled) setDragActive(true)
    },
    [inputDisabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPreviewBroken(false)
    if (inputRef.current) inputRef.current.value = ''
    onRemove?.()
  }

  return (
    <div className="space-y-3">
      {inApp.isKakaoTalk ? (
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 leading-relaxed">
          {isEn
            ? 'If the photo picker does not open, tap ⋮ (top right) → Open in browser (Chrome/Samsung Internet), then try again.'
            : '사진 선택 창이 안 뜨면 우측 상단 ⋮ → 「다른 브라우저로 열기」(Chrome·삼성 인터넷) 후 다시 시도해 주세요.'}
        </p>
      ) : null}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={inputDisabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />

      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'relative border-2 border-dashed rounded-2xl p-8 text-center transition-all',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/30',
            inputDisabled && 'opacity-50'
          )}
        >
          {isUploading ? (
            <div className="space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">
                {isEn ? 'Processing...' : '업로드 중...'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {isEn ? 'Upload payment receipt' : '입금 영수증 사진 첨부'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isEn ? 'JPG, PNG, HEIC, WEBP (max 5MB)' : 'JPG, PNG, HEIC, WEBP (최대 5MB)'}
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                className="w-full rounded-xl font-bold h-12"
                disabled={inputDisabled}
                onClick={openFilePicker}
              >
                {isEn ? 'Choose photo' : '사진 선택하기'}
              </Button>
              {!inApp.isInApp ? (
                <p className="text-[10px] text-muted-foreground">
                  {isEn ? 'Or drag and drop a file here' : '또는 파일을 여기에 드래그'}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-border bg-muted/30">
          <div className="relative aspect-video">
            {previewBroken ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon className="w-10 h-10" />
                <p className="text-xs font-medium">
                  {isEn ? 'File selected (preview unavailable)' : '파일이 선택되었습니다 (미리보기 불가)'}
                </p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Payment receipt"
                className="w-full h-full object-contain"
                onError={() => setPreviewBroken(true)}
              />
            )}
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 z-20 h-8 w-8 rounded-full"
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
            <div className="flex items-center gap-2 text-white">
              <ImageIcon className="w-4 h-4" />
              <span className="text-xs font-medium">
                {isEn ? 'Payment receipt' : '입금 영수증'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
