'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Link,
  Plus, 
  Trash2, 
  Type,
  AlignLeft,
  CircleDot,
  CheckSquare,
  List,
  X,
  Settings2,
  TextAlignStart,
  TypeOutline
} from 'lucide-react'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { useLocale } from '@/hooks/use-locale'
import { cn } from '@/lib/utils'

// Auto-resizing Textarea Component
function AutoResizeTextarea({ 
  value, 
  onChange, 
  placeholder, 
  className,
  minHeight = "min-h-[56px]"
}: { 
  value: string, 
  onChange: (val: string) => void, 
  placeholder?: string,
  className?: string,
  minHeight?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  useEffect(() => {
    adjustHeight()
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={cn(
        "flex w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all overflow-hidden resize-none",
        minHeight,
        className
      )}
    />
  )
}

export type QuestionType = 'text' | 'textarea' | 'radio' | 'checkbox' | 'select'

export interface FormQuestionData {
  id?: string
  question_text: string
  question_text_en: string
  question_type: QuestionType
  is_required: boolean
  options: string[]
  options_en: string[]
  is_new?: boolean
  system_key?: string
  show_in_qr?: boolean
}

export interface FormData {
  title: string
  title_en: string
  description: string
  description_en: string
  webhook_url: string
  questions: FormQuestionData[]
}

interface FormBuilderProps {
  initialData?: FormData
  onChange: (data: FormData) => void
  lockedSystemKeys?: string[]
  /** 언어교환/스터디: 제목은 요일·날짜 기반 자동 (관리자 입력 필드 숨김) */
  titleMode?: 'editable' | 'auto'
  autoTitles?: { title: string; title_en: string }
}

export function FormBuilder({
  initialData,
  onChange,
  lockedSystemKeys,
  titleMode = 'editable',
  autoTitles,
}: FormBuilderProps) {
  const locale = useLocale()
  
  const [title, setTitle] = useState(initialData?.title || '')
  const [title_en, setTitleEn] = useState(initialData?.title_en || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [description_en, setDescriptionEn] = useState(initialData?.description_en || '')
  const [webhook_url, setWebhookUrl] = useState(initialData?.webhook_url || '')
  const [questions, setQuestions] = useState<FormQuestionData[]>(
    initialData?.questions || [
      {
        id: crypto.randomUUID(),
        question_text: '',
        question_text_en: '',
        question_type: 'text',
        is_required: true,
        options: [''],
        options_en: [''],
        is_new: true
      }
    ]
  )

  // Update state when initialData changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '')
      setTitleEn(initialData.title_en || '')
      setDescription(initialData.description || '')
      setDescriptionEn(initialData.description_en || '')
      setWebhookUrl(initialData.webhook_url || '')
      setQuestions(initialData.questions || [])
    }
  }, [initialData?.title, initialData?.title_en, initialData?.description, initialData?.description_en, initialData?.webhook_url, initialData?.questions])

  const isAutoTitle = titleMode === 'auto' && !!autoTitles

  useEffect(() => {
    if (!isAutoTitle || !autoTitles) return
    setTitle(autoTitles.title)
    setTitleEn(autoTitles.title_en)
  }, [isAutoTitle, autoTitles?.title, autoTitles?.title_en])

  const effTitle = isAutoTitle ? autoTitles!.title : title
  const effTitleEn = isAutoTitle ? autoTitles!.title_en : title_en

  const notifyChange = (
    newTitle: string,
    newTitleEn: string,
    newDesc: string, 
    newDescEn: string, 
    newWebhookUrl: string,
    newQuestions: FormQuestionData[]
  ) => {
    onChange({
      title: newTitle,
      title_en: newTitleEn,
      description: newDesc,
      description_en: newDescEn,
      webhook_url: newWebhookUrl,
      questions: newQuestions
    })
  }

  const handleTitleChange = (val: string) => {
    if (isAutoTitle) return
    setTitle(val)
    notifyChange(val, title_en, description, description_en, webhook_url, questions)
  }

  const handleTitleEnChange = (val: string) => {
    if (isAutoTitle) return
    setTitleEn(val)
    notifyChange(title, val, description, description_en, webhook_url, questions)
  }

  const handleDescChange = (val: string) => {
    setDescription(val)
    notifyChange(effTitle, effTitleEn, val, description_en, webhook_url, questions)
  }

  const handleDescEnChange = (val: string) => {
    setDescriptionEn(val)
    notifyChange(effTitle, effTitleEn, description, val, webhook_url, questions)
  }

  const handleWebhookChange = (val: string) => {
    setWebhookUrl(val)
    notifyChange(effTitle, effTitleEn, description, description_en, val, questions)
  }

  const addQuestion = () => {
    const newQuestion: FormQuestionData = {
      id: crypto.randomUUID(),
      question_text: '',
      question_text_en: '',
      question_type: 'text',
      is_required: false,
      options: [''],
      options_en: [''],
      is_new: true
    }
    const newQuestions = [...questions, newQuestion]
    setQuestions(newQuestions)
    notifyChange(effTitle, effTitleEn, description, description_en, webhook_url, newQuestions)
  }

  const removeQuestion = (qId: string) => {
    if (questions.length === 1) return
    const newQuestions = questions.filter(q => q.id !== qId)
    setQuestions(newQuestions)
    notifyChange(effTitle, effTitleEn, description, description_en, webhook_url, newQuestions)
  }

  const updateQuestion = (qId: string, updates: Partial<FormQuestionData>) => {
    const newQuestions = questions.map(q => q.id === qId ? { ...q, ...updates } : q)
    setQuestions(newQuestions)
    notifyChange(effTitle, effTitleEn, description, description_en, webhook_url, newQuestions)
  }

  const addOption = (qId: string) => {
    const newQuestions = questions.map(q => {
      if (q.id === qId) {
        return { 
          ...q, 
          options: [...(q.options || []), ''],
          options_en: [...(q.options_en || []), '']
        }
      }
      return q
    })
    setQuestions(newQuestions)
    notifyChange(effTitle, effTitleEn, description, description_en, webhook_url, newQuestions)
  }

  const updateOption = (qId: string, optIdx: number, value: string, isEn: boolean = false) => {
    const newQuestions = questions.map(q => {
      if (q.id === qId) {
        if (isEn) {
          const newOptsEn = [...(q.options_en || [])]
          newOptsEn[optIdx] = value
          return { ...q, options_en: newOptsEn }
        } else {
          const newOpts = [...(q.options || [])]
          newOpts[optIdx] = value
          return { ...q, options: newOpts }
        }
      }
      return q
    })
    setQuestions(newQuestions)
    notifyChange(effTitle, effTitleEn, description, description_en, webhook_url, newQuestions)
  }

  const removeOption = (qId: string, optIdx: number) => {
    const newQuestions = questions.map(q => {
      if (q.id === qId && q.options.length > 1) {
        const newOpts = [...(q.options || [])]
        newOpts.splice(optIdx, 1)
        const newOptsEn = [...(q.options_en || [])]
        if (newOptsEn.length > optIdx) newOptsEn.splice(optIdx, 1)
        return { ...q, options: newOpts, options_en: newOptsEn }
      }
      return q
    })
    setQuestions(newQuestions)
    notifyChange(effTitle, effTitleEn, description, description_en, webhook_url, newQuestions)
  }

  const getQuestionIcon = (type: QuestionType) => {
    switch (type) {
      case 'text': return <Type className="w-4 h-4" />
      case 'textarea': return <AlignLeft className="w-4 h-4" />
      case 'radio': return <CircleDot className="w-4 h-4" />
      case 'checkbox': return <CheckSquare className="w-4 h-4" />
      case 'select': return <List className="w-4 h-4" />
    }
  }

  return (
    <div className="w-full space-y-6 md:space-y-10">
      {/* 폼 기본 정보 섹션 */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isAutoTitle ? (
            <div className="md:col-span-2 space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <Label className="text-sm font-bold text-primary flex items-center gap-2">
                <TypeOutline className="w-4 h-4" />
                {locale === 'en' ? 'Form title (auto)' : '폼 제목 (자동)'}
              </Label>
              <p className="text-xs font-medium text-muted-foreground">
                {locale === 'en'
                  ? 'Title is set from this week’s date for the selected weekday. It updates each time you save.'
                  : '선택한 요일의 이번 주(일~토) 날짜로 제목이 정해집니다. 저장 시 최신 날짜로 갱신됩니다.'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm font-bold">
                <div>
                  <span className="text-muted-foreground text-xs font-semibold block mb-1">KO</span>
                  {autoTitles?.title}
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-semibold block mb-1">EN</span>
                  {autoTitles?.title_en}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                  <TypeOutline className="w-4 h-4 text-primary" />
                  폼 제목 (KO)
                </Label>
                <AutoResizeTextarea
                  placeholder="폼 제목을 입력하세요"
                  value={title || ''}
                  onChange={handleTitleChange}
                  className="text-sm font-medium rounded-2xl border-border focus:ring-primary bg-muted/30"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-bold text-primary flex items-center gap-2">
                  <TypeOutline className="w-4 h-4 text-primary" />
                  Form Title (EN)
                </Label>
                <AutoResizeTextarea
                  placeholder="Enter form title in English"
                  value={title_en || ''}
                  onChange={handleTitleEnChange}
                  className="text-sm font-medium rounded-2xl border-primary/20 focus:ring-primary bg-primary/5"
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <TextAlignStart className="w-4 h-4 text-primary" />
              상세 설명 (KO)
            </Label>
            <AutoResizeTextarea
              placeholder="상세 내용을 입력하세요"
              value={description || ''}
              onChange={handleDescChange}
              minHeight="min-h-[100px]"
              className="rounded-2xl border-border focus:ring-primary bg-muted/30 text-sm font-medium"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-bold text-primary flex items-center gap-2">
              <TextAlignStart className="w-4 h-4 text-primary" />
              Description (EN)
            </Label>
            <AutoResizeTextarea
              placeholder="Enter description in English"
              value={description_en || ''}
              onChange={handleDescEnChange}
              minHeight="min-h-[100px]"
              className="rounded-2xl border-primary/20 focus:ring-primary bg-primary/5 text-sm font-medium"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <div className="space-y-4">
            <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <Link className="w-4 h-4 text-primary" />
              실시간 데이터 연동 (Webhook)
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-medium ml-1">PRO</span>
            </Label>
            <Input
              placeholder="https://hooks.zapier.com/..."
              value={webhook_url || ''}
              onChange={(e) => handleWebhookChange(e.target.value)}
              className="h-12 rounded-xl border-border bg-card focus:ring-primary text-sm"
            />
          </div>
        </div>
      </div>

      {/* 질문 구성 섹션 */}
      <div className="space-y-6 pt-10 border-t border-border">
        <div className="flex items-center gap-3 px-1 md:px-2">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          <h3 className="text-lg font-black text-foreground tracking-tight">질문 구성하기</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:gap-8">
          {questions.map((q, qIdx) => {
            const isSystemQuestion = q.system_key && lockedSystemKeys?.includes(q.system_key)
            return (
              <Card key={q.id} className={cn(
                "border shadow-sm hover:shadow-md rounded-[24px] md:rounded-[32px] overflow-hidden transition-all duration-300 group",
                isSystemQuestion 
                  ? "border-primary/30 bg-primary/5 ring-2 ring-primary/10" 
                  : "border-border bg-card"
              )}>
                <CardContent className="p-4 md:p-10 space-y-6 md:space-y-8">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/50">
                  <div className="flex items-center gap-2 md:gap-4">
                    <span className="text-primary font-black text-lg md:text-xl">Q{qIdx + 1}.</span>
                    {isSystemQuestion && (
                      <span className="px-2 py-1 text-xs font-black bg-primary text-white rounded-lg">
                        필수 기본 질문
                      </span>
                    )}
                    <Select 
                      value={q.question_type} 
                      onValueChange={(v: QuestionType) => {
                        if (isSystemQuestion) return
                        updateQuestion(q.id || '', { question_type: v })
                      }}
                    >
                      <SelectTrigger className="w-auto h-10 md:h-12 px-3 md:px-4 rounded-xl border-border bg-muted font-bold text-xs md:text-sm gap-2 focus:ring-primary">
                        {getQuestionIcon(q.question_type)}
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border shadow-2xl">
                        <SelectItem value="text" className="font-bold py-2">단답형</SelectItem>
                        <SelectItem value="textarea" className="font-bold py-2">장문형</SelectItem>
                        <SelectItem value="radio" className="font-bold py-2">객관식</SelectItem>
                        <SelectItem value="checkbox" className="font-bold py-2">체크박스</SelectItem>
                        <SelectItem value="select" className="font-bold py-2">드롭다운</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* QR 표시 체크박스 (시스템 질문은 항상 활성화) */}
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border",
                      isSystemQuestion ? "bg-primary/10 border-primary/30" : "bg-muted border-border"
                    )}>
                      <Label className="text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-tight">QR</Label>
                      <input 
                        type="checkbox"
                        checked={isSystemQuestion ? true : Boolean(q.show_in_qr)}
                        disabled={Boolean(isSystemQuestion)}
                        onChange={(e) => {
                          if (!isSystemQuestion) {
                            updateQuestion(q.id || '', { show_in_qr: e.target.checked })
                          }
                        }}
                        className="w-4 h-4 md:w-5 md:h-5 rounded border-border text-primary focus:ring-primary disabled:opacity-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    
                    {!isSystemQuestion && (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border">
                          <Label className="text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-tight">필수</Label>
                          <input 
                            type="checkbox"
                            checked={q.is_required}
                            onChange={(e) => {
                              updateQuestion(q.id || '', { is_required: e.target.checked })
                            }}
                            className="w-4 h-4 md:w-5 md:h-5 rounded border-border text-primary focus:ring-primary"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            removeQuestion(q.id || '')
                          }}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-xl"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-6 md:space-y-8">
                  {/* 질문 텍스트 입력 */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                        <Type className="w-4 h-4 text-primary" />
                        질문 내용 (KO)
                      </Label>
                      <AutoResizeTextarea
                        placeholder="질문 내용을 입력하세요"
                        value={q.question_text || ''}
                        onChange={(val) => updateQuestion(q.id || '', { question_text: val })}
                        className="text-sm font-medium rounded-xl md:rounded-2xl border-border focus:ring-primary bg-muted/30 min-h-[56px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-primary flex items-center gap-2">
                        <Type className="w-4 h-4 text-primary" />
                        Question Text (EN)
                      </Label>
                      <AutoResizeTextarea
                        placeholder="Enter question in English"
                        value={q.question_text_en || ''}
                        onChange={(val) => updateQuestion(q.id || '', { question_text_en: val })}
                        className="text-sm font-medium rounded-xl border-primary/10 focus:ring-primary bg-primary/5 min-h-[56px]"
                      />
                    </div>
                  </div>

                  {/* 옵션 설정 (객관식 등일 때) */}
                  {['radio', 'checkbox', 'select'].includes(q.question_type) && (
                    <div className="space-y-4 md:space-y-6">
                      <Label className="text-xs md:text-sm font-black text-muted-foreground flex items-center gap-2 px-1">
                        <CircleDot className="w-4 h-4" />
                        답변 옵션 구성
                      </Label>
                      <div className="space-y-3 md:space-y-4">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2 md:gap-4 bg-muted/50 p-2 md:p-4 rounded-[20px] md:rounded-3xl border border-border hover:border-primary/30 transition-all group/opt">
                            <div className="w-6 h-6 rounded-full border-2 border-border shrink-0 flex items-center justify-center font-black text-[10px] text-muted-foreground">
                              {optIdx + 1}
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                              <Input
                                placeholder={`옵션 ${optIdx + 1} (KO)`}
                                value={opt || ''}
                                onChange={(e) => updateOption(q.id || '', optIdx, e.target.value, false)}
                                className="h-10 md:h-11 border-border focus:border-primary rounded-xl text-sm font-medium bg-card"
                              />
                              <Input
                                placeholder={`Option ${optIdx + 1} (EN)`}
                                value={q.options_en?.[optIdx] || ''}
                                onChange={(e) => updateOption(q.id || '', optIdx, e.target.value, true)}
                                className="h-10 md:h-11 border-primary/10 bg-card focus:border-primary rounded-xl text-sm font-medium"
                              />
                            </div>
                            <button 
                              type="button"
                              onClick={() => removeOption(q.id || '', optIdx)}
                              className="p-2 text-muted-foreground hover:text-destructive transition-all shrink-0"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="lg" 
                          onClick={() => addOption(q.id || '')}
                          className="w-full text-primary hover:text-primary hover:bg-primary/5 font-black h-12 md:h-14 rounded-xl md:rounded-2xl border-2 border-dashed border-primary/20 text-sm md:text-base"
                        >
                          <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                          {locale === 'en' ? 'Add Option' : '옵션 추가하기'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      </div>

      <Button 
        type="button" 
        variant="outline" 
        onClick={addQuestion}
        className="w-full h-16 md:h-20 rounded-[24px] md:rounded-[32px] border-dashed border-2 border-border text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 transition-all font-black text-lg md:text-xl bg-card shadow-sm hover:shadow-md"
      >
        <Plus className="w-6 h-6 md:w-8 md:h-8 mr-3" />
        {locale === 'en' ? 'Add New Question' : '새로운 질문 추가하기'}
      </Button>
    </div>
  )
}
