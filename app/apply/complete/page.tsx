'use client'

import { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { MainNav } from "@/app/_components/main-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, Download, Share2, Loader2, QrCode } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useLocale } from "@/hooks/use-locale"
import { i18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export default function ApplicationCompletePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  const supabase = createClient()
  const locale = useLocale()
  const tDict = i18n[locale]
  
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) {
      router.push('/')
      return
    }

    async function fetchData() {
      const { data: response, error } = await supabase
        .from('form_responses')
        .select('*, forms(title, title_en)')
        .eq('id', id)
        .single()

      if (error || !response) {
        console.error('Error fetching application:', error)
        router.push('/')
        return
      }

      setData(response)
      setLoading(false)
    }

    fetchData()
  }, [id, supabase, router])

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      canvas.width = img.width + 40
      canvas.height = img.height + 40
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 20, 20)
        const pngUrl = canvas.toDataURL('image/png')
        const downloadLink = document.createElement('a')
        downloadLink.href = pngUrl
        downloadLink.download = `LangBuddy-QR-${id?.slice(0, 8)}.png`
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
      }
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  const formTitle = locale === 'en' && data.forms?.title_en ? data.forms.title_en : data.forms?.title

  return (
    <div className="min-h-screen bg-muted overflow-x-hidden">
      <MainNav />
      <main className="mx-auto max-w-2xl w-full px-4 md:px-6 py-12 md:py-20">
        <div className="text-center space-y-6 mb-10">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
              {locale === 'en' ? 'Application Confirmed!' : '신청이 완료되었습니다!'}
            </h1>
            <p className="text-lg text-muted-foreground font-medium">
              {formTitle}
            </p>
          </div>
        </div>

        <Card className="border-none shadow-2xl rounded-[40px] overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-8 duration-700">
          <CardHeader className="p-8 pb-0 text-center">
            <CardTitle className="text-xl font-black flex items-center justify-center gap-2">
              <QrCode className="w-6 h-6 text-primary" />
              {locale === 'en' ? 'Your Personal QR Code' : '나의 입장용 QR 코드'}
            </CardTitle>
            <CardDescription className="text-muted-foreground font-bold pt-2">
              {locale === 'en' 
                ? 'Please show this QR code to the staff at the venue.' 
                : '행사 현장에서 운영진에게 이 QR 코드를 보여주세요.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 md:p-12 space-y-10">
            <div 
              ref={qrRef}
              className="relative aspect-square max-w-[280px] mx-auto p-6 bg-white rounded-3xl shadow-inner border-8 border-muted flex items-center justify-center"
            >
              <QRCodeSVG 
                value={data.qr_code || ""} 
                size={240}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                onClick={handleDownloadQR}
                className="h-14 rounded-2xl bg-primary hover:bg-secondary font-black text-lg shadow-lg shadow-primary/20"
              >
                <Download className="w-5 h-5 mr-2" />
                {locale === 'en' ? 'Save QR' : 'QR 저장하기'}
              </Button>
              <Button 
                variant="outline"
                className="h-14 rounded-2xl border-border text-muted-foreground font-bold hover:bg-muted"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'LangBuddy QR Code',
                      text: `${formTitle} - My QR Code`,
                      url: window.location.href
                    })
                  } else {
                    alert(locale === 'en' ? 'Sharing not supported' : '공유하기를 지원하지 않는 브라우저입니다.')
                  }
                }}
              >
                <Share2 className="w-5 h-5 mr-2" />
                {locale === 'en' ? 'Share' : '공유하기'}
              </Button>
            </div>

            <div className="p-6 rounded-3xl bg-muted/50 border border-border space-y-4">
              <div className="flex justify-between items-center text-sm border-b border-border pb-3">
                <span className="text-muted-foreground font-bold">{locale === 'en' ? 'Name' : '신청자'}</span>
                <span className="text-foreground font-black">{data.answers?.name || data.answers?.이름 || 'Anonymous'}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-border pb-3">
                <span className="text-muted-foreground font-bold">{locale === 'en' ? 'Language' : '선택 언어'}</span>
                <span className="text-primary font-black uppercase">{data.answers?._selected_language || '-'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-bold">{locale === 'en' ? 'Status' : '결제 상태'}</span>
                <span className={cn(
                  "font-black",
                  data.answers?._payment_method === "계좌송금" ? "text-amber-500" : "text-primary"
                )}>
                  {data.answers?._payment_method || (locale === 'en' ? 'On-site' : '현장 결제')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-12 text-center">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/')}
            className="text-muted-foreground font-bold hover:text-primary transition-colors"
          >
            {locale === 'en' ? 'Return to Home' : '홈으로 돌아가기'}
          </Button>
        </div>
      </main>
    </div>
  )
}
