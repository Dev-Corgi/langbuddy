'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { 
  BookOpen,
  Languages,
  Zap,
  Instagram, 
  ChevronRight,
  PlusCircle,
  Users,
  Image as ImageIcon,
  Loader2,
  ClipboardList,
  QrCode,
  LayoutGrid
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useLocale } from '@/hooks/use-locale'

export default function AdminDashboardPage() {
  const locale = useLocale()
  const supabase = createClient()
  
  const [stats, setStats] = useState<any[]>([])
  const [recentPostings, setRecentPostings] = useState<any[]>([])
  const [instaCount, setInstaCount] = useState(0)
  const [formCount, setFormCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  const [todaySession, setTodaySession] = useState<any>(null)
  const [checkinCount, setCheckinCount] = useState(0)
  const [totalApplications, setTotalApplications] = useState(0)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      let userProfile = null
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_superadmin')
          .eq('id', user.id)
          .single()
        userProfile = profile
        setIsSuperAdmin(!!profile?.is_superadmin)
      }
      
      // Fetch today's session for seating system
      if (userProfile?.is_superadmin) {
        const todayStr = new Date().toISOString().split('T')[0]
        const { data: sessions } = await supabase
          .from('postings')
          .select('*')
          .eq('category', '언어교환')
          .eq('status', 'active')
          .gte('date', todayStr)
          .order('date', { ascending: true })
          .limit(1)

        if (sessions && sessions.length > 0) {
          const session = sessions[0]
          setTodaySession(session)

          // Fetch check-in stats
          const { data: responses } = await supabase
            .from('form_responses')
            .select('id, checked_in_at')
            .eq('form_id', session.form_id)

          if (responses) {
            setTotalApplications(responses.length)
            setCheckinCount(responses.filter(r => r.checked_in_at).length)
          }
        }
      }
      
      // Fetch stats
      let statsQuery = supabase
        .from('postings')
        .select('*', { count: 'exact', head: true })

      if (!userProfile?.is_superadmin && user) {
        statsQuery = statsQuery.eq('created_by', user.id)
      }

      const { count: studyCount } = await (userProfile?.is_superadmin 
        ? supabase.from('postings').select('*', { count: 'exact', head: true }).eq('category', '스터디')
        : Promise.resolve({ count: 0 }))

      const { count: languageCount } = await (userProfile?.is_superadmin 
        ? supabase.from('postings').select('*', { count: 'exact', head: true }).eq('category', '언어교환')
        : Promise.resolve({ count: 0 }))

      const { count: meetupCount } = await statsQuery.eq('category', '번개')

      const { count: currentInstaCount } = await supabase
        .from('instagram_posts')
        .select('*', { count: 'exact', head: true })
      
      const { count: currentFormCount } = await supabase
        .from('forms')
        .select('*', { count: 'exact', head: true })
      
      setInstaCount(currentInstaCount || 0)
      setFormCount(currentFormCount || 0)

      // Fetch recent postings
      let recentQuery = supabase
        .from('postings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)
      
      if (!userProfile?.is_superadmin && user) {
        recentQuery = recentQuery.eq('created_by', user.id)
      }

      const { data: recent } = await recentQuery
      
      setRecentPostings(recent || [])

      const statsItems = []
      
      if (userProfile?.is_superadmin) {
        statsItems.push(
          { 
            label: locale === 'en' ? 'Study' : '스터디', 
            value: (studyCount || 0).toString(), 
            icon: BookOpen, 
            color: 'text-primary',
            href: '/admin/study'
          },
          { 
            label: locale === 'en' ? 'Language' : '언어교환', 
            value: (languageCount || 0).toString(), 
            icon: Languages, 
            color: 'text-primary',
            href: '/admin/language'
          }
        )
      }

      statsItems.push({ 
        label: locale === 'en' ? 'Social' : '번개 모임', 
        value: (meetupCount || 0).toString(), 
        icon: Zap, 
        color: 'text-primary',
        href: '/admin/meetups'
      })

      setStats(statsItems)
      
      setLoading(false)
    }
    fetchData()
  }, [supabase, locale])

  if (loading) {
    return (
      <div className="p-4 md:p-10">
        <div className="max-w-5xl mx-auto space-y-6 md:space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-10 w-64 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>
            <Skeleton className="h-12 w-full md:w-48 rounded-2xl" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-border shadow-sm rounded-[24px] border-none">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="rounded-[24px] border-border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-[24px] border-border shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30">
                  <Skeleton className="h-16 w-16 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
              {locale === 'en' ? 'Welcome, Admin!' : '환영합니다, 관리자님!'}
            </h1>
            <p className="text-muted-foreground font-medium mt-1 text-sm md:text-base">
              {locale === 'en' ? 'Manage club content at a glance.' : '동아리 콘텐츠를 한눈에 관리하세요.'}
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-2xl h-12 px-6 font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 w-full md:w-auto">
            <Link href="/admin/postings/new?category=번개">
              <Zap className="w-5 h-5" />
              {locale === 'en' ? 'New Lightning Meetup' : '새 번개 모임 등록'}
            </Link>
          </Button>
        </div>

        {/* Seating System Quick Access (SuperAdmin Only) */}
        {isSuperAdmin && todaySession && (
          <Card className="border-primary/20 shadow-lg rounded-[32px] overflow-hidden bg-surface/5">
            <CardHeader className="p-6 md:p-8 pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black">
                      {locale === 'en' ? "Today's Session Seating" : "오늘의 모임 자리배치"}
                    </CardTitle>
                    <p className="text-sm font-bold text-muted-foreground mt-0.5">
                      {todaySession.title} ({todaySession.date})
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="text-right mr-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Check-in Status</p>
                    <p className="text-lg font-black text-primary">{checkinCount} / {totalApplications}</p>
                  </div>
                  <Button asChild className="rounded-xl font-black gap-2">
                    <Link href="/admin/arrange">
                      <LayoutGrid className="w-4 h-4" />
                      {locale === 'en' ? 'Arrange Seats' : '자리 배치하기'}
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <Link href="/admin/arrange">
                <div className="p-4 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-foreground">{locale === 'en' ? 'Seat Arrangement' : '자리 배치 관리'}</p>
                    <p className="text-xs font-bold text-muted-foreground">{locale === 'en' ? 'QR check-in, rounds, and DnD' : 'QR 출석 체크, 라운드 관리 및 드래그 배치'}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href}>
              <Card className="border-border shadow-sm rounded-[24px] border-none hover:ring-2 hover:ring-primary/20 transition-all">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl md:text-3xl font-black text-foreground">{stat.value}</p>
                    </div>
                    <div className={cn("p-3 rounded-2xl bg-muted", stat.color)}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions / Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 md:gap-8">
          <Card className="border-border shadow-sm rounded-[32px] overflow-hidden border-none">
            <CardHeader className="bg-muted/50 border-b border-border">
              <CardTitle className="text-lg md:text-xl font-black">
                {locale === 'en' ? 'Recent Postings' : '최근 등록된 포스팅'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-100">
                {recentPostings?.map((post) => (
                  <Link key={post.id} href={
                    post.category === '스터디' ? '/admin/study' :
                    post.category === '언어교환' ? '/admin/language' : `/admin/postings/${post.id}`
                  }>
                    <div className="p-4 md:p-5 flex items-center justify-between hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-muted overflow-hidden shrink-0">
                          {post.image_url && <img src={post.image_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-foreground text-sm md:text-base truncate">
                            {locale === 'en' && post.title_en ? post.title_en : post.title}
                          </p>
                          <p className="text-[10px] md:xs font-bold text-muted-foreground truncate">
                            <span className="text-primary mr-2">[{post.category}]</span>
                            {post.is_recurring 
                              ? (locale === 'en' ? `Every ${post.recurring_days?.join(', ')}` : `매주 ${post.recurring_days?.join(', ')}`)
                              : post.date
                            } • {locale === 'en' && post.location_en ? post.location_en : post.location}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground/60 shrink-0" />
                    </div>
                  </Link>
                ))}
        {(!recentPostings || recentPostings.length === 0) && (
          <div className="p-10 text-center text-muted-foreground font-bold">
            {locale === 'en' ? 'No postings registered.' : '등록된 포스팅이 없습니다.'}
          </div>
        )}
      </div>
      <div className="p-4 bg-card text-center border-t border-border/50">
        <div className="flex justify-center gap-4">
          <Link href="/admin/meetups" className="text-sm font-bold text-primary hover:underline">
            {locale === 'en' ? 'Social' : '번개'}
          </Link>
          {isSuperAdmin && (
            <>
              <Link href="/admin/study" className="text-sm font-bold text-primary hover:underline">
                {locale === 'en' ? 'Study' : '스터디'}
              </Link>
              <Link href="/admin/language" className="text-sm font-bold text-primary hover:underline">
                {locale === 'en' ? 'Language' : '언어교환'}
              </Link>
            </>
          )}
        </div>
      </div>
    </CardContent>
  </Card>

  {isSuperAdmin && (
    <Card className="border-border shadow-sm rounded-[32px] overflow-hidden border-none">
      <CardHeader className="bg-muted/50 border-b border-border">
        <CardTitle className="text-lg md:text-xl font-black">
          {locale === 'en' ? 'Instagram Status' : '인스타그램 연동 현황'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-muted border border-border">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <Instagram className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground truncate">@langbuddy_official</p>
              <p className="text-xs font-bold text-muted-foreground">
                {locale === 'en' ? `Status: Normal (${instaCount} posts)` : `연동 상태: 정상 (${instaCount}개 게시물)`}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="rounded-lg h-8 font-bold w-full sm:w-auto">
            <Link href="/admin/instagram">{locale === 'en' ? 'Manage' : '관리'}</Link>
          </Button>
        </div>
        <p className="text-xs md:text-sm font-medium text-muted-foreground leading-relaxed">
          {locale === 'en' 
            ? "We are automatically importing Instagram posts and displaying them in the 'LANGBUDDY NEWS' section. You can manually add or hide posts as well."
            : "인스타그램 게시물을 자동으로 불러와 'LANGBUDDY NEWS' 섹션에 표시하고 있습니다. 수동으로 게시물을 추가하거나 숨길 수도 있습니다."}
        </p>
      </CardContent>
    </Card>
  )}
</div>
      </div>
    </div>
  )
}
