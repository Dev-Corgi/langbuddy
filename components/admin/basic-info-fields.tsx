'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TypeOutline, Clock, MapPin, Users, Calendar } from 'lucide-react'
import { ImageUploadField } from './image-upload-field'
import { DatePickerField } from './date-picker-field'
import { cn } from '@/lib/utils'

interface BasicInfoFieldsProps {
  title: string
  titleEn: string
  subtitle?: string
  subtitleEn?: string
  date: string
  startTime: string
  endTime: string
  location: string
  maxParticipants?: string
  imageUrl?: string
  isDateUndecided: boolean
  isTimeUndecided: boolean
  isLocationUndecided: boolean
  hideDateField?: boolean
  onTitleChange: (value: string) => void
  onTitleEnChange: (value: string) => void
  onSubtitleChange?: (value: string) => void
  onSubtitleEnChange?: (value: string) => void
  onDateChange: (value: string) => void
  onStartTimeChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  onLocationChange: (value: string) => void
  onMaxParticipantsChange?: (value: string) => void
  onImageUrlChange?: (value: string) => void
  onDateUndecidedChange: (checked: boolean) => void
  onTimeUndecidedChange: (checked: boolean) => void
  onLocationUndecidedChange: (checked: boolean) => void
}

export function BasicInfoFields({
  title,
  titleEn,
  subtitle,
  subtitleEn,
  date,
  startTime,
  endTime,
  location,
  maxParticipants,
  imageUrl,
  isDateUndecided,
  isTimeUndecided,
  isLocationUndecided,
  onTitleChange,
  onTitleEnChange,
  onSubtitleChange,
  onSubtitleEnChange,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onLocationChange,
  onMaxParticipantsChange,
  onImageUrlChange,
  onDateUndecidedChange,
  onTimeUndecidedChange,
  onLocationUndecidedChange,
  hideDateField
}: BasicInfoFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <Label className="font-black text-foreground/70 flex items-center gap-2">
            <TypeOutline className="w-4 h-4 text-primary" />
            제목 (KO)
          </Label>
          <Input 
            value={title} 
            onChange={(e) => onTitleChange(e.target.value)}
            className="h-14 rounded-2xl border-border bg-muted/50 focus:ring-primary text-sm font-medium"
          />
        </div>
        <div className="space-y-3">
          <Label className="font-black text-primary flex items-center gap-2">
            <TypeOutline className="w-4 h-4 text-primary" />
            Title (EN)
          </Label>
          <Input 
            value={titleEn} 
            onChange={(e) => onTitleEnChange(e.target.value)}
            className="h-14 rounded-2xl border-primary/10 bg-primary/5 focus:ring-primary text-sm font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <Label className="font-black text-foreground/70 flex items-center gap-2">
            <TypeOutline className="w-4 h-4 text-primary" />
            한줄 소개 (KO)
          </Label>
          <Input 
            placeholder="목록에 노출될 짧은 소개글"
            value={subtitle || ''} 
            onChange={(e) => onSubtitleChange?.(e.target.value)}
            className="h-14 rounded-2xl border-border bg-muted/50 focus:ring-primary text-sm font-medium"
          />
        </div>
        <div className="space-y-3">
          <Label className="font-black text-primary flex items-center gap-2">
            <TypeOutline className="w-4 h-4 text-primary" />
            One-line Intro (EN)
          </Label>
          <Input 
            placeholder="Short intro for list view"
            value={subtitleEn || ''} 
            onChange={(e) => onSubtitleEnChange?.(e.target.value)}
            className="h-14 rounded-2xl border-primary/10 bg-primary/5 focus:ring-primary text-sm font-medium"
          />
        </div>
      </div>

      {onMaxParticipantsChange && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="font-black text-foreground/70 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              모집 인원수
            </Label>
            <Input 
              type="text"
              value={maxParticipants || ''} 
              onChange={(e) => onMaxParticipantsChange(e.target.value)}
              placeholder="예: 10명"
              className="h-14 rounded-2xl border-border bg-muted/50 focus:ring-primary text-sm font-medium"
            />
          </div>
        </div>
      )}

      {onImageUrlChange && (
        <ImageUploadField
          label="대표 이미지"
          labelEn="Featured Image"
          currentImageUrl={imageUrl || ''}
          onImageUrlChange={onImageUrlChange}
        />
      )}

      <div className={cn(
        "grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/50",
        hideDateField && "md:grid-cols-1"
      )}>
        {!hideDateField && (
          <DatePickerField
            label="진행 날짜"
            value={date}
            onChange={onDateChange}
            isUndecided={isDateUndecided}
            onUndecidedChange={onDateUndecidedChange}
          />
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-black text-foreground/70 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              진행 시간
            </Label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={isTimeUndecided}
                onChange={(e) => onTimeUndecidedChange(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">미정</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time" className="text-[11px] font-bold text-muted-foreground">시작 시간</Label>
              <Input
                id="start_time"
                type="time"
                disabled={isTimeUndecided}
                value={isTimeUndecided ? "" : startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className={cn(
                  "h-12 rounded-xl border-border bg-muted/50",
                  isTimeUndecided && "bg-muted opacity-50 cursor-not-allowed"
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time" className="text-[11px] font-bold text-muted-foreground">종료 시간 (선택)</Label>
              <Input
                id="end_time"
                type="time"
                disabled={isTimeUndecided}
                value={isTimeUndecided ? "" : endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className={cn(
                  "h-12 rounded-xl border-border bg-muted/50",
                  isTimeUndecided && "bg-muted opacity-50 cursor-not-allowed"
                )}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/50">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-black text-foreground/70 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              진행 장소 (KO)
            </Label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={isLocationUndecided}
                onChange={(e) => onLocationUndecidedChange(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">미정</span>
            </label>
          </div>
          <Input 
            value={isLocationUndecided ? "미정" : location} 
            disabled={isLocationUndecided}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="장소를 입력하세요"
            className={cn(
              "h-14 rounded-2xl border-border bg-muted/50 focus:ring-primary text-sm font-medium",
              isLocationUndecided && "bg-muted opacity-50 cursor-not-allowed"
            )}
          />
        </div>
      </div>
    </>
  )
}
