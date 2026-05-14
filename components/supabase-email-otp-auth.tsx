'use client'

/**
 * Supabase email passwordless: `signInWithOtp` + `verifyOtp` (type `email`).
 * Hosted project must use the **Magic link** template with `{{ .Token }}` so mail shows a 6-digit code
 * (not only a clickable link). See Supabase → Auth → Email templates.
 *
 * Apply the repo template via Management API:
 *   SUPABASE_ACCESS_TOKEN=sbp_... npm run supabase:apply-otp-mail
 * Or paste `supabase/templates/magic_link_otp.html` in the dashboard.
 *
 * If new users still get "confirm signup" link emails, disable "Confirm email" for the Email provider
 * or adjust the Confirm signup template similarly.
 */

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

type Props = {
  locale: string
  onSuccess: () => void
}

function isValidEmail(raw: string): boolean {
  const s = raw.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export function SupabaseEmailOtpAuth({ locale, onSuccess }: Props) {
  const isEn = locale === 'en'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const emailRef = useRef('')

  const sendCode = async () => {
    const addr = email.trim()
    if (!isValidEmail(addr)) {
      toast.error(isEn ? 'Enter a valid email address.' : '올바른 이메일 주소를 입력해주세요.')
      return
    }

    const supabase = createClient()
    setSending(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { shouldCreateUser: true },
      })
      if (error) throw error
      emailRef.current = addr
      setStep('code')
      toast.success(
        isEn ? 'Check your inbox for the code.' : '이메일로 인증번호를 보냈습니다. 메일함을 확인해주세요.'
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Email send failed'
      console.error(e)
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  const verifyAndSignIn = async () => {
    const stored = emailRef.current
    if (!stored || !code.trim()) {
      toast.error(isEn ? 'Enter the code.' : '인증번호를 입력해주세요.')
      return
    }

    const supabase = createClient()
    setVerifying(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: stored,
        token: code.trim(),
        type: 'email',
      })
      if (error) throw error
      if (!data.session?.user) throw new Error('No session')

      const u = data.session.user
      const display = u.email?.split('@')[0] || u.email || 'Guest'

      const { error: profileErr } = await supabase.from('users').upsert(
        {
          id: u.id,
          name: display,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      if (profileErr) console.warn('[supabase-email-otp-auth] users upsert:', profileErr)

      toast.success(isEn ? 'Signed in.' : '로그인되었습니다.')
      onSuccess()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Verify failed'
      console.error(e)
      toast.error(msg)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-4 text-left">
      {step === 'email' ? (
        <>
          <div className="space-y-2">
            <Label className="font-bold">{isEn ? 'Email' : '이메일'}</Label>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={isEn ? 'you@example.com' : '이메일 주소'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <Button
            type="button"
            className="w-full h-12 rounded-xl font-black"
            onClick={sendCode}
            disabled={sending}
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : isEn ? 'Send code' : '인증번호 받기'}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {isEn ? (
              <>
                We sent a code to <span className="font-bold text-foreground">{email.trim()}</span>.
              </>
            ) : (
              <>
                <span className="font-bold text-foreground">{email.trim()}</span>로 인증번호를 보냈습니다.
              </>
            )}
          </p>
          <div className="space-y-2">
            <Label className="font-bold">{isEn ? 'Verification code' : '인증번호'}</Label>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-xl font-bold"
              onClick={() => {
                setStep('email')
                setCode('')
                emailRef.current = ''
              }}
            >
              {isEn ? 'Back' : '뒤로'}
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 rounded-xl font-black"
              onClick={verifyAndSignIn}
              disabled={verifying}
            >
              {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : isEn ? 'Verify' : '확인'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
