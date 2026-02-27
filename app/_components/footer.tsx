'use client'

import { Instagram } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"

export function Footer() {
  const locale = useLocale()
  
  return (
    <footer className="w-full bg-card border-t border-border mt-auto relative overflow-hidden">
      <div className="mx-auto max-w-screen-2xl px-6 py-10 md:py-16">
        <div className="flex flex-row justify-between items-end gap-4">
          {/* Left Section: Logo & Slogan */}
          <div className="flex flex-col items-start space-y-2 md:space-y-4">
            <span className="text-2xl md:text-3xl font-black text-primary tracking-tighter hover:opacity-80 transition-opacity">
              LangBuddy
            </span>
            <p className="text-muted-foreground text-[10px] md:text-base font-bold leading-relaxed max-w-[160px] md:max-w-sm">
              {locale === 'en' 
                ? 'Making the World Your Neighborhood.' 
                : '글로벌친목 & 언어교환동아리.'}
            </p>
          </div>

          {/* Right Section: Social & Copyright */}
          <div className="flex flex-col items-end space-y-4 md:space-y-6 text-right">
            {/* Instagram Button */}
            <a 
              href="https://instagram.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-sm group"
              aria-label="Instagram"
            >
              <Instagram size={18} className="md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
            </a>

            {/* Copyright */}
            <p className="text-muted-foreground/60 text-[9px] md:text-xs font-black tracking-tight whitespace-nowrap">
              &copy; 2026 LangBuddy. {locale === 'en' ? 'All rights reserved.' : '모든 권리 보유.'}
            </p>
          </div>
        </div>
      </div>
      {/* Mobile spacing for BottomNav */}
      <div className="h-20 md:hidden" />
    </footer>
  )
}
