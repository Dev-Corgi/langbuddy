'use client'

import { useMemo, useState } from 'react'
import {
  Loader2,
  User as UserIcon,
  CreditCard,
  CheckCircle2,
  Clock as ClockIcon,
  Trash2,
  LayoutGrid,
  Table2,
  RefreshCw,
  ImageIcon,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  buildResponseTableRows,
  FormQuestionRecord,
  FormResponseRecord,
  getCustomFormQuestions,
  getQuestionLabel,
} from '@/lib/admin-response-table'

type ViewMode = 'card' | 'table'

type LanguageResponsesPanelProps = {
  locale: 'ko' | 'en'
  responses: FormResponseRecord[]
  formQuestions: FormQuestionRecord[]
  confirmingId: string | null
  deletingResponseId: string | null
  onRefresh: () => void
  onConfirmPayment: (response: FormResponseRecord) => void
  onCancelResponse: (response: FormResponseRecord) => void
}

export function LanguageResponsesPanel({
  locale,
  responses,
  formQuestions,
  confirmingId,
  deletingResponseId,
  onRefresh,
  onConfirmPayment,
  onCancelResponse,
}: LanguageResponsesPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('card')

  const customQuestions = useMemo(() => getCustomFormQuestions(formQuestions), [formQuestions])
  const tableRows = useMemo(
    () => buildResponseTableRows(responses, formQuestions),
    [responses, formQuestions]
  )

  const en = locale === 'en'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-muted-foreground">
          {en ? `Total ${responses.length} responses` : `총 ${responses.length}건의 응답`}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex h-9 p-1 rounded-lg bg-muted">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={cn(
                'flex items-center gap-1.5 px-3 rounded-md text-xs font-black transition-all',
                viewMode === 'card'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {en ? 'Cards' : '카드'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-1.5 px-3 rounded-md text-xs font-black transition-all',
                viewMode === 'table'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Table2 className="w-3.5 h-3.5" />
              {en ? 'Table' : '표'}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} className="rounded-lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            {en ? 'Refresh' : '새로고침'}
          </Button>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="grid gap-4">
          {responses.map((res, idx) => (
            <Card key={res.id} className="border border-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserIcon className="w-5 h-5 text-primary shrink-0" />
                    <span className="font-black text-foreground">
                      {en ? `Response #${responses.length - idx}` : `응답 #${responses.length - idx}`}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(res.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {res.answers?._payment_method === '계좌송금' && (
                      <div
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-black flex items-center gap-1',
                          res.payment_status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        )}
                      >
                        {res.payment_status === 'confirmed' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            {en ? 'Confirmed' : '확인됨'}
                          </>
                        ) : (
                          <>
                            <ClockIcon className="w-3 h-3" />
                            {en ? 'Pending' : '대기중'}
                          </>
                        )}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={deletingResponseId === res.id}
                      title={en ? 'Delete application' : '신청 삭제'}
                      onClick={() => onCancelResponse(res)}
                    >
                      {deletingResponseId === res.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {typeof res.answers?._payment_method === 'string' && res.answers._payment_method && (
                  <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <CreditCard className="w-4 h-4 text-primary" />
                      {en ? 'Payment' : '결제 정보'}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{en ? 'Method: ' : '방식: '}</span>
                        <span className="font-bold">{String(res.answers._payment_method)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{en ? 'Status: ' : '상태: '}</span>
                        <span
                          className={cn(
                            'font-bold',
                            res.payment_status === 'confirmed' ? 'text-emerald-600' : 'text-amber-600'
                          )}
                        >
                          {res.payment_status === 'confirmed'
                            ? en
                              ? 'Confirmed'
                              : '확인 완료'
                            : en
                              ? 'Pending'
                              : '확인 대기'}
                        </span>
                      </div>
                    </div>
                    {res.payment_receipt_url && (
                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          {en ? 'Receipt' : '입금 영수증'}
                        </p>
                        <a
                          href={res.payment_receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block relative aspect-video max-w-[200px] rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={res.payment_receipt_url}
                            alt="Payment receipt"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      </div>
                    )}
                    {res.answers._payment_method === '계좌송금' &&
                      res.payment_status !== 'confirmed' && (
                        <Button
                          onClick={() => onConfirmPayment(res)}
                          disabled={confirmingId === res.id}
                          size="sm"
                          className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                          {confirmingId === res.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {en ? 'Processing...' : '처리중...'}
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              {en ? 'Confirm' : '확인'}
                            </>
                          )}
                        </Button>
                      )}
                  </div>
                )}

                <div className="grid gap-3">
                  {formQuestions.map((q) => {
                    const answer = res.answers?.[q.id!]
                    if (!answer) return null
                    return (
                      <div key={q.id} className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-muted-foreground">
                          {getQuestionLabel(q, locale)}
                        </span>
                        <span className="text-sm font-bold text-foreground">
                          {Array.isArray(answer) ? answer.join(', ') : String(answer)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="sticky left-0 z-20 bg-muted/95 px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    #
                  </th>
                  <th className="sticky left-10 z-20 bg-muted/95 px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap min-w-[140px]">
                    {en ? 'Applied at' : '신청일시'}
                  </th>
                  <th className="sticky left-[196px] z-20 bg-muted/95 px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap min-w-[88px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                    {en ? 'Name' : '이름'}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    {en ? 'Gender' : '성별'}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    {en ? 'Nationality' : '국적'}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    {en ? 'Language' : '언어'}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    {en ? 'Kakao' : '카카오'}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    {en ? 'Drink' : '음료'}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    {en ? 'Payment' : '결제'}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    {en ? 'Deposit' : '입금'}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">
                    {en ? 'Check-in' : '체크인'}
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-black text-muted-foreground whitespace-nowrap">
                    {en ? 'Receipt' : '영수증'}
                  </th>
                  {customQuestions.map((q) => (
                    <th
                      key={q.id}
                      className="px-3 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap max-w-[160px]"
                    >
                      {getQuestionLabel(q, locale)}
                    </th>
                  ))}
                  <th className="sticky right-0 z-20 bg-muted/95 px-3 py-3 text-center text-xs font-black text-muted-foreground whitespace-nowrap shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                    {en ? 'Actions' : '관리'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => {
                  const res = responses.find((r) => r.id === row.id)!
                  const isBankTransfer = row.paymentMethod === '계좌송금'
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/80 hover:bg-muted/30 even:bg-muted/10"
                    >
                      <td className="sticky left-0 z-10 bg-card even:bg-muted/10 px-3 py-3 font-black text-muted-foreground whitespace-nowrap">
                        {row.index}
                      </td>
                      <td className="sticky left-10 z-10 bg-card even:bg-muted/10 px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="sticky left-[196px] z-10 bg-card even:bg-muted/10 px-3 py-3 font-bold whitespace-nowrap shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]">
                        {row.name}
                      </td>
                      <td className="px-3 py-3 font-bold whitespace-nowrap">{row.gender}</td>
                      <td className="px-3 py-3 font-bold whitespace-nowrap">{row.nationality}</td>
                      <td className="px-3 py-3 font-bold whitespace-nowrap">{row.language}</td>
                      <td className="px-3 py-3 font-bold whitespace-nowrap max-w-[120px] truncate">
                        {row.kakaoId}
                      </td>
                      <td className="px-3 py-3 font-bold whitespace-nowrap">{row.drink}</td>
                      <td className="px-3 py-3 font-bold whitespace-nowrap">{row.paymentMethod}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {isBankTransfer ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black',
                              row.paymentStatus === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            )}
                          >
                            {row.paymentStatus === 'confirmed' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                {en ? 'Confirmed' : '확인됨'}
                              </>
                            ) : (
                              <>
                                <ClockIcon className="w-3 h-3" />
                                {en ? 'Pending' : '대기중'}
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {row.checkedInAt ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <Check className="w-3.5 h-3.5" />
                            {new Date(row.checkedInAt).toLocaleString(undefined, {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {row.receiptUrl ? (
                          <a
                            href={row.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                            title={en ? 'View receipt' : '영수증 보기'}
                          >
                            <ImageIcon className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {customQuestions.map((q) => (
                        <td
                          key={q.id}
                          className="px-3 py-3 font-bold whitespace-nowrap max-w-[160px] truncate"
                          title={row.customAnswers[q.id!] ?? '—'}
                        >
                          {row.customAnswers[q.id!] ?? '—'}
                        </td>
                      ))}
                      <td className="sticky right-0 z-10 bg-card even:bg-muted/10 px-2 py-2 whitespace-nowrap shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-center gap-1">
                          {isBankTransfer && row.paymentStatus !== 'confirmed' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              disabled={confirmingId === row.id}
                              title={en ? 'Confirm payment' : '입금 확인'}
                              onClick={() => onConfirmPayment(res)}
                            >
                              {confirmingId === row.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingResponseId === row.id}
                            title={en ? 'Delete application' : '신청 삭제'}
                            onClick={() => onCancelResponse(res)}
                          >
                            {deletingResponseId === row.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
