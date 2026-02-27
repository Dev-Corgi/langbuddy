'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useLocale } from '@/hooks/use-locale'
import { 
  Instagram, 
  PlusCircle, 
  Search, 
  MoreVertical, 
  ChevronLeft,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  Info,
  RefreshCw,
  Link as LinkIcon,
  Unlink,
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

export default function AdminInstagramPage() {
  const locale = useLocale()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [newPost, setNewPost] = useState({
    post_url: '',
    thumbnail_url: '',
    caption: '',
    badge_text: ''
  })
  const supabase = createClient()

  useEffect(() => {
    fetchPosts()
    fetchSettings()
  }, [])

  async function fetchSettings() {
    const { data } = await supabase
      .from('instagram_settings')
      .select('*')
      .single()
    if (data) setSettings(data)
  }

  async function fetchPosts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('instagram_posts')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setPosts(data)
    setLoading(false)
  }

  const handleConnect = async () => {
    // 실제 구현 시에는 Instagram Graph API OAuth2 프로세스가 필요합니다.
    // 여기서는 연동된 것으로 시뮬레이션합니다.
    const token = prompt('Instagram Access Token을 입력하세요 (개발자 센터 발급):')
    if (!token) return

    const { error } = await supabase
      .from('instagram_settings')
      .update({ 
        access_token: token, 
        is_connected: true,
        username: 'langbuddy_official' 
      })
      .eq('id', settings.id)
    
    if (error) alert(error.message)
    else fetchSettings()
  }

  const handleDisconnect = async () => {
    if (!confirm('Instagram 연동을 해제하시겠습니까?')) return

    const { error } = await supabase
      .from('instagram_settings')
      .update({ 
        access_token: null, 
        is_connected: false,
        username: null 
      })
      .eq('id', settings.id)
    
    if (error) alert(error.message)
    else fetchSettings()
  }

  const handleRefreshPosts = async () => {
    if (!settings?.is_connected) {
      alert('먼저 Instagram 계정을 연동해주세요.')
      return
    }

    setIsRefreshing(true)
    
    try {
      // 실제 구현: Instagram Basic Display API 호출
      // 1. settings에서 access_token 가져오기
      const response = await fetch(`https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&access_token=${settings.access_token}`)
      const json = await response.json()

      if (json.error) {
        throw new Error(json.error.message)
      }

      const mediaData = json.data.slice(0, 6) // 최신 6개

      // 2. 기존 데이터와 비교하여 업데이트 또는 삽입
      for (const item of mediaData) {
        const { data: existing } = await supabase
          .from('instagram_posts')
          .select('id')
          .eq('post_url', item.permalink)
          .single()

        const postData = {
          post_url: item.permalink,
          thumbnail_url: item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url,
          caption: item.caption,
          author_name: '@langbuddy_official',
          created_at: item.timestamp,
          is_active: true
        }

        if (existing) {
          await supabase
            .from('instagram_posts')
            .update(postData)
            .eq('id', existing.id)
        } else {
          await supabase
            .from('instagram_posts')
            .insert([postData])
        }
      }

      alert('최신 포스트를 성공적으로 가져왔습니다.')
      fetchPosts()
    } catch (err: any) {
      console.error('Instagram Sync Error:', err)
      alert(`연동 오류: ${err.message || '알 수 없는 오류가 발생했습니다.'}`)
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    const { error } = await supabase
      .from('instagram_posts')
      .insert([newPost])

    if (error) {
      alert(error.message)
    } else {
      setNewPost({ post_url: '', thumbnail_url: '', caption: '', badge_text: '' })
      fetchPosts()
    }
    setIsSubmitting(false)
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('instagram_posts')
      .update({ is_active: !currentStatus })
      .eq('id', id)
    
    if (error) alert(error.message)
    else fetchPosts()
  }

  async function deletePost(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const { error } = await supabase.from('instagram_posts').delete().eq('id', id)
    if (error) alert(error.message)
    else fetchPosts()
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
              {locale === 'en' ? 'Instagram Sync' : '인스타그램 연동'}
            </h1>
            <p className="text-muted-foreground font-medium text-sm md:text-base">
              {locale === 'en' ? 'Manage Instagram posts in LANGBUDDY NEWS section.' : 'LANGBUDDY NEWS 섹션의 인스타그램 게시물을 관리하세요.'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {settings?.is_connected ? (
              <>
                <Button 
                  onClick={handleRefreshPosts} 
                  disabled={isRefreshing}
                  className="bg-card text-foreground border border-border hover:bg-muted rounded-2xl h-12 px-6 font-black flex items-center gap-2 shadow-sm"
                >
                  {isRefreshing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  {locale === 'en' ? 'Refresh' : '새로고침'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleDisconnect}
                  className="bg-card text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive rounded-2xl h-12 px-6 font-black flex items-center gap-2"
                >
                  <Unlink className="w-5 h-5" />
                  {locale === 'en' ? 'Disconnect' : '연동 해제'}
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleConnect}
                className="bg-primary hover:bg-primary/90 rounded-2xl h-12 px-6 font-black flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                <LinkIcon className="w-5 h-5" />
                {locale === 'en' ? 'Connect Instagram Account' : 'Instagram 계정 연결'}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Connection Status Card */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-2xl",
                    settings?.is_connected ? "bg-emerald-50 text-emerald-500" : "bg-muted text-muted-foreground"
                  )}>
                    <Instagram className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black text-foreground">
                    {locale === 'en' ? 'Connection Status' : '연동 상태'}
                  </h2>
                </div>

                {settings?.is_connected ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                        <Instagram className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black text-emerald-700">{locale === 'en' ? 'Connected' : '연동 중'}</p>
                        <p className="text-xs font-bold text-emerald-600">@{settings.username}</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                      {locale === 'en' 
                        ? "Currently connected to Instagram. Click 'Refresh' to fetch the latest posts." 
                        : "현재 인스타그램 계정과 정상적으로 연결되어 있습니다. '새로고침' 버튼을 누르면 인스타그램의 최신 포스트를 가져옵니다."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-muted border border-border flex items-center gap-4 grayscale">
                      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-muted-foreground">
                        <Instagram className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black text-muted-foreground">{locale === 'en' ? 'Not Connected' : '연동되지 않음'}</p>
                        <p className="text-xs font-bold text-muted-foreground/60">{locale === 'en' ? 'Connection Required' : '연결이 필요합니다'}</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                      {locale === 'en'
                        ? "Connect your account via Instagram Graph API to automatically import posts."
                        : "Instagram Graph API를 통해 계정을 연결하면 인스타그램 게시물을 자동으로 불러올 수 있습니다."}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Manual Add Form - Only visible when not connected or as backup */}
            <Card className="border-border shadow-sm rounded-[32px] overflow-hidden border-none bg-card opacity-50 hover:opacity-100 transition-opacity">
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <PlusCircle className="w-6 h-6 text-muted-foreground" />
                  <h2 className="text-lg font-black text-foreground">
                    {locale === 'en' ? 'Manual Post Addition' : '수동 포스트 추가'}
                  </h2>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Input 
                      placeholder={locale === 'en' ? 'Post URL' : '게시물 URL'}
                      value={newPost.post_url}
                      onChange={(e) => setNewPost({ ...newPost, post_url: e.target.value })}
                      className="h-10 rounded-xl border-border bg-muted/50 font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Input 
                      placeholder={locale === 'en' ? 'Image URL' : '이미지 URL'}
                      value={newPost.thumbnail_url}
                      onChange={(e) => setNewPost({ ...newPost, thumbnail_url: e.target.value })}
                      className="h-10 rounded-xl border-border bg-muted/50 font-bold text-sm"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="outline"
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-xl font-black text-sm"
                  >
                    {locale === 'en' ? 'Add Post' : '포스트 추가'}
                  </Button>
                </form>
              </div>
            </Card>
          </div>

          {/* Posts List */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="animate-spin w-8 h-8 text-primary mx-auto mb-4" />
                <p className="font-bold text-muted-foreground">{locale === 'en' ? 'Loading data...' : '데이터 로딩 중...'}</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="py-32 text-center border-2 border-dashed border-border rounded-[32px]">
                <p className="font-bold text-muted-foreground">{locale === 'en' ? 'No posts registered.' : '등록된 인스타그램 게시물이 없습니다.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                {posts.map((post) => (
                  <Card key={post.id} className={cn(
                    "overflow-hidden border-border shadow-sm rounded-[32px] bg-card group transition-all",
                    !post.is_active && "opacity-60 grayscale"
                  )}>
                    <div className="relative aspect-square sm:aspect-video">
                      <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="icon" variant="secondary" className="rounded-full w-10 h-10" asChild>
                          <a href={post.post_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        </Button>
                      </div>
                      {post.badge_text && (
                        <div className="absolute left-4 top-4 rounded-md bg-primary px-2.5 py-1 text-[10px] font-black text-primary-foreground">
                          {post.badge_text}
                        </div>
                      )}
                    </div>
                    <div className="p-4 md:p-5 flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-sm font-black text-foreground line-clamp-2 leading-snug">{post.caption}</p>
                        <p className="text-[11px] font-bold text-muted-foreground">{post.author_name}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 shrink-0">
                            <MoreVertical className="w-5 h-5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-border shadow-xl p-1">
                          <DropdownMenuItem onClick={() => toggleStatus(post.id, post.is_active)} className="font-bold rounded-lg p-3 cursor-pointer">
                            {post.is_active ? (
                              <><EyeOff className="w-4 h-4 mr-2" /> {locale === 'en' ? 'Hide' : '숨기기'}</>
                            ) : (
                              <><Eye className="w-4 h-4 mr-2" /> {locale === 'en' ? 'Show' : '노출하기'}</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deletePost(post.id)} className="text-destructive font-bold focus:text-destructive focus:bg-destructive/10 rounded-lg p-3 cursor-pointer">
                            <Trash2 className="w-4 h-4 mr-2" /> {locale === 'en' ? 'Delete' : '삭제하기'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
