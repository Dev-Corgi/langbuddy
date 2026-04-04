'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, Users, LayoutGrid, Play, Save, RotateCcw, 
  UserPlus, AlertTriangle, ChevronLeft, CheckCircle2,
  MoreHorizontal, GripVertical, Copy, Settings
} from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import _ from 'lodash'

// --- Types ---

type Participant = {
  id: string
  name: string
  gender: '남' | '여' | string
  nationality: '한국인' | '외국인' | string
  language: string
  checked_in_at: string | null
}

type Assignment = {
  participant_id: string
  table_label: string
}

type RoundData = {
  round: number
  assignments: Assignment[]
}

type SeatingConfig = {
  tableCount: number
  koreanPerTable: number
  foreignerPerTable: number
}

// --- Components ---

function ParticipantCard({ participant, isOverlay = false }: { participant: Participant, isOverlay?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: participant.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-3 mb-2 rounded-xl border bg-card shadow-sm group",
        isOverlay ? "shadow-xl border-primary" : "border-border"
      )}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded text-muted-foreground">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{participant.name}</p>
          <div className="flex gap-1 mt-0.5">
            <span className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
              participant.nationality === '외국인' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
            )}>
              {participant.nationality === '외국인' ? 'INTL' : 'KOR'}
            </span>
            <span className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
              participant.gender === '여' ? "bg-pink-100 text-pink-600" : "bg-slate-100 text-slate-600"
            )}>
              {participant.gender}
            </span>
          </div>
        </div>
      </div>
      <div className="text-[10px] font-black text-primary uppercase bg-primary/5 px-2 py-1 rounded">
        {participant.language}
      </div>
    </div>
  )
}

