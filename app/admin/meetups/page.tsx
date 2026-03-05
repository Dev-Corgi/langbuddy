'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useLocale } from '@/hooks/use-locale'
import { 
  PlusCircle, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronLeft,
  Calendar,
  MapPin,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function MeetupsManagementContent() {
  const locale = useLocale()
  const [postings, setPostings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const getSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        
        let superAdminStatus = false
        // Fallback for superadmin email
        if (user.email === 'pomato5959@gmail.com') {
          superAdminStatus = true
        } else {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_superadmin')
            .eq('id', user.id)
            .single()
          superAdminStatus = !!profile?.is_superadmin
        }
        
        setIsSuperAdmin(superAdminStatus)
        fetchPostings(user.id, superAdminStatus)
      }
    }
    getSession()
  }, [])

  async function fetchPostings(userId: string, superAdmin: boolean) {
    setLoading(true)
    let query = supabase
      .from('postings')
      .select('*')
      .eq('category', '번개')
      .order('created_at', { ascending: false })
    
    // 슈퍼 관리자가 아니면 자신이 작성한 글만 필터링
    if (!superAdmin) {
      query = query.eq('created_by', userId)
    }

    const { data, error } = await query
    
    if (data) setPostings(data)
    setLoading(false)
  }

  async function deletePosting(id: string, createdBy: string | null) {
    const isOwner = !createdBy || createdBy === currentUserId || isSuperAdmin
    if (!isOwner) {
      alert(locale === 'en' ? 'You do not have permission to delete this posting.' : '삭제 권한이 없습니다.')
      return
    }
    if (!confirm('정말 삭제하시겠습니까?')) return
    const { error } = await supabase.from('postings').delete().eq('id', id)
    if (error) alert(error.message)
    else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        fetchPostings(user.id, isSuperAdmin)
      }
    }
  }

  return (
    <div className="min-h-screen bg-muted p-4 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors mb-2 text-sm">
              <ChevronLeft className="w-4 h-4" />
              {locale === 'en' ? 'Dashboard' : '대시보드'}
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
              {locale === 'en' ? 'Social Meetups' : '번개 관리'}
            </h1>
            <p className="text-muted-foreground font-medium text-sm md:text-base">
              {locale === 'en' ? 'Manage one-time social meetups.' : '일회성 번개 모임을 관리하세요.'}
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-secondary rounded-2xl h-12 px-6 font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 w-full md:w-auto transition-all active:scale-[0.98]">
            <Link href="/admin/postings/new?category=번개">
              <PlusCircle className="w-5 h-5" />
              {locale === 'en' ? 'New Meetup' : '새 번개 등록'}
            </Link>
          </Button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder={locale === 'en' ? 'Search meetups...' : '번개 검색...'}
              className="pl-12 h-12 rounded-2xl border-border bg-card focus:ring-primary transition-all"
            />
          </div>
          <Button variant="outline" className="h-12 px-6 rounded-2xl border-border bg-card font-bold gap-2 w-full md:w-auto">
            <Filter className="w-5 h-5" />
            {locale === 'en' ? 'Filter' : '필터'}
          </Button>
        </div>

        {/* Postings List */}
        <div className="space-y-3 md:space-y-4">
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="font-bold text-muted-foreground">{locale === 'en' ? 'Loading data...' : '데이터를 불러오는 중...'}</p>
            </div>
          ) : postings.length === 0 ? (
            <Card className="border-dashed border-2 border-border bg-transparent rounded-[32px]">
              <CardContent className="py-20 text-center space-y-4">
                <p className="font-bold text-muted-foreground">{locale === 'en' ? 'No meetups registered.' : '등록된 번개가 없습니다.'}</p>
                <Button asChild variant="outline" className="rounded-xl font-black">
                  <Link href="/admin/postings/new?category=번개">{locale === 'en' ? 'Create first meetup' : '첫 번개 등록하기'}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            postings.map((post) => (
              <Card key={post.id} className="border-border shadow-sm rounded-[24px] overflow-hidden bg-card hover:border-primary/30 transition-all group">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row md:items-center p-4 md:p-6 gap-4 md:gap-6">
                    <div className="w-full md:w-24 h-48 md:h-24 rounded-2xl bg-muted shrink-0 overflow-hidden relative border border-border/50">
                      {post.image_url ? (
                        <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/60">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="rounded-lg font-black text-[10px] md:text-[11px] px-2 py-0.5 bg-accent text-accent-foreground hover:bg-accent">
                          {locale === 'en' ? 'Social' : '번개'}
                        </Badge>
                        {post.status === 'expired' || (post.deadline && new Date(post.deadline) < new Date()) ? (
                          <Badge variant="outline" className="rounded-lg border-amber-500 text-amber-500 font-black text-[10px] md:text-[11px] px-2 py-0.5">
                            {locale === 'en' ? 'Expired' : '만료됨'}
                          </Badge>
                        ) : post.status === 'active' ? (
                          <Badge variant="outline" className="rounded-lg border-emerald-500 text-emerald-500 font-black text-[10px] md:text-[11px] px-2 py-0.5">
                            {locale === 'en' ? 'Published' : '게시 중'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-lg border-border text-muted-foreground font-black text-[10px] md:text-[11px] px-2 py-0.5">
                            {locale === 'en' ? 'Inactive' : '비활성'}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-xl font-black text-foreground line-clamp-1">{post.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm font-bold text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          {post.date || (locale === 'en' ? 'TBD' : '일정 미정')}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          {post.location || (locale === 'en' ? 'TBD' : '장소 미정')}
                        </div>
                      </div>
                      
                      {((post.status === 'expired') || (post.deadline && new Date(post.deadline) < new Date())) && (
                        <div className="flex items-center gap-2 pt-1 text-primary animate-pulse">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <p className="text-xs md:text-sm font-black italic">
                            {locale === 'en' 
                              ? 'This event is outdated, please fix deadline or delete it' 
                              : '만료된 번개입니다, 마감일자를 수정하거나 삭제해 주세요'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-border/50 mt-2 md:mt-0">
                      <Button asChild variant="outline" className="flex-1 md:flex-none rounded-xl font-black h-10 px-4 border-border">
                        <Link href={`/admin/postings/${post.id}`}>
                          {post.created_by && post.created_by !== currentUserId && !isSuperAdmin
                            ? (locale === 'en' ? 'View' : '조회') 
                            : (locale === 'en' ? 'Edit' : '수정')}
                        </Link>
                      </Button>
                      {(post.created_by === currentUserId || !post.created_by || isSuperAdmin) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10">
                              <MoreVertical className="w-5 h-5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl border-border shadow-xl p-1">
                            <DropdownMenuItem 
                              onClick={() => deletePosting(post.id, post.created_by)}
                              className="text-destructive font-bold focus:text-destructive focus:bg-destructive/10 rounded-lg p-3 cursor-pointer"
                            >
                              {locale === 'en' ? 'Delete' : '삭제하기'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function MeetupsManagementPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MeetupsManagementContent />
    </Suspense>
  )
}
