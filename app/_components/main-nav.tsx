'use client'

import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import { createClient } from "@/lib/supabase"
import { Search, User, ReceiptText, ChevronRight, Globe, Zap } from "lucide-react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { i18n, type Locale } from "@/lib/i18n"
import { useLocale } from "@/hooks/use-locale"

const PRIMARY_LINKS = (t: any) => [
  { href: "/", label: t.nav.home },
  { href: "/posting/study", label: t.nav.study },
  { href: "/posting/language", label: t.nav.language },
  { href: "/posting", label: t.nav.social },
  { href: "/my", label: t.nav.myPage },
];

export function MainNav(props: { activePrimaryLabel?: string }) {
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)
      
      if (authUser) {
        const { data: userInfo } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        setUserData(userInfo)
      }
    }
    loadUser()
  }, [supabase])

  return (
    <Suspense fallback={<div className="h-[72px] bg-background border-b border-border" />}>
      <MainNavContent {...props} user={user} userData={userData} />
    </Suspense>
  )
}

function MainNavContent({ activePrimaryLabel, user, userData }: { activePrimaryLabel?: string, user: any, userData: any }) {
  const pathname = usePathname();
  const locale = useLocale();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  };
  
  const toggleLocale = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko';
    localStorage.setItem('locale', newLocale);
    window.dispatchEvent(new Event('localeChange'));
  };

  const t = i18n[locale];
  const links = PRIMARY_LINKS(t);
  
  // 현재 경로를 기반으로 활성 탭 결정
  // 1. pathname으로 매칭 시도
  const matchedLink = links.find(link => {
    if (link.href === '/') return pathname === '/';
    return pathname.startsWith(link.href);
  });

  const currentActiveLabel = activePrimaryLabel || matchedLink?.label || t.nav.home;

  return (
    <header className="w-full border-b border-border bg-background sticky top-0 z-100">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-screen-2xl px-6">
          {/* Top Row */}
          <div className="flex items-center h-[64px] gap-6">
            {/* Logo */}
            <Link href="/" className="shrink-0 transition-transform hover:scale-105 active:scale-95 flex items-center h-full">
              <span className="text-[22px] font-black text-primary tracking-tighter leading-none">LangBuddy</span>
            </Link>

            {/* Slogan */}
            <div className="hidden lg:flex items-center gap-4 h-full">
              <div className="border-l border-border h-4" />
              <p className="text-[13px] font-bold text-muted-foreground tracking-tight whitespace-nowrap leading-none mt-0.5">
                {locale === 'en' ? 'Making the World Your Neighborhood' : '글로벌친목 & 언어교환동아리'}
              </p>
            </div>

            {/* Community pulse — 실데이터 연동 전까지 카운트 미표시 (가짜 숫자 제거) */}
            <div className="flex items-center gap-3 ml-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 border border-border/50">
                <div className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </div>
                <span className="text-[12px] font-bold text-foreground/70">
                  {locale === 'en' ? 'Open community' : '함께하는 모임'}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10">
                <div className="p-0.5 rounded-md bg-primary/10 text-primary">
                  <Zap className="w-3 h-3 fill-primary" />
                </div>
                <span className="text-[12px] font-bold text-foreground/70">
                  {locale === 'en' ? 'This week' : '이번 주'}
                </span>
              </div>
            </div>

            {/* User Utility Area */}
            <div className="ml-auto flex items-center gap-3">
              <button 
                onClick={toggleLocale}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg hover:bg-accent text-[12px] font-black text-muted-foreground hover:text-primary transition-all uppercase"
              >
                <Globe className="w-3.5 h-3.5" />
                {locale}
              </button>
              
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[12px] font-black text-foreground">{userData?.name || 'User'}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="h-9 px-3 rounded-lg hover:bg-accent text-[12px] font-black text-muted-foreground hover:text-destructive transition-all"
                  >
                    {locale === 'en' ? 'Logout' : '로그아웃'}
                  </button>
                </div>
              ) : (
                <Link 
                  href="/auth/login" 
                  className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-[12px] font-black transition-all shadow-sm active:scale-95"
                >
                  <User className="w-3.5 h-3.5" />
                  {locale === 'en' ? 'Login' : '로그인'}
                </Link>
              )}
            </div>
          </div>

          {/* Bottom Row - More compact */}
          <div className="flex items-center h-[48px] justify-between">
            <nav className="flex items-center gap-8 h-full">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={cn(
                    "relative h-full flex items-center text-[15px] font-black transition-colors tracking-tight",
                    currentActiveLabel === link.label ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                  {currentActiveLabel === link.label && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary rounded-full" 
                    />
                  )}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-5">
              <Link href="/my" className="flex items-center gap-2 text-[13px] font-black text-muted-foreground hover:text-primary transition-colors">
                <ReceiptText className="w-4 h-4" />
                {t.nav.myBookings}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="flex flex-col">
          <div className="flex items-center justify-between h-16 px-6 border-b border-border/50 bg-background/95 backdrop-blur-md">
            <Link href="/" className="shrink-0 transition-transform active:scale-95 flex items-center h-full">
              <span className="text-[20px] font-black text-primary tracking-tighter leading-none">LangBuddy</span>
            </Link>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleLocale}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-foreground transition-colors active:bg-muted/80"
              >
                <Globe className="w-5 h-5" />
              </button>
              
              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground transition-colors active:bg-primary/90"
                >
                  <User className="w-5 h-5" />
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground transition-colors active:bg-primary/90"
                >
                  <User className="w-5 h-5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
