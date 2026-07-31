'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { FormBuilder, FormData as FormBuilderData } from '@/components/admin/form-builder'
import { buildAutoRecurringFormTitles } from '@/lib/session-event-date'

interface ApplyMethodCardProps {
  locale: string
  currentFormDetails?: FormBuilderData
  onFormDataChange: (data: FormBuilderData) => void
  loadingForm?: boolean
  infoMessage?: string
  infoMessageEn?: string
  mode?: 'default' | 'language'
  recurringDayKo?: string
  lockedSystemKeys?: string[]
}

/** DB 로드는 부모 페이지에서 1회만. 여기서는 편집 UI만 렌더. */
export function ApplyMethodCard({
  locale,
  currentFormDetails,
  onFormDataChange,
  loadingForm = false,
  mode = 'default',
  recurringDayKo,
  lockedSystemKeys,
}: ApplyMethodCardProps) {
  const autoTitlesForBuilder =
    mode === 'language' && recurringDayKo
      ? buildAutoRecurringFormTitles(recurringDayKo, 'language')
      : undefined
  const titleMode: 'editable' | 'auto' =
    mode === 'language' && recurringDayKo ? 'auto' : 'editable'

  return (
    <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
      <CardHeader className="p-8 pb-0">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          {locale === 'en' ? 'Application Form Settings' : '신청 폼 설정'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="border-2 border-dashed border-primary/20 rounded-[40px] p-2 bg-primary/5 transition-all">
          <div className="p-4 md:p-8">
            {loadingForm || !currentFormDetails ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <FormBuilder
                value={currentFormDetails}
                onChange={onFormDataChange}
                lockedSystemKeys={lockedSystemKeys}
                titleMode={titleMode}
                autoTitles={autoTitlesForBuilder}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
