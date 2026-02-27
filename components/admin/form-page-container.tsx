'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Loader2, Save } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'
import { FormBuilder, FormData as FormBuilderData } from '@/components/admin/form-builder'
import { ResponseResetSettings } from '@/components/admin/response-reset-settings'
import { useFormManager } from '@/hooks/use-form-manager'

interface FormPageContainerProps {
  formId: string | null
  pageTitle: string
  pageTitleEn: string
}

export function FormPageContainer({ formId, pageTitle, pageTitleEn }: FormPageContainerProps) {
  const router = useRouter()
  const locale = useLocale()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<FormBuilderData | null>(null)
  const { formDetails, saveForm, loadingForm } = useFormManager(formId)

  useEffect(() => {
    if (formDetails) {
      setFormData(formDetails)
    }
  }, [formDetails])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData?.title) {
      alert(locale === 'en' ? 'Please enter a form title.' : '폼 제목을 입력해주세요.')
      return
    }

    setSaving(true)
    const newFormId = await saveForm(formData)

    if (newFormId) {
      router.push('/admin/forms')
      router.refresh()
    } else {
      alert('Failed to save form.')
      setSaving(false)
    }
  }

  if (loadingForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted p-4 md:p-10 pb-32">
      <div className="max-w-3xl mx-auto space-y-8">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          {locale === 'en' ? 'Back' : '뒤로가기'}
        </button>

        <h1 className="text-3xl font-black text-foreground">
          {locale === 'en' ? pageTitleEn : pageTitle}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormBuilder initialData={formDetails || undefined} onChange={setFormData} />

          {formId && <ResponseResetSettings formId={formId} />}

          <div className="fixed bottom-10 left-0 right-0 z-50 px-6">
            <div className="max-w-3xl mx-auto">
              <Button
                type="submit"
                disabled={saving}
                className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-xl font-black shadow-2xl shadow-primary/40 transition-all active:scale-[0.98]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin mr-3" />
                    {locale === 'en' ? 'Saving...' : '저장 중...'}
                  </>
                ) : (
                  <>
                    <Save className="w-6 h-6 mr-3" />
                    {locale === 'en' ? (formId ? 'Save Changes' : 'Save Form') : (formId ? '변경사항 저장' : '폼 저장하기')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
