'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Clock, Calendar, Loader2, Save, Trash2 } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'
import { cn } from '@/lib/utils'

interface ResponseResetSettingsProps {
  formId: string
}

const DAYS = [
  { value: 'monday', label: '월요일', labelEn: 'Monday' },
  { value: 'tuesday', label: '화요일', labelEn: 'Tuesday' },
  { value: 'wednesday', label: '수요일', labelEn: 'Wednesday' },
  { value: 'thursday', label: '목요일', labelEn: 'Thursday' },
  { value: 'friday', label: '금요일', labelEn: 'Friday' },
  { value: 'saturday', label: '토요일', labelEn: 'Saturday' },
  { value: 'sunday', label: '일요일', labelEn: 'Sunday' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString().padStart(2, '0'),
  label: `${i.toString().padStart(2, '0')}:00`
}))

export function ResponseResetSettings({ formId }: ResponseResetSettingsProps) {
  const locale = useLocale()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [resetDay, setResetDay] = useState<string>('sunday')
  const [resetHour, setResetHour] = useState<string>('00')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [formId])

  async function fetchSettings() {
    setLoading(true)
    const { data } = await supabase
      .from('response_reset_settings')
      .select('*')
      .eq('form_id', formId)
      .single()
    
    if (data) {
      setSettings(data)
      setResetDay(data.reset_day)
      const time = data.reset_time.split(':')
      setResetHour(time[0])
      setIsActive(data.is_active)
    }
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    const resetTime = `${resetHour}:00:00`
    
    const settingsData = {
      form_id: formId,
      reset_day: resetDay,
      reset_time: resetTime,
      is_active: isActive,
      updated_at: new Date().toISOString()
    }

    if (settings) {
      // Update existing
      const { error } = await supabase
        .from('response_reset_settings')
        .update(settingsData)
        .eq('id', settings.id)
      
      if (error) {
        alert(locale === 'en' ? 'Failed to save settings.' : '설정 저장에 실패했습니다.')
      } else {
        alert(locale === 'en' ? 'Settings saved successfully!' : '설정이 저장되었습니다!')
        fetchSettings()
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('response_reset_settings')
        .insert(settingsData)
      
      if (error) {
        alert(locale === 'en' ? 'Failed to save settings.' : '설정 저장에 실패했습니다.')
      } else {
        alert(locale === 'en' ? 'Settings saved successfully!' : '설정이 저장되었습니다!')
        fetchSettings()
      }
    }
    setSaving(false)
  }

  async function deleteSettings() {
    if (!settings) return
    if (!confirm(locale === 'en' ? 'Delete reset schedule?' : '초기화 스케줄을 삭제하시겠습니까?')) return
    
    const { error } = await supabase
      .from('response_reset_settings')
      .delete()
      .eq('id', settings.id)
    
    if (error) {
      alert(locale === 'en' ? 'Failed to delete.' : '삭제에 실패했습니다.')
    } else {
      setSettings(null)
      setResetDay('sunday')
      setResetHour('00')
      setIsActive(true)
    }
  }

  async function resetNow() {
    if (!confirm(locale === 'en' ? 'Delete all responses now?' : '지금 모든 응답을 삭제하시겠습니까?')) return

    const { data: rows, error: idsErr } = await supabase
      .from('form_responses')
      .select('id')
      .eq('form_id', formId)

    if (idsErr) {
      alert(locale === 'en' ? 'Failed to load responses.' : '응답 목록을 불러오지 못했습니다.')
      return
    }

    const ids = (rows ?? []).map((r) => r.id).filter(Boolean)
    if (ids.length > 0) {
      const { error: seatingDelErr } = await supabase
        .from('seating_assignments')
        .delete()
        .in('participant_id', ids)

      if (seatingDelErr) {
        alert(locale === 'en' ? 'Failed to clear seating for responses.' : '자리 배치 데이터 초기화에 실패했습니다.')
        return
      }
    }

    const { error } = await supabase
      .from('form_responses')
      .delete()
      .eq('form_id', formId)
    
    if (error) {
      alert(locale === 'en' ? 'Failed to delete responses.' : '응답 삭제에 실패했습니다.')
    } else {
      alert(locale === 'en' ? 'All responses deleted!' : '모든 응답이 삭제되었습니다!')
      
      // Update last_reset_at
      if (settings) {
        await supabase
          .from('response_reset_settings')
          .update({ last_reset_at: new Date().toISOString() })
          .eq('id', settings.id)
        fetchSettings()
      }
    }
  }

  if (loading) {
    return (
      <Card className="rounded-[32px]">
        <CardContent className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-[32px] border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-black flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          {locale === 'en' ? 'Automatic Response Reset' : '응답 자동 초기화'}
        </CardTitle>
        <CardDescription className="font-medium">
          {locale === 'en'
            ? 'A database job runs every minute and clears responses at your scheduled Seoul time (see last reset below).'
            : 'DB 스케줄러가 매분 확인해, 서울 기준으로 정한 요일·시간에 해당 폼 응답을 자동 삭제합니다(아래 마지막 초기화 시각 참고).'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-black text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {locale === 'en' ? 'Reset Day' : '초기화 요일'}
            </Label>
            <Select value={resetDay} onValueChange={setResetDay}>
              <SelectTrigger className="h-12 rounded-xl border-border font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {DAYS.map((day) => (
                  <SelectItem key={day.value} value={day.value} className="font-bold">
                    {locale === 'en' ? day.labelEn : day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-black text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {locale === 'en' ? 'Reset Time' : '초기화 시간'}
            </Label>
            <Select value={resetHour} onValueChange={setResetHour}>
              <SelectTrigger className="h-12 rounded-xl border-border font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px]">
                {HOURS.map((hour) => (
                  <SelectItem key={hour.value} value={hour.value} className="font-bold">
                    {hour.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted">
          <input
            type="checkbox"
            id="reset-active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
          />
          <Label htmlFor="reset-active" className="font-bold text-foreground cursor-pointer">
            {locale === 'en' ? 'Enable automatic reset' : '자동 초기화 활성화'}
          </Label>
        </div>

        {settings?.last_reset_at && (
          <div className="text-sm text-muted-foreground font-medium p-3 rounded-xl bg-muted/50">
            {locale === 'en' ? 'Last reset: ' : '마지막 초기화: '}
            <span className="font-black text-foreground">
              {new Date(settings.last_reset_at).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR')}
            </span>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3">
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 font-black"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {locale === 'en' ? 'Saving...' : '저장 중...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {locale === 'en' ? 'Save Schedule' : '스케줄 저장'}
              </>
            )}
          </Button>
          
          <Button
            onClick={resetNow}
            variant="outline"
            className="flex-1 h-12 rounded-xl border-destructive text-destructive hover:bg-destructive/10 font-black"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {locale === 'en' ? 'Reset Now' : '지금 초기화'}
          </Button>

          {settings && (
            <Button
              onClick={deleteSettings}
              variant="ghost"
              className="h-12 rounded-xl text-muted-foreground hover:text-destructive font-bold"
            >
              {locale === 'en' ? 'Delete Schedule' : '스케줄 삭제'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
