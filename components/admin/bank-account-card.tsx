'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Hash } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'

interface BankAccountCardProps {
  bankAccountName: string
  bankAccount: string
  onBankAccountNameChange: (value: string) => void
  onBankAccountChange: (value: string) => void
}

export function BankAccountCard({
  bankAccountName,
  bankAccount,
  onBankAccountNameChange,
  onBankAccountChange,
}: BankAccountCardProps) {
  const locale = useLocale()

  return (
    <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
      <CardHeader className="p-8 pb-0">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          {locale === 'en' ? 'Bank Account Info' : '입금 계좌 정보'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            {locale === 'en' ? 'Bank & Account Holder' : '은행명 / 예금주'}
          </Label>
          <Input
            value={bankAccountName}
            onChange={(e) => onBankAccountNameChange(e.target.value)}
            placeholder={locale === 'en' ? 'e.g. Toss Bank (Kim Youngjun)' : '예: 토스뱅크 (김영준)'}
            className="h-12 rounded-xl border-border text-sm font-medium"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
            <Hash className="w-4 h-4 text-primary" />
            {locale === 'en' ? 'Account Number' : '계좌 번호'}
          </Label>
          <Input
            value={bankAccount}
            onChange={(e) => onBankAccountChange(e.target.value)}
            placeholder={locale === 'en' ? 'e.g. 3333-01-1234567' : '예: 3333-01-1234567'}
            className="h-12 rounded-xl border-border text-sm font-medium font-mono tracking-wider"
          />
        </div>
        {(bankAccountName || bankAccount) && (
          <div className="rounded-2xl bg-muted/60 border border-border p-4 space-y-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {locale === 'en' ? 'Preview' : '미리보기'}
            </p>
            {bankAccountName && (
              <p className="text-sm font-bold text-foreground">{bankAccountName}</p>
            )}
            {bankAccount && (
              <p className="text-xl font-black text-primary tracking-wider">{bankAccount}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
