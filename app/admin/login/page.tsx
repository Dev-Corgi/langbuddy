'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Globe } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const locale = useLocale()

  const toggleLocale = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko';
    localStorage.setItem('locale', newLocale);
    window.dispatchEvent(new Event('localeChange'));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/admin')
      router.refresh()
    }
  }

  const t = {
    ko: {
      title: "관리자 로그인",
      description: "동아리 관리를 위해 로그인해 주세요.",
      email: "이메일",
      password: "비밀번호",
      login: "로그인",
      loggingIn: "로그인 중...",
    },
    en: {
      title: "Admin Login",
      description: "Please login to manage the club.",
      email: "Email",
      password: "Password",
      login: "Login",
      loggingIn: "Logging in...",
    }
  }[locale];

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6 relative">
      <div className="absolute top-6 right-6">
        <button 
          onClick={toggleLocale}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border text-[13px] font-black text-muted-foreground hover:text-primary transition-colors uppercase shadow-sm"
        >
          <Globe className="w-4 h-4" />
          {locale}
        </button>
      </div>

      <Card className="w-full max-w-[400px] border-black shadow-xl rounded-[32px]">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-black">{t.title}</CardTitle>
          <CardDescription className="font-medium text-muted-foreground">
            {t.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl border-border focus:border-primary focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl border-border focus:border-primary focus:ring-primary"
              />
            </div>
            {error && (
              <p className="text-sm font-bold text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-[16px] font-black shadow-lg shadow-primary/20"
            >
              {loading ? t.loggingIn : t.login}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
