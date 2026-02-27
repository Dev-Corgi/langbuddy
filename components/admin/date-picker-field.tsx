'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerFieldProps {
  label: string
  labelEn?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  isUndecided?: boolean
  onUndecidedChange?: (checked: boolean) => void
  type?: 'date' | 'datetime-local'
  className?: string
  required?: boolean
}

export function DatePickerField({
  label,
  labelEn,
  value,
  onChange,
  disabled = false,
  isUndecided = false,
  onUndecidedChange,
  type = 'date',
  className,
  required = false
}: DatePickerFieldProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label className="font-black text-foreground/70 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          {label}
          {labelEn && <span className="text-primary/60 font-medium ml-1">({labelEn})</span>}
        </Label>
        {onUndecidedChange && (
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={isUndecided}
              onChange={(e) => onUndecidedChange(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">미정</span>
          </label>
        )}
      </div>
      <Input
        type={type}
        required={required && !isUndecided}
        disabled={disabled || isUndecided}
        value={isUndecided ? "" : (value === '매주' || value === '미정' ? '' : value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={value === '매주' ? '매주 반복' : (value === '미정' ? '미정' : '')}
        className={cn(
          "h-14 rounded-2xl border-border bg-muted/50 focus:ring-primary text-sm font-medium transition-all",
          isUndecided && "bg-muted opacity-50 cursor-not-allowed"
        )}
      />
    </div>
  )
}
