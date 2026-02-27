'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  BookOpen,
  Languages,
  Zap,
  Instagram, 
  Settings, 
  LogOut,
  Image as ImageIcon,
  Menu,
  X,
  Globe,
  MessageSquare
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useLocale } from '@/hooks/use-locale'
import { i18n } from '@/lib/i18n'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const locale = useLocale()

  // Close sidebar on mobile when route changes
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const toggleLocale = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko';
    localStorage.setItem('locale', newLocale);
    window.dispatchEvent(new Event('localeChange'));
  };

  const menuItems = [
    { href: '/admin/dashboard', label: locale === 'en' ? 'Dashboard' : '대시보드', icon: LayoutDashboard },
    // { href: '/admin/study', label: locale === 'en' ? 'Study' : '스터디 관리', icon: BookOpen },
    // { href: '/admin/language', label: locale === 'en' ? 'Language' : '언어교환 관리', icon: Languages },
    { href: '/admin/meetups', label: locale === 'en' ? 'Social' : '번개 관리', icon: Zap },
    // { href: '/admin/forms', label: locale === 'en' ? 'Responses' : '응답 관리', icon: MessageSquare },
    // { href: '/admin/carousel', label: locale === 'en' ? 'Carousel' : '캐러셀 관리', icon: ImageIcon },
    { href: '/admin/instagram', label: locale === 'en' ? 'Instagram' : '인스타 연동', icon: Instagram },
    { href: '/admin/settings', label: locale === 'en' ? 'Settings' : '설정', icon: Settings },
  ]

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-muted flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden h-14 bg-card border-b border-border flex items-center justify-between px-5 sticky top-0 z-50">
        <Link href="/admin/dashboard" className="shrink-0">
          <div className="flex flex-col leading-none">
            <span className="text-[12px] font-black text-primary">LangBuddy</span>
            <span className="text-[14px] font-black text-black">Admin Panel</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleLocale}
            className="p-2 text-muted-foreground hover:text-primary text-xs font-bold uppercase flex items-center gap-1"
          >
            <Globe className="w-4 h-4" />
            {locale}
          </button>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -mr-2 text-muted-foreground hover:text-primary"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-64 bg-background border-r border-border flex flex-col fixed inset-y-0 z-50 transition-transform duration-300 md:translate-x-0 md:static",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-border hidden md:block">
          <div className="flex flex-col leading-none">
            <span className="text-[14px] font-black text-primary">LangBuddy</span>
            <span className="text-[16px] font-black text-black">Admin Panel</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <Link 
              key={item.href}
              href={item.href} 
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm",
                pathname === item.href ? "bg-surface/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-1">
          <button 
            onClick={toggleLocale}
            className="flex items-center gap-3 px-4 py-3 w-full text-muted-foreground hover:bg-muted transition-all font-bold text-sm rounded-xl uppercase"
          >
            <Globe className="w-5 h-5" />
            Language: {locale}
          </button>
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 w-full text-muted-foreground hover:text-destructive transition-colors font-bold text-sm text-left"
          >
            <LogOut className="w-5 h-5" />
            {locale === 'en' ? 'Logout' : '로그아웃'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
