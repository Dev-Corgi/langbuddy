'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { MainNav } from '@/app/_components/main-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PaymentReceiptUploader } from '@/components/PaymentReceiptUploader'
import { useLocale } from '@/hooks/use-locale'
import { DEBUG_BASE_PATH } from '@/lib/debug/debug-base-path'
import { getMockPostingById, MOCK_FORM_QUESTIONS } from '@/lib/debug/mock-data'

export default function DebugApplyPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const locale = useLocale()
  const isEn = locale === 'en'
  const posting = useMemo(() => getMockPostingById(id), [id])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showPayment, setShowPayment] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!posting) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="mx-auto max-w-lg px-4 py-20 text-center">
          <p className="font-bold text-muted-foreground">
            {isEn ? 'Posting not found' : '포스팅을 찾을 수 없습니다'}
          </p>
        </main>
      </div>
    )
  }

  const title = isEn && posting.title_en ? posting.title_en : posting.title

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    for (const q of MOCK_FORM_QUESTIONS) {
      if (q.required && !answers[q.id]?.trim()) {
        toast.error(isEn ? 'Please fill required fields.' : '필수 항목을 입력해주세요.')
        return
      }
    }
    setShowPayment(true)
  }

  const handleConfirmPayment = async () => {
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 600))
    setSubmitting(false)
    toast.success(isEn ? 'Mock apply only — nothing saved.' : '목업 신청만 진행됨 — 저장되지 않습니다.')
    router.push(`${DEBUG_BASE_PATH}/apply/complete?id=debug-app-1`)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <MainNav />
      <main className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <div>
          <p className="text-xs font-black uppercase text-primary tracking-widest">
            {isEn ? 'Debug apply' : '디버그 신청'}
          </p>
          <h1 className="text-2xl font-black mt-1">{title}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {isEn
              ? 'Form + payment modal UI only. Submit does not write to DB.'
              : '폼·결제 모달 UI만 확인합니다. 제출해도 DB에 저장되지 않습니다.'}
          </p>
        </div>

        {!showPayment ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            {MOCK_FORM_QUESTIONS.map((q) => {
              const label = isEn && q.question_text_en ? q.question_text_en : q.question_text
              return (
                <div key={q.id} className="space-y-2">
                  <Label className="font-bold">
                    {label}
                    {q.required ? ' *' : ''}
                  </Label>
                  {q.question_type === 'select' ? (
                    <Select
                      value={answers[q.id] || ''}
                      onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isEn ? 'Select' : '선택'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(isEn && q.options_en ? q.options_en : q.options || []).map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    />
                  )}
                </div>
              )
            })}
            <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-black">
              {isEn ? 'Continue to payment' : '결제 단계로'}
            </Button>
          </form>
        ) : (
          <Card className="border-border/80">
            <CardContent className="pt-6 space-y-5">
              <div>
                <p className="text-sm font-black">{isEn ? 'Bank transfer (mock)' : '계좌 이체 (목업)'}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(posting as any).bank_account || '카카오뱅크 3333-00-0000000'}
                </p>
              </div>
              <PaymentReceiptUploader
                locale={locale}
                previewUrl={preview}
                onFileSelect={async (file) => {
                  const url = URL.createObjectURL(file)
                  setPreview(url)
                  toast.message(isEn ? 'Mock file kept in memory only' : '목업 — 메모리에만 유지')
                }}
                onRemove={() => setPreview(null)}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>
                  {isEn ? 'Back' : '뒤로'}
                </Button>
                <Button className="flex-1 font-black" disabled={submitting} onClick={handleConfirmPayment}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {isEn ? 'Submitting...' : '제출 중...'}
                    </>
                  ) : isEn ? (
                    'Submit (mock)'
                  ) : (
                    '제출 (목업)'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
