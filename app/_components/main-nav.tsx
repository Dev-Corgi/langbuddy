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
];

export function MainNav(props: { activePrimaryLabel?: string }) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        if (user.email === 'pomato5959@gmail.com') {
          setIsSuperAdmin(true)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_superadmin')
          .eq('id', user.id)
          .single()
        
        if (profile?.is_superadmin) {
          setIsSuperAdmin(true)
        }
      }
    }
    checkAdmin()
  }, [supabase])

  return (
    <Suspense fallback={<div className="h-[72px] bg-background border-b border-border" />}>
      <MainNavContent {...props} isSuperAdmin={isSuperAdmin} />
    </Suspense>
  )
}

function MainNavContent({ activePrimaryLabel, isSuperAdmin }: { activePrimaryLabel?: string, isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const locale = useLocale();
  
  const toggleLocale = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko';
    localStorage.setItem('locale', newLocale);
    window.dispatchEvent(new Event('localeChange'));
  };

  const t = i18n[locale];
  const allLinks = PRIMARY_LINKS(t);
  const links = allLinks.filter(link => {
    if (link.href === '/posting/study' || link.href === '/posting/language') {
      return isSuperAdmin;
    }
    return true;
  });
  
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

            {/* Community Live Pulse */}
            <div className="flex items-center gap-3 ml-4">
              {/* Pulse 1: Online Buddies (Member Count) */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 border border-border/50">
                <div className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Live</span>
                  <span className="text-[12px] font-bold text-foreground/70">1,248 Online</span>
                </div>
              </div>

              {/* Pulse 2: Today's Active Events */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10">
                <div className="p-0.5 rounded-md bg-primary/10 text-primary">
                  <Zap className="w-3 h-3 fill-primary" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-[9px] font-black text-primary/60 uppercase tracking-wider mb-0.5">Today</span>
                  <span className="text-[12px] font-bold text-foreground/70">12 Active</span>
                </div>
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
              
              {/* <Link 
                href="#" 
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-[12px] font-black transition-all shadow-sm active:scale-95"
              >
                <User className="w-3.5 h-3.5" />
                {t.nav.login}
              </Link> */}
            </div>
          </div>

          {/* Bottom Row - More compact */}
          {/* <div className="flex items-center h-[48px] justify-between">
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
              <Link href="#" className="flex items-center gap-2 text-[13px] font-black text-muted-foreground hover:text-primary transition-colors">
                <ReceiptText className="w-4 h-4" />
                {t.nav.myBookings}
              </Link>
            </div>
          </div> */}
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
                className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground transition-colors active:bg-primary/90"
              >
                <Globe className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
