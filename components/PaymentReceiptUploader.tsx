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
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg']

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
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(
        isEn ? 'Only JPG or PNG images are allowed.' : 'JPG 또는 PNG 형식의 이미지만 업로드 가능합니다.'
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
      // 로컬 미리보기 생성
      const localPreview = URL.createObjectURL(file)
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
        accept=".jpg,.jpeg,.png"
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
                {isEn ? 'JPG, PNG (max 5MB)' : 'JPG, PNG (최대 5MB)'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-border bg-muted/30">
          <div className="relative aspect-video">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={preview} 
              alt="Payment receipt" 
              className="w-full h-full object-contain"
            />
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
