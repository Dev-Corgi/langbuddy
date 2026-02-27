'use client'

import { Button } from '@/components/ui/button'
import { Loader2, Save } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'

interface SaveButtonProps {
  onClick: () => void
  isSaving: boolean
  isNew?: boolean
}

export function SaveButton({ onClick, isSaving, isNew = false }: SaveButtonProps) {
  const locale = useLocale()

  return (
    <div className="fixed bottom-10 left-0 right-0 z-50 px-6">
      <div className="max-w-3xl mx-auto">
        <Button
          type="button"
          onClick={onClick}
          disabled={isSaving}
          className="w-full h-16 rounded-2xl bg-primary hover:bg-secondary text-xl font-black shadow-2xl shadow-primary/40 transition-all active:scale-[0.98]"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin mr-3" />
              {locale === 'en' ? 'Saving...' : '저장 중...'}
            </>
          ) : (
            <>
              <Save className="w-6 h-6 mr-3" />
              {isNew 
                ? (locale === 'en' ? 'Save Form' : '폼 저장하기') 
                : (locale === 'en' ? 'Save Changes' : '변경사항 저장')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
