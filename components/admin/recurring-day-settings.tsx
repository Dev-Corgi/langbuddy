'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Globe, MapPin, Plus, Minus } from 'lucide-react'

interface RecurringDaySettingsProps {
  recurringDays: string[]
  recurringSettings: Record<string, { location: string; languages: string[] }>
  onSettingsChange: (settings: Record<string, { location: string; languages: string[] }>) => void
}

export function RecurringDaySettings({
  recurringDays,
  recurringSettings,
  onSettingsChange
}: RecurringDaySettingsProps) {
  if (!recurringDays || recurringDays.length === 0) {
    return null
  }

  const updateDayLocation = (day: string, location: string) => {
    const newSettings = { ...recurringSettings }
    newSettings[day] = { ...newSettings[day], location }
    onSettingsChange(newSettings)
  }

  const addLanguage = (day: string) => {
    const newSettings = { ...recurringSettings }
    const currentLangs = newSettings[day]?.languages || []
    newSettings[day] = { ...newSettings[day], languages: [...currentLangs, ""] }
    onSettingsChange(newSettings)
  }

  const updateLanguage = (day: string, langIdx: number, value: string) => {
    const newSettings = { ...recurringSettings }
    const newLangs = [...newSettings[day].languages]
    newLangs[langIdx] = value
    newSettings[day] = { ...newSettings[day], languages: newLangs }
    onSettingsChange(newSettings)
  }

  const removeLanguage = (day: string, langIdx: number) => {
    const newSettings = { ...recurringSettings }
    const newLangs = newSettings[day].languages.filter((_: any, i: number) => i !== langIdx)
    newSettings[day] = { ...newSettings[day], languages: newLangs }
    onSettingsChange(newSettings)
  }

  return (
    <div className="space-y-6 pt-8 border-t border-border">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-5 bg-primary rounded-full" />
        <Label className="text-lg font-black text-foreground">요일별 상세 설정 (언어/장소)</Label>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {recurringDays.map((day: string) => (
          <div key={day} className="p-6 rounded-[24px] bg-muted/50 border border-border space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black">
                {day}
              </div>
              <span className="font-bold text-foreground">{day}요일 상세 설정</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-3">
                <div className="flex items-center gap-2 h-8">
                  <MapPin className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-bold text-muted-foreground">이 요일의 장소</Label>
                </div>
                <Input 
                  value={recurringSettings?.[day]?.location || ''}
                  onChange={(e) => updateDayLocation(day, e.target.value)}
                  placeholder="요일별 장소가 다른 경우 입력 (공란이면 기본 장소 사용)"
                  className="h-11 rounded-xl bg-card border-border text-sm font-medium"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between h-8">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-bold text-muted-foreground">제공 언어 설정</Label>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => addLanguage(day)}
                    className="h-8 px-3 text-primary border-primary/20 hover:bg-primary/5 font-black gap-1.5 rounded-lg shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    언어 추가
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {(recurringSettings?.[day]?.languages || []).length === 0 ? (
                    <div className="text-center py-8 rounded-2xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground text-xs font-medium">
                      등록된 언어가 없습니다. '언어 추가' 버튼을 눌러 요일별 배울 언어를 설정하세요.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {recurringSettings[day].languages.map((lang: string, lIdx: number) => (
                        <div key={lIdx} className="flex gap-2 items-center bg-card p-1.5 pl-4 rounded-2xl border border-border shadow-sm group transition-all hover:border-primary/30 hover:shadow-md animate-in fade-in slide-in-from-left-2 duration-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                          <Input 
                            value={lang}
                            onChange={(e) => updateLanguage(day, lIdx, e.target.value)}
                            placeholder="예: 영어, 일본어 등"
                            className="h-10 border-none bg-transparent focus-visible:ring-0 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLanguage(day, lIdx)}
                            className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all active:scale-90"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
