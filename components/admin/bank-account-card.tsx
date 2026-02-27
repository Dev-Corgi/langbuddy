'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IdCard } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'

interface BankAccountCardProps {
  bankAccount: string
  onBankAccountChange: (value: string) => void
}

export function BankAccountCard({ bankAccount, onBankAccountChange }: BankAccountCardProps) {
  const locale = useLocale()
  
  return (
    <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
      <CardHeader className="p-8 pb-0">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          {locale === 'en' ? 'Bank Account' : '입금 계좌 정보'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
            <IdCard className="w-4 h-4 text-primary" />
            계좌 번호 (은행명 포함)
          </Label>
          <Input 
            value={bankAccount} 
            onChange={(e) => onBankAccountChange(e.target.value)}
            placeholder="예: 카카오뱅크 3333-01-1234567 홍길동"
            className="h-12 rounded-xl border-border text-sm font-medium"
          />
        </div>
      </CardContent>
    </Card>
  )
}
