'use client'

import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Globe } from 'lucide-react'

const TiptapEditor = dynamic(() => import('@/components/admin/tiptap-editor').then(mod => mod.TiptapEditor), { 
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-xl border border-border flex items-center justify-center text-muted-foreground font-bold">에디터 로딩 중...</div>
})

interface TiptapEditorCardProps {
  title: string
  value: string
  onChange: (value: string) => void
  isEnglish?: boolean
}

export function TiptapEditorCard({ title, value, onChange, isEnglish = false }: TiptapEditorCardProps) {
  return (
    <Card className={isEnglish ? "border-primary/20 shadow-xl rounded-[32px] overflow-hidden bg-surface/10" : "border-black shadow-xl rounded-[32px] overflow-hidden"}>
      <CardHeader className={isEnglish ? "bg-surface/20 border-b border-surface/30 p-8" : "bg-muted/50 border-b border-border p-8"}>
        <CardTitle className={isEnglish ? "text-lg font-black ttext-secondary-foreground flex items-center gap-2" : "text-lg font-black text-foreground flex items-center gap-2"}>
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <TiptapEditor 
          value={value} 
          onChange={onChange} 
        />
      </CardContent>
    </Card>
  )
}
