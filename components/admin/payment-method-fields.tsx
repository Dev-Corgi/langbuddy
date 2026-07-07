'use client'

import { useRef } from 'react'
import { ImageIcon, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PAYMENT_METHODS,
  formatPaymentMethodLabel,
  isBankTransferMethod,
  type PaymentMethod,
} from '@/lib/supported-payment-methods'

interface PaymentMethodFieldsProps {
  paymentMethod: PaymentMethod | null
  onPaymentMethodChange: (method: PaymentMethod) => void
  paymentStatus?: string | null
  disabled?: boolean
  receiptUrl?: string | null
  pendingReceiptPreview?: string | null
  onReceiptFileSelect?: (file: File) => void
  pendingReceiptHint?: string
}

export function PaymentMethodFields({
  paymentMethod,
  onPaymentMethodChange,
  paymentStatus = null,
  disabled = false,
  receiptUrl = null,
  pendingReceiptPreview = null,
  onReceiptFileSelect,
  pendingReceiptHint,
}: PaymentMethodFieldsProps) {
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const showBankTransfer = isBankTransferMethod(paymentMethod)
  const showReceiptSection = showBankTransfer || Boolean(pendingReceiptPreview)
  const displayReceiptUrl = pendingReceiptPreview ?? receiptUrl

  return (
    <>
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground">결제 수단</label>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((method) => (
            <Button
              key={method}
              type="button"
              variant={paymentMethod === method ? 'default' : 'outline'}
              className="rounded-xl text-xs font-bold h-10"
              onClick={() => onPaymentMethodChange(method)}
              disabled={disabled}
            >
              {method}
            </Button>
          ))}
        </div>
        {paymentMethod ? (
          <p className="text-[11px] font-medium text-muted-foreground">
            {formatPaymentMethodLabel(paymentMethod, paymentStatus)}
          </p>
        ) : null}
      </div>

      {showReceiptSection ? (
        <div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-border/60">
          <p className="text-xs font-bold text-muted-foreground">입금 영수증</p>
          {displayReceiptUrl ? (
            <a
              href={displayReceiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative aspect-video rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
              onClick={(e) => {
                if (pendingReceiptPreview) e.preventDefault()
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayReceiptUrl}
                alt="입금 영수증"
                className="w-full h-full object-cover"
              />
            </a>
          ) : (
            <div className="flex items-center justify-center aspect-video rounded-lg border border-dashed border-border bg-muted/20">
              <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
            </div>
          )}
          {onReceiptFileSelect ? (
            <>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) onReceiptFileSelect(file)
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl text-xs font-bold gap-2"
                disabled={disabled}
                onClick={() => receiptInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                {displayReceiptUrl ? '영수증 변경' : '영수증 업로드'}
              </Button>
              {pendingReceiptHint ? (
                <p className="text-[11px] font-medium text-muted-foreground text-center">
                  {pendingReceiptHint}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