function TableContainer({ label, participants, round }: { label: string, participants: Participant[], round: number }) {
  const { setNodeRef } = useSortable({
    id: `table-${label}-${round}`,
    data: {
      type: 'container',
      tableLabel: label,
      round: round
    }
  })

  // F-08: Constraint checks
  const hasKorean = participants.some(p => p.nationality === '한국인')
  const hasForeigner = participants.some(p => p.nationality === '외국인')
  const hasMale = participants.some(p => p.gender === '남')
  const hasFemale = participants.some(p => p.gender === '여')

  const warnings = []
  if (!hasKorean) warnings.push('한국인 없음')
  if (!hasForeigner) warnings.push('외국인 없음')
  if (!hasMale) warnings.push('남성 없음')
  if (!hasFemale) warnings.push('여성 없음')

  return (
    <Card className="border-none shadow-md bg-muted/20 rounded-[24px] overflow-hidden flex flex-col h-full">
      <CardHeader className="p-4 bg-card border-b flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between w-full">
          <CardTitle className="text-lg font-black">{label} Table</CardTitle>
          <span className="text-xs font-bold text-muted-foreground">{participants.length} 명</span>
        </div>
        
        {warnings.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {warnings.map(w => (
              <span key={w} className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                {w}
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent ref={setNodeRef} className="p-3 flex-1 min-h-[100px]">
        <SortableContext 
          items={participants.map(p => p.id)} 
          strategy={verticalListSortingStrategy}
        >
          {participants.map(p => (
            <ParticipantCard key={p.id} participant={p} />
          ))}
        </SortableContext>
      </CardContent>
    </Card>
  )
}

function UnassignedList({ participants, round }: { participants: Participant[], round: number }) {
  const { setNodeRef } = useSortable({
    id: `unassigned-${round}`,
    data: {
      type: 'container',
      tableLabel: 'unassigned',
      round: round
    }
  })

  return (
    <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-amber-500" />
          미배정 인원
        </CardTitle>
      </CardHeader>
      <CardContent ref={setNodeRef} className="max-h-[400px] overflow-y-auto p-3 min-h-[100px]">
        <SortableContext 
          items={participants.map(p => p.id)} 
          strategy={verticalListSortingStrategy}
        >
          {participants.map(p => (
            <ParticipantCard key={p.id} participant={p} />
          ))}
        </SortableContext>
        {participants.length === 0 && (
          <p className="text-center py-4 text-xs font-bold text-muted-foreground">모두 배정되었습니다.</p>
        )}
      </CardContent>
    </Card>
  )
}

// --- Main Page ---

export default function AdminArrangePage() {
  const locale = useLocale()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [session, setTodaySession] = useState<any>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [rounds, setRounds] = useState<RoundData[]>([
    { round: 1, assignments: [] },
    { round: 2, assignments: [] },
    { round: 3, assignments: [] }
  ])
  const [currentRound, setCurrentRound] = useState(1)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [langTableCounts, setLangTableCounts] = useState<Record<string, number>>({})
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    fetchData()

    // Subscribe to check-ins
    const channel = supabase
      .channel('checkin-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'form_responses'
        },
        (payload) => {
          setParticipants(prev => prev.map(p => 
            p.id === payload.new.id 
              ? { ...p, checked_in_at: payload.new.checked_in_at } 
              : p
          ))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/admin/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_superadmin && user.email !== 'pomato5959@gmail.com') {
        window.location.href = '/admin/dashboard'
        return
      }

      // Fetch today's session
      const now = new Date().toISOString().split('T')[0]
      const { data: sessions } = await supabase
        .from('postings')
        .select('*')
        .eq('category', '언어교환')
        .eq('status', 'active')
        .gte('date', now)
        .order('date', { ascending: true })
        .limit(1)

      if (!sessions || sessions.length === 0) {
        setTodaySession(null)
        setLoading(false)
        return
      }

      const foundSession = sessions[0]
      setTodaySession(foundSession)
      
      // Load saved table config if exists
      if (foundSession.seating_config?.langTableCounts) {
        setLangTableCounts(foundSession.seating_config.langTableCounts)
      }

      // Fetch participants (applications)
      const { data: responses } = await supabase
        .from('form_responses')
        .select('*')
        .eq('form_id', foundSession.form_id)

      if (responses) {
        const mapped: Participant[] = responses.map(r => ({
          id: r.id,
          name: r.answers?.name || r.answers?.이름 || 'Anonymous',
          gender: r.answers?.gender || r.answers?.성별 || '?',
          nationality: r.answers?.nationality || r.answers?.국적 || '?',
          language: r.answers?._selected_language || '-',
          checked_in_at: r.checked_in_at
        }))
        setParticipants(mapped)
        
        // Auto-calculate table counts if not set
        const languageGroups = _.groupBy(mapped.filter(p => p.checked_in_at), 'language')
        const initialCounts: Record<string, number> = { ...langTableCounts }
        let hasChanges = false

        Object.entries(languageGroups).forEach(([lang, members]) => {
          if (!initialCounts[lang]) {
            initialCounts[lang] = Math.ceil(members.length / 5)
            hasChanges = true
          }
        })

        if (hasChanges) {
          setLangTableCounts(initialCounts)
        }
      }

      // Fetch existing assignments if any
      const { data: existingAssignments } = await supabase
        .from('seating_assignments')
        .select('*')
        .eq('posting_id', foundSession.id)

      if (existingAssignments && existingAssignments.length > 0) {
        const newRounds = [1, 2, 3].map(r => ({
          round: r,
          assignments: existingAssignments
            .filter(a => a.round === r)
            .map(a => ({ participant_id: a.participant_id, table_label: a.table_label }))
        }))
        setRounds(newRounds)
      }

      setLoading(false)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const checkedInParticipants = useMemo(() => 
    participants.filter(p => p.checked_in_at), 
  [participants])

  // --- Seating Algorithm ---

  const handleAutoAssignLatecomer = (participantId: string) => {
    const latecomer = participants.find(p => p.id === participantId)
    if (!latecomer || !latecomer.checked_in_at) return

    setRounds(prev => {
      const newRounds = [...prev]
      
      // Assign to each round (starting from currentRound)
      for (let r = currentRound; r <= 3; r++) {
        const roundIdx = newRounds.findIndex(rd => rd.round === r)
        const currentAssignments = [...(newRounds[roundIdx].assignments || [])]
        
        // Skip if already assigned in this round
        if (currentAssignments.some(a => a.participant_id === participantId)) continue

        // F-07: Find table with empty slots (if defined) or just least overlap
        // Since we assume tables aren't strictly capped in "simple" mode, we find table with least overlap
        const tableGroups = _.groupBy(currentAssignments, 'table_label')
        const tableLabels = Object.keys(tableGroups).sort()
        
        if (tableLabels.length === 0) continue

        let bestTable = tableLabels[0]
        let minOverlap = Infinity

        tableLabels.forEach(label => {
          const members = tableGroups[label]
          let overlap = 0
          
          // Check overlap with existing members in this table across ALL rounds
          members.forEach(m => {
            for (let prevR = 1; prevR <= 3; prevR++) {
              const rd = newRounds.find(nr => nr.round === prevR)
              if (!rd) continue
              const isTogether = rd.assignments.some(a => 
                (a.participant_id === participantId && rd.assignments.some(a2 => a2.participant_id === m.participant_id && a2.table_label === a.table_label)) ||
                (a.participant_id === m.participant_id && rd.assignments.some(a2 => a2.participant_id === participantId && a2.table_label === a.table_label))
              )
              if (isTogether) overlap++
            }
          })

          if (overlap < minOverlap) {
            minOverlap = overlap
            bestTable = label
          }
        })

        currentAssignments.push({ participant_id: participantId, table_label: bestTable })
        newRounds[roundIdx] = { ...newRounds[roundIdx], assignments: currentAssignments }
      }
      
      return newRounds
    })
    
    toast.success(`${latecomer.name}님을 남은 라운드에 자동 배정했습니다.`)
  }

  const runAutoArrange = () => {
    const attendees = checkedInParticipants
    if (attendees.length === 0) {
      toast.error('출석한 참가자가 없습니다.')
      return
    }

    // Group participants by language
    const languageGroups = _.groupBy(attendees, 'language')
    const languages = Object.keys(languageGroups).sort()
    
    const newRounds: RoundData[] = [
      { round: 1, assignments: [] },
      { round: 2, assignments: [] },
      { round: 3, assignments: [] }
    ]

    let totalTableIdx = 0
    
    languages.forEach(lang => {
      const members = languageGroups[lang]
      const koreans = members.filter(p => p.nationality === '한국인')
      const foreigners = members.filter(p => p.nationality === '외국인')
      
      // F-04: Use manual table count if defined, else auto-calculate
      const langTableCount = langTableCounts[lang] || Math.ceil(members.length / 5)
      const langTableLabels = Array.from({ length: langTableCount }, (_, i) => 
        String.fromCharCode(65 + totalTableIdx + i)
      )
      
      totalTableIdx += langTableCount

      // Optimize for this language group
      let bestLangRounds: Assignment[][] = [[], [], []]
      let minPenalty = Infinity

      for (let attempt = 0; attempt < 50; attempt++) {
        const currentAttemptAssignments: Assignment[][] = [[], [], []]
        
        for (let r = 0; r < 3; r++) {
          const shuffledK = _.shuffle([...koreans])
          const shuffledF = _.shuffle([...foreigners])
          
          shuffledK.forEach((p, idx) => {
            currentAttemptAssignments[r].push({ 
              participant_id: p.id, 
              table_label: langTableLabels[idx % langTableCount] 
            })
          })
          
          shuffledF.forEach((p, idx) => {
            currentAttemptAssignments[r].push({ 
              participant_id: p.id, 
              table_label: langTableLabels[idx % langTableCount] 
            })
          })
        }

        // Calculate penalty for this language group
        let penalty = 0
        const seenPairs: Map<string, number> = new Map()
        
        currentAttemptAssignments.forEach(roundAssignments => {
          const tableGroups = _.groupBy(roundAssignments, 'table_label')
          Object.values(tableGroups).forEach(group => {
            for (let i = 0; i < group.length; i++) {
              for (let j = i + 1; j < group.length; j++) {
                const pair = [group[i].participant_id, group[j].participant_id].sort().join('-')
                const count = seenPairs.get(pair) || 0
                if (count > 0) penalty += count
                seenPairs.set(pair, count + 1)
              }
            }
          })
        })

        if (penalty < minPenalty) {
          minPenalty = penalty
          bestLangRounds = currentAttemptAssignments
        }
        if (penalty === 0) break
      }

      // Add to main rounds
      for (let r = 0; r < 3; r++) {
        newRounds[r].assignments.push(...bestLangRounds[r])
      }
    })

    setRounds(newRounds)
    toast.success('언어별 자동 배치가 완료되었습니다.')
  }

  const handleSave = async () => {
    if (!session) return
    
    setLoading(true)
    try {
      // 1. Save table config to session
      await supabase
        .from('postings')
        .update({ seating_config: { langTableCounts } })
        .eq('id', session.id)

      // 2. Delete existing assignments for this session
      await supabase
        .from('seating_assignments')
        .delete()
        .eq('posting_id', session.id)

      // 3. Insert new assignments
      const allAssignments = rounds.flatMap(r => 
        r.assignments.map(a => ({
          posting_id: session.id,
          round: r.round,
          table_label: a.table_label,
          participant_id: a.participant_id
        }))
      )

      if (allAssignments.length > 0) {
        const { error } = await supabase
          .from('seating_assignments')
          .insert(allAssignments)

        if (error) throw error
      }
      
      toast.success('배치 결과 및 설정이 저장되었습니다.')
    } catch (err) {
      console.error(err)
      toast.error('저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // --- DnD Handlers ---

  const onDragStart = (event: any) => {
    setActiveId(event.active.id)
  }

  const onDragOver = (event: any) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) return

    const isOverTable = over.data?.current?.type === 'container'
    
    setRounds(prev => {
      const newRounds = [...prev]
      const roundIdx = newRounds.findIndex(r => r.round === currentRound)
      const currentAssignments = [...(newRounds[roundIdx].assignments || [])]
      
      const activeIdx = currentAssignments.findIndex(a => a.participant_id === activeId)
      
      if (isOverTable) {
        const newTableLabel = over.data.current.tableLabel
        
        if (newTableLabel === 'unassigned') {
          // Move from table to unassigned (Remove from assignments)
          if (activeIdx !== -1) {
            currentAssignments.splice(activeIdx, 1)
          }
        } else {
          // Move to a table
          if (activeIdx !== -1) {
            // Already assigned, just change table
            currentAssignments[activeIdx] = { ...currentAssignments[activeIdx], table_label: newTableLabel }
          } else {
            // New assignment from unassigned list
            currentAssignments.push({ participant_id: activeId, table_label: newTableLabel })
          }
        }
      } else {
        // Over another participant card
        const overParticipantIdx = currentAssignments.findIndex(a => a.participant_id === overId)
        
        if (overParticipantIdx !== -1) {
          const newTableLabel = currentAssignments[overParticipantIdx].table_label
          if (activeIdx !== -1) {
            currentAssignments[activeIdx] = { ...currentAssignments[activeIdx], table_label: newTableLabel }
          } else {
            currentAssignments.push({ participant_id: activeId, table_label: newTableLabel })
          }
        } else {
          // If overId is a participant in the unassigned list
          const isOverUnassigned = participants.find(p => p.id === overId && !currentAssignments.some(a => a.participant_id === p.id))
          if (isOverUnassigned && activeIdx !== -1) {
            // Move from table to unassigned
            currentAssignments.splice(activeIdx, 1)
          }
        }
      }

      newRounds[roundIdx] = { ...newRounds[roundIdx], assignments: currentAssignments }
      return newRounds
    })
  }

  const onDragEnd = (event: any) => {
    setActiveId(null)
  }

  const handleCopyResults = () => {
    const currentAssignments = rounds.find(r => r.round === currentRound)?.assignments || []
    if (currentAssignments.length === 0) return

    const tableGroups = _.groupBy(currentAssignments, 'table_label')
    let text = `[LangBuddy ${currentRound}라운드 배치 결과]\n\n`
    
    Object.keys(tableGroups).sort().forEach(label => {
      const members = tableGroups[label]
        .map(a => {
          const p = participants.find(p => p.id === a.participant_id)
          return p ? `${p.name}(${p.language})` : ''
        })
        .filter(Boolean)
        .join(', ')
      text += `${label} 테이블: ${members}\n`
    })

    navigator.clipboard.writeText(text)
    toast.success('배치 결과가 복사되었습니다.')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-2xl font-black mb-4">진행 중인 세션이 없습니다.</h1>
        <Button asChild className="rounded-xl font-bold">
          <Link href="/admin/dashboard">돌아가기</Link>
        </Button>
      </div>
    )
  }

  const currentRoundAssignments = rounds.find(r => r.round === currentRound)?.assignments || []
  const tableLabels = Array.from(new Set(currentRoundAssignments.map(a => a.table_label))).sort()
  const activeParticipant = participants.find(p => p.id === activeId)

  return (
    <div className="p-4 md:p-8 bg-muted/30 min-h-screen space-y-8 pb-32">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <Link 
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            대시보드
          </Link>
          <div className="flex items-center gap-3">
            <LayoutGrid className="w-8 h-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">오늘의 자리 배치</h1>
          </div>
          <p className="text-muted-foreground font-medium">{session.title} • {session.date}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className={cn("rounded-xl font-bold gap-2", isConfigOpen && "bg-muted")}
          >
            <Settings className="w-4 h-4" />
            테이블 설정
          </Button>
          <Button onClick={runAutoArrange} className="rounded-xl font-black gap-2 bg-primary hover:bg-secondary">
            <Play className="w-4 h-4 fill-current" />
            자동 배치 실행
          </Button>
          <Button onClick={handleSave} variant="outline" className="rounded-xl font-black gap-2">
            <Save className="w-4 h-4" />
            저장하기
          </Button>
        </div>
      </header>

      {isConfigOpen && (
        <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card animate-in slide-in-from-top-4 duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              언어별 테이블 수 설정
            </CardTitle>
            <CardDescription className="font-medium">
              각 언어 그룹별로 사용할 물리 테이블의 수를 직접 설정할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {Object.entries(_.groupBy(checkedInParticipants, 'language')).sort().map(([lang, members]) => (
                <div key={lang} className="space-y-2 p-4 rounded-2xl bg-muted/50 border border-border">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-black text-foreground uppercase tracking-tight">{lang}</span>
                    <span className="text-[10px] font-bold text-muted-foreground">{members.length}명</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      min="1"
                      value={langTableCounts[lang] || Math.ceil(members.length / 5)} 
                      onChange={(e) => setLangTableCounts(prev => ({ 
                        ...prev, 
                        [lang]: parseInt(e.target.value) || 1 
                      }))}
                      className="h-9 rounded-xl text-center font-black text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">테이블</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
          {/* Statistics & Participants Sidebar */}
          <aside className="space-y-6">
            <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  출석 현황
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 p-3 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">전체 신청</p>
                    <p className="text-xl font-black">{participants.length}</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">출석 확인</p>
                    <p className="text-xl font-black text-emerald-600">{checkedInParticipants.length}</p>
                  </div>
                </div>
                
                <div className="h-px bg-muted" />
                
                <div className="space-y-2">
                  <p className="text-xs font-black text-muted-foreground uppercase">언어별 출석</p>
                  {Object.entries(_.groupBy(checkedInParticipants, 'language')).map(([lang, members]) => (
                    <div key={lang} className="flex justify-between items-center text-sm font-bold">
                      <span>{lang}</span>
                      <span className="text-primary">{members.length}명</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <UnassignedList 
              participants={participants.filter(p => p.checked_in_at && !currentRoundAssignments.some(a => a.participant_id === p.id))} 
              round={currentRound}
            />
          </aside>

          {/* Main Seating Area */}
          <main className="space-y-6">
            <Tabs value={currentRound.toString()} onValueChange={(v) => setCurrentRound(parseInt(v))} className="w-full">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="bg-muted p-1 rounded-2xl h-14">
                  {[1, 2, 3].map(r => (
                    <TabsTrigger 
                      key={r} 
                      value={r.toString()}
                      className="rounded-xl px-8 h-full data-[state=active]:bg-card data-[state=active]:shadow-md font-black text-lg"
                    >
                      {r} Round
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-xl text-muted-foreground hover:text-primary"
                    onClick={fetchData}
                  >
                    <RotateCcw className={cn("w-5 h-5", loading && "animate-spin")} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl font-bold gap-2"
                    onClick={handleCopyResults}
                  >
                    <Copy className="w-4 h-4" />
                    결과 복사
                  </Button>
                </div>
              </div>

              {[1, 2, 3].map(r => (
                <TabsContent key={r} value={r.toString()} className="mt-0 focus-visible:outline-none">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {tableLabels.map(label => {
                      const tableParticipants = currentRoundAssignments
                        .filter(a => a.table_label === label)
                        .map(a => participants.find(p => p.id === a.participant_id))
                        .filter(Boolean) as Participant[]
                      
                      return (
                        <TableContainer 
                          key={label} 
                          label={label} 
                          participants={tableParticipants}
                          round={r}
                        />
                      )
                    })}
                    {tableLabels.length === 0 && (
                      <div className="col-span-full py-32 text-center border-2 border-dashed border-border rounded-[40px] bg-card/50">
                        <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-xl font-black text-muted-foreground">배치 결과가 없습니다.</p>
                        <p className="text-muted-foreground font-medium mt-2">'자동 배치 실행' 버튼을 눌러주세요.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </main>
        </div>

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeId && activeParticipant ? (
            <ParticipantCard participant={activeParticipant} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
