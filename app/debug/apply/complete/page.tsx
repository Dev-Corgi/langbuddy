'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { CheckCircle2, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { MainNav } from '@/app/_components/main-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLocale } from '@/hooks/use-locale'
import { DEBUG_BASE_PATH } from '@/lib/debug/debug-base-path'
import { MOCK_COMPLETE_RESPONSE } from '@/lib/debug/mock-data'

function DebugCompleteInner() {
  const locale = useLocale()
  const isEn = locale === 'en'
  const data = MOCK_COMPLETE_RESPONSE
  const title = isEn && data.forms.title_en ? data.forms.title_en : data.forms.title
  const qrValue = data.qr_code

  return (
    <div className="min-h-screen bg-background pb-24">
      <MainNav />
      <main className="mx-auto max-w-lg px-4 py-10 space-y-6">
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-black">
            {isEn ? 'Application complete (mock)' : '신청 완료 (목업)'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'QR is shown on this page only (no notifications in debug).'
              : 'QR은 이 페이지에서만 표시됩니다 (디버그에서는 알림 없음).'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-black">{title}</CardTitle>
            <CardDescription>{data.id}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <QRCodeSVG value={qrValue} size={180} />
            </div>
            <p className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5" />
              {qrValue}
            </p>
            <Button asChild className="font-black w-full">
              <Link href={`${DEBUG_BASE_PATH}/my`}>
                {isEn ? 'Go to My page' : '마이페이지로'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function DebugApplyCompletePage() {
  return (
    <Suspense fallback={null}>
      <DebugCompleteInner />
    </Suspense>
  )
}
