'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface PaymentReceiptUploaderProps {
  onUploadComplete?: (url: string) => void
  onFileSelect: (file: File) => void
  onRemove?: () => void
  existingUrl?: string
  disabled?: boolean
  /** 'ko' | 'en' — 기본 ko */
  locale?: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
// 아이폰 카메라로 찍은 사진은 image/heic, 일부 안드로이드 편집 앱은 image/webp로 저장되는 경우가 많아
// 스크린샷(png/jpeg)만 허용하면 "업로드가 안 된다"는 문의가 다수 발생함. 확장자 기반 accept도 일부
// 모바일 브라우저에서 갤러리 필터링 오류를 일으켜 image/*로 완화.
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
  existingUrl,
  disabled = false,
  locale = 'ko',
}: PaymentReceiptUploaderProps) {
  const isEn = locale === 'en'
  const [preview, setPreview] = useState<string | null>(existingUrl || null)
  const [previewBroken, setPreviewBroken] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    // 일부 브라우저/OS(특히 iOS의 HEIC)는 file.type을 빈 문자열로 보고하는 경우가 있어
    // 확장자로도 한 번 더 확인한다.
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

    setIsUploading(true)
    
    try {
      // 로컬 미리보기 생성 (HEIC 등 일부 포맷은 브라우저에 따라 렌더링되지 않을 수 있음)
      const localPreview = URL.createObjectURL(file)
      setPreviewBroken(false)
      setPreview(localPreview)
      
      // 파일 객체를 부모 컴포넌트에 전달
      onFileSelect(file)
      onUploadComplete?.(localPreview)
    } catch (error) {
      toast.error(isEn ? 'Something went wrong while processing the file.' : '파일 업로드 중 오류가 발생했습니다.')
      setPreview(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (disabled || isUploading) return
    
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [disabled, isUploading])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isUploading) setDragActive(true)
  }, [disabled, isUploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleRemove = () => {
    setPreview(null)
    setPreviewBroken(false)
    if (inputRef.current) inputRef.current.value = ''
    onRemove?.()
  }

  const handleClick = () => {
    if (!disabled && !isUploading) {
      inputRef.current?.click()
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {!preview ? (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer",
            dragActive 
              ? "border-primary bg-primary/5" 
              : "border-border bg-muted/30 hover:border-primary/30 hover:bg-muted/50",
            (disabled || isUploading) && "opacity-50 cursor-not-allowed"
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
            <div className="space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {isEn ? 'Tap to upload a photo' : '클릭하여 사진 업로드'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isEn ? 'Or drag and drop' : '또는 드래그하여 놓기'}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isEn ? 'JPG, PNG, HEIC, WEBP (max 5MB)' : 'JPG, PNG, HEIC, WEBP (최대 5MB)'}
              </p>
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
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full"
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
