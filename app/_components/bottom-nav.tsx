'use client'

import Link from "next/link"
import { Home, Languages, Zap, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

import { useLocale } from "@/hooks/use-locale"

const NAV_ITEMS = (locale: string) => [
  { icon: Home, label: locale === 'en' ? 'Home' : '홈', href: "/" },
  { icon: Languages, label: locale === 'en' ? 'Language' : '언어교환', href: "/posting/language" },
  { icon: Zap, label: locale === 'en' ? 'Lightning' : '번개', href: "/posting" },
  { icon: User, label: locale === 'en' ? 'My' : '마이', href: "/my" },
]

export function BottomNav() {
  const pathname = usePathname()
  const locale = useLocale()

  // Hide BottomNav on booking pages
  if (pathname?.startsWith('/booking')) return null

  const items = NAV_ITEMS(locale)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 px-2 bg-card/80 backdrop-blur-lg border-t border-border md:hidden">
      {items.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-2 py-1 transition-all duration-300",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground/70"
            )}
          >
            <item.icon className={cn("h-5.5 w-5.5", isActive && "stroke-[2.5px]")} />
            <span className={cn("text-[10px] font-black tracking-tighter uppercase", isActive ? "text-primary" : "text-muted-foreground/60")}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
