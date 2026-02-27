'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'

interface ImageUploadFieldProps {
  label?: string
  labelEn?: string
  currentImageUrl?: string
  onImageUrlChange: (url: string) => void
  bucketName?: string
  folder?: string
}

export function ImageUploadField({
  label = "대표 이미지",
  labelEn,
  currentImageUrl = '',
  onImageUrlChange,
  bucketName = 'images',
  folder = 'uploads'
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new window.Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          
          // 최대 크기 설정 (긴 쪽 기준 2000px)
          const maxSize = 2000
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          } else if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
          
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas context not available'))
            return
          }
          
          ctx.drawImage(img, 0, 0, width, height)
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Canvas to Blob conversion failed'))
                return
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            },
            'image/jpeg',
            0.85 // 압축 품질 (0.85 = 85%)
          )
        }
        img.onerror = () => reject(new Error('Image load failed'))
      }
      reader.onerror = () => reject(new Error('File read failed'))
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 이미지 파일 타입 체크
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.')
      return
    }

    setUploading(true)

    let fileToUpload = file

    // 10MB 초과 시 자동 압축
    if (file.size > 10 * 1024 * 1024) {
      try {
        fileToUpload = await compressImage(file)
        console.log(`이미지 압축 완료: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`)
      } catch (error) {
        console.error('Image compression error:', error)
        alert('이미지 압축 중 오류가 발생했습니다.')
        setUploading(false)
        return
      }
    }

    try {
      // 파일명 생성 (타임스탬프 + 랜덤 문자열)
      const fileExt = fileToUpload.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${folder}/${fileName}`

      // Supabase Storage에 업로드
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Upload error:', error)
        alert(`이미지 업로드에 실패했습니다: ${error.message}`)
        return
      }

      // Public URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath)

      setPreviewUrl(publicUrl)
      onImageUrlChange(publicUrl)
    } catch (error: any) {
      console.error('Upload error:', error)
      alert(`이미지 업로드 중 오류가 발생했습니다: ${error.message || error}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = () => {
    setPreviewUrl('')
    onImageUrlChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-primary" />
        {label}
        {labelEn && <span className="text-primary">/ {labelEn}</span>}
      </Label>

      <div className="space-y-4">
        {previewUrl && (
          <div className="relative w-full h-48 rounded-xl overflow-hidden border border-border bg-muted">
            <Image
              src={previewUrl}
              alt="Preview"
              fill
              className="object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-12 px-6 rounded-xl border-border font-bold flex items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                업로드 중...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {previewUrl ? '이미지 변경' : '이미지 업로드'}
              </>
            )}
          </Button>
          
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleRemoveImage}
              className="h-12 px-6 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 font-bold"
            >
              제거
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground font-medium">
          * 이미지 파일만 업로드 가능합니다. 10MB 초과 시 자동으로 압축됩니다.
        </p>
      </div>
    </div>
  )
}
