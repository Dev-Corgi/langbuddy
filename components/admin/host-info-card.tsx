'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Crown } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'

interface HostInfoCardProps {
  host: string
  hostEn: string
  onHostChange: (value: string) => void
  onHostEnChange: (value: string) => void
}

export function HostInfoCard({ host, hostEn, onHostChange, onHostEnChange }: HostInfoCardProps) {
  const locale = useLocale()
  
  return (
    <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
      <CardHeader className="p-8 pb-0">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          {locale === 'en' ? 'Host Settings' : '주최자 정보'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            주최자 (KO)
          </Label>
          <Input 
            value={host} 
            onChange={(e) => onHostChange(e.target.value)}
            className="h-12 rounded-xl border-border text-sm font-medium"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-bold text-primary flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            Host (EN)
          </Label>
          <Input 
            value={hostEn} 
            onChange={(e) => onHostEnChange(e.target.value)}
            className="h-12 rounded-xl border-primary/10 bg-primary/5 text-sm font-medium"
          />
        </div>
      </CardContent>
    </Card>
  )
}
