'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { 
  Image as ImageIcon,
  PlusCircle, 
  MoreVertical, 
  ChevronLeft,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  MoveUp,
  MoveDown
} from 'lucide-react'
import { ImageUploadField } from '@/components/admin/image-upload-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from '@/lib/utils'

export default function AdminCarouselPage() {
  const [slides, setSlides] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newSlide, setNewPost] = useState({
    title: '',
    title_en: '',
    subtitle: '',
    subtitle_en: '',
    description: '',
    description_en: '',
    image_url: '',
    mobile_image_url: '',
    thumbnail_url: '',
    link_url: '',
    period: '',
    location: ''
  })
  const supabase = createClient()

  useEffect(() => {
    fetchSlides()
  }, [])

  async function fetchSlides() {
    setLoading(true)
    const { data, error } = await supabase
      .from('carousels')
      .select('*')
      .order('display_order', { ascending: true })
    
    if (data) setSlides(data)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    const { error } = await supabase
      .from('carousels')
      .insert([{ ...newSlide, display_order: slides.length }])

    if (error) {
      alert(error.message)
    } else {
      setNewPost({ 
        title: '', 
        title_en: '',
        subtitle: '', 
        subtitle_en: '',
        description: '', 
        description_en: '',
        image_url: '', 
        mobile_image_url: '', 
        thumbnail_url: '', 
        link_url: '',
        period: '',
        location: ''
      })
      fetchSlides()
    }
    setIsSubmitting(false)
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('carousels')
      .update({ is_active: !currentStatus })
      .eq('id', id)
    
    if (error) alert(error.message)
    else fetchSlides()
  }

  async function deleteSlide(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const { error } = await supabase.from('carousels').delete().eq('id', id)
    if (error) alert(error.message)
    else fetchSlides()
  }

  async function updateOrder(id: string, currentOrder: number, direction: 'up' | 'down') {
    const newOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1
    if (newOrder < 0 || newOrder >= slides.length) return

    const otherSlide = slides.find(s => s.display_order === newOrder)
    if (!otherSlide) return

    const { error: err1 } = await supabase
      .from('carousels')
      .update({ display_order: newOrder })
      .eq('id', id)
    
    const { error: err2 } = await supabase
      .from('carousels')
      .update({ display_order: currentOrder })
      .eq('id', otherSlide.id)

    if (err1 || err2) alert('순서 변경 실패')
    else fetchSlides()
  }

  return (
    <div className="min-h-screen bg-muted p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Link href="/admin/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors mb-2 text-sm">
              <ChevronLeft className="w-4 h-4" />
              대시보드
            </Link>
            <h1 className="text-3xl font-black text-foreground tracking-tight">메인 캐러셀 관리</h1>
            <p className="text-muted-foreground font-medium">홈 화면 최상단 배너와 이미지를 관리하세요.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
          {/* Add New Slide Form */}
          <div className="space-y-6">
            <Card className="border-black shadow-xl rounded-[32px] overflow-hidden bg-card">
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                    <PlusCircle className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black text-foreground">새 슬라이드 추가</h2>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-muted-foreground ml-1">제목 (KO)</label>
                      <Input 
                        placeholder="슬라이드 제목" 
                        value={newSlide.title}
                        onChange={(e) => setNewPost({ ...newSlide, title: e.target.value })}
                        className="h-12 rounded-xl border-border bg-muted/50 focus:bg-card transition-all font-bold"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-primary ml-1">Title (EN)</label>
                      <Input 
                        placeholder="Slide Title" 
                        value={newSlide.title_en}
                        onChange={(e) => setNewPost({ ...newSlide, title_en: e.target.value })}
                        className="h-12 rounded-xl border-primary/30 bg-primary/5 focus:bg-card transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-muted-foreground ml-1">부제목 (KO)</label>
                      <Input 
                        placeholder="슬라이드 부제목" 
                        value={newSlide.subtitle}
                        onChange={(e) => setNewPost({ ...newSlide, subtitle: e.target.value })}
                        className="h-12 rounded-xl border-border bg-muted/50 focus:bg-card transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-primary ml-1">Subtitle (EN)</label>
                      <Input 
                        placeholder="Slide Subtitle" 
                        value={newSlide.subtitle_en}
                        onChange={(e) => setNewPost({ ...newSlide, subtitle_en: e.target.value })}
                        className="h-12 rounded-xl border-primary/30 bg-primary/5 focus:bg-card transition-all font-bold"
                      />
                    </div>
                  </div>
                  <ImageUploadField
                    label="데스크탑 이미지"
                    labelEn="Desktop Image"
                    currentImageUrl={newSlide.image_url}
                    onImageUrlChange={(url) => setNewPost({ ...newSlide, image_url: url })}
                    bucketName="images"
                    folder="carousel"
                  />
                  <ImageUploadField
                    label="모바일 이미지"
                    labelEn="Mobile Image"
                    currentImageUrl={newSlide.mobile_image_url}
                    onImageUrlChange={(url) => setNewPost({ ...newSlide, mobile_image_url: url })}
                    bucketName="images"
                    folder="carousel"
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground ml-1">링크 URL</label>
                    <Input 
                      placeholder="/posting/..." 
                      value={newSlide.link_url}
                      onChange={(e) => setNewPost({ ...newSlide, link_url: e.target.value })}
                      className="h-12 rounded-xl border-border bg-muted/50 focus:bg-card transition-all font-bold"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-black text-lg shadow-lg shadow-primary/20 mt-4"
                  >
                    {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : '추가하기'}
                  </Button>
                </form>
              </div>
            </Card>
          </div>

          {/* Slides List */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="animate-spin w-8 h-8 text-primary mx-auto mb-4" />
                <p className="font-bold text-muted-foreground">데이터 로딩 중...</p>
              </div>
            ) : slides.length === 0 ? (
              <div className="py-32 text-center border-2 border-dashed border-border rounded-[32px]">
                <p className="font-bold text-muted-foreground">등록된 슬라이드가 없습니다.</p>
              </div>
            ) : (
              slides.map((slide, index) => (
                <Card key={slide.id} className={cn(
                  "overflow-hidden border-border shadow-sm rounded-[32px] bg-card group transition-all",
                  !slide.is_active && "opacity-60 grayscale"
                )}>
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row sm:items-center p-4 md:p-6 gap-4 md:gap-6">
                      <div className="w-full sm:w-40 md:w-48 aspect-video sm:aspect-4/3 md:aspect-video rounded-2xl bg-muted shrink-0 overflow-hidden relative border border-border/50">
                        {slide.image_url ? (
                          <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/60">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white text-xs font-black">
                          {index + 1}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          {slide.is_active ? (
                            <Badge className="bg-emerald-100 text-emerald-600 hover:bg-emerald-100 rounded-lg font-black text-[10px] md:text-[11px] px-2 py-0.5">활성화</Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground hover:bg-muted rounded-lg font-black text-[10px] md:text-[11px] px-2 py-0.5">비활성</Badge>
                          )}
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-foreground line-clamp-1">{slide.title}</h3>
                        {slide.title_en && <p className="text-xs font-bold text-primary line-clamp-1">{slide.title_en}</p>}
                        <p className="text-sm font-bold text-muted-foreground line-clamp-1">{slide.subtitle || '부제목 없음'}</p>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 mt-2 sm:mt-0">
                        <div className="flex items-center gap-1.5 mr-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="rounded-xl h-9 w-9 border-border"
                            onClick={() => updateOrder(slide.id, slide.display_order, 'up')}
                            disabled={index === 0}
                          >
                            <MoveUp className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="rounded-xl h-9 w-9 border-border"
                            onClick={() => updateOrder(slide.id, slide.display_order, 'down')}
                            disabled={index === slides.length - 1}
                          >
                            <MoveDown className="w-4 h-4" />
                          </Button>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                              <MoreVertical className="w-5 h-5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl border-border shadow-xl p-1">
                            <DropdownMenuItem onClick={() => toggleStatus(slide.id, slide.is_active)} className="font-bold rounded-lg p-3 cursor-pointer">
                              {slide.is_active ? <><EyeOff className="w-4 h-4 mr-2" /> 숨기기</> : <><Eye className="w-4 h-4 mr-2" /> 노출하기</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteSlide(slide.id)} className="text-destructive font-bold focus:text-destructive focus:bg-destructive/10 rounded-lg p-3 cursor-pointer">
                              <Trash2 className="w-4 h-4 mr-2" /> 삭제하기
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
