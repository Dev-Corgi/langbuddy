'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  Users,
  LayoutGrid,
  Save,
  RotateCcw,
  UserPlus,
  AlertTriangle,
  ChevronLeft,
  GripVertical,
  Copy,
  Settings,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn, extractParticipantInfoFromAnswers, type CoreFormQuestion } from '@/lib/utils'
import { koreanWeekdayLetterSeoul, todayYYYYMMDDSeoul } from '@/lib/session-event-date'
import { deriveArrangeStage, targetRoundForLateJoin } from '@/lib/arrange-stage'
import { ParticipantAdder } from '@/components/admin/ParticipantAdder'
import { ParticipantEditor } from '@/components/admin/ParticipantEditor'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import _ from 'lodash'
import { arrangeRound as runSeatingArrangeRound, calculateAutoTableCounts, getTableWarnings } from '@/lib/seating-algorithm'
import type { Assignment, RoundData } from '@/lib/seating-algorithm'
import { formatDebugLog, generateDebugLog } from '@/lib/seating-debug-logger'
import { RoundImageExporter } from '@/components/admin/round-image-exporter'

// --- Types ---

type Participant = {
  id: string
  name: string
  gender: '남' | '여' | string
  nationality: '한국인' | '외국인' | string
  language: string
  checked_in_at: string | null
}

type ArrangePostingSession = {
  id: string
  title: string
  date: string
  form_id?: string | null
  day_of_week?: string | null
  seating_config?: { langTableCounts?: Record<string, number> } | null
}

type LoadedSeatingRow = {
  round: number
  participant_id: string
  table_label: string
}

function inferTableLanguages(assignments: Assignment[], participantsList: Participant[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const a of assignments) {
    if (map[a.table_label]) continue
    const p = participantsList.find((x) => x.id === a.participant_id)
    if (p) map[a.table_label] = p.language
  }
  return map
}

// --- Components ---

function ParticipantCard({ participant, isOverlay = false, onEdit }: { participant: Participant, isOverlay?: boolean, onEdit?: (participant: Participant) => void }) {
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

  const isForeigner = participant.nationality === '외국인'
  const isFemale = participant.gender === '여'
  const checkedIn = Boolean(participant.checked_in_at)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'flex items-center justify-between p-3 mb-2 rounded-xl border bg-card shadow-sm group cursor-grab active:cursor-grabbing overflow-hidden relative',
        isOverlay ? 'shadow-xl border-primary' : 'border-border',
        isForeigner ? 'bg-blue-50/40' : 'bg-emerald-50/40'
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1.5', isForeigner ? 'bg-blue-500' : 'bg-emerald-500')} />

      <div className="flex items-center gap-3 overflow-hidden flex-1 pl-2">
        <div className="p-1 text-muted-foreground pointer-events-none">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate">{participant.name}</p>
          <div className="flex gap-1 mt-0.5 items-center flex-wrap">
            <span
              className={cn(
                'text-[10px] font-black px-1.5 py-0.5 rounded tracking-tighter',
                isForeigner ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
              )}
            >
              {participant.nationality}
            </span>
            <span
              className={cn(
                'text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter',
                isFemale ? 'bg-pink-100 text-pink-600' : 'bg-sky-100 text-sky-700'
              )}
            >
              {participant.gender}
            </span>
            <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              {participant.language === '영어' ? (
                <svg className="w-3 h-3" viewBox="0 0 20 14" fill="none">
                  <rect width="20" height="14" fill="#B22234" />
                  <rect y="1.08" width="20" height="1.08" fill="white" />
                  <rect y="3.23" width="20" height="1.08" fill="white" />
                  <rect y="5.38" width="20" height="1.08" fill="white" />
                  <rect y="7.54" width="20" height="1.08" fill="white" />
                  <rect y="9.69" width="20" height="1.08" fill="white" />
                  <rect y="11.85" width="20" height="1.08" fill="white" />
                  <rect width="8" height="7.54" fill="#3C3B6E" />
                </svg>
              ) : participant.language === '일본어' ? (
                <svg className="w-3 h-3" viewBox="0 0 20 14" fill="none">
                  <rect width="20" height="14" fill="white" />
                  <circle cx="10" cy="7" r="3.5" fill="#BC002D" />
                </svg>
              ) : (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              )}
              {participant.language}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
        {!checkedIn ? (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
            미체크인
          </span>
        ) : null}
        {onEdit && !isOverlay ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md shrink-0 relative z-50 pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onEdit(participant)
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
            }}
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** QR 미스캔·드래그 불가 (자리배치 대상 아님) */
function ParticipantRowStatic({
  participant,
  onEdit,
}: {
  participant: Participant
  onEdit?: (participant: Participant) => void
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 mb-2 rounded-xl border bg-muted/40 shadow-sm group border-dashed border-muted-foreground/25'
      )}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-6 h-6 shrink-0 rounded-md bg-muted flex items-center justify-center" aria-hidden>
          <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{participant.name}</p>
          <div className="flex gap-1 mt-0.5">
            <span
              className={cn(
                'text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter',
                participant.nationality === '외국인' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
              )}
            >
              {participant.nationality === '외국인' ? 'INTL' : 'KOR'}
            </span>
            <span
              className={cn(
                'text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter',
                participant.gender === '여' ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-600'
              )}
            >
              {participant.gender}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap justify-end">
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300 shrink-0">
          미체크인
        </span>
        <div className="text-[10px] font-black text-primary uppercase bg-primary/5 px-2 py-1 rounded">
          {participant.language}
        </div>
        {onEdit ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onEdit(participant)
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
            }}
          >
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function TableContainer({ label, participants, round, tableLanguage, onEdit }: { label: string, participants: Participant[], round: number, tableLanguage?: string, onEdit?: (participant: Participant) => void }) {
  const { setNodeRef } = useDroppable({
    id: `table-${label}-${round}`,
    data: {
      type: 'container',
      tableLabel: label,
      round: round
    }
  })

  const warnings = getTableWarnings(participants)

  return (
    <Card className="border-none shadow-md bg-muted/20 rounded-[24px] overflow-hidden flex flex-col h-full">
      <CardHeader className="p-4 bg-card border-b flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-black">{label} Table</CardTitle>
            {tableLanguage ? (
              <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-2 py-1 rounded flex items-center gap-1">
                {tableLanguage === '영어' ? (
                  <svg className="w-3 h-3" viewBox="0 0 20 14" fill="none">
                    <rect width="20" height="14" fill="#B22234" />
                    <rect y="1.08" width="20" height="1.08" fill="white" />
                    <rect y="3.23" width="20" height="1.08" fill="white" />
                    <rect y="5.38" width="20" height="1.08" fill="white" />
                    <rect y="7.54" width="20" height="1.08" fill="white" />
                    <rect y="9.69" width="20" height="1.08" fill="white" />
                    <rect y="11.85" width="20" height="1.08" fill="white" />
                    <rect width="8" height="7.54" fill="#3C3B6E" />
                  </svg>
                ) : tableLanguage === '일본어' ? (
                  <svg className="w-3 h-3" viewBox="0 0 20 14" fill="none">
                    <rect width="20" height="14" fill="white" />
                    <circle cx="10" cy="7" r="3.5" fill="#BC002D" />
                  </svg>
                ) : null}
                {tableLanguage}
              </span>
            ) : null}
          </div>
          <span className="text-xs font-bold text-muted-foreground">{participants.length} 명</span>
        </div>

        {warnings.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {warnings.map(w => (
              <span key={w} className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                {w}
              </span>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent ref={setNodeRef} className="p-3 flex-1 min-h-[100px]">
        <SortableContext
          items={participants.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {participants.map(p => (
            <ParticipantCard key={p.id} participant={p} onEdit={onEdit} />
          ))}
        </SortableContext>
      </CardContent>
    </Card>
  )
}

function UnassignedList({ participants, round, onEdit }: { participants: Participant[], round: number, onEdit?: (participant: Participant) => void }) {
  const { setNodeRef } = useDroppable({
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
        <CardDescription className="text-xs font-medium">
          현장 QR 체크인이 완료되었고, 이번 라운드에 테이블이 아직 없는 참가자입니다. 드래그로 테이블에 배정할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent ref={setNodeRef} className="max-h-[400px] overflow-y-auto p-3 min-h-[100px]">
        <SortableContext
          items={participants.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {participants.map(p => (
            <ParticipantCard key={p.id} participant={p} onEdit={onEdit} />
          ))}
        </SortableContext>
        {participants.length === 0 && (
          <p className="text-center py-4 text-xs font-bold text-muted-foreground">모두 배정되었습니다.</p>
        )}
      </CardContent>
    </Card>
  )
}

function UncheckedInList({ participants, onEdit }: { participants: Participant[]; onEdit?: (p: Participant) => void }) {
  return (
    <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card border border-dashed border-muted-foreground/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-slate-500" />
          미체크인 인원
        </CardTitle>
        <CardDescription className="text-xs font-medium leading-relaxed">
          신청만 완료되었고 현장 QR 스캔 전입니다. QR로 체크인하면「미배정 인원」으로 이동한 뒤 자리를 배정할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[400px] overflow-y-auto p-3 min-h-[80px]">
        {participants.map((p) => (
          <ParticipantRowStatic key={p.id} participant={p} onEdit={onEdit} />
        ))}
        {participants.length === 0 && (
          <p className="text-center py-4 text-xs font-bold text-muted-foreground">미체크인 신청자가 없습니다.</p>
        )}
      </CardContent>
    </Card>
  )
}

// --- Main Page ---

export default function AdminArrangePage() {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [session, setTodaySession] = useState<ArrangePostingSession | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [formQuestions, setFormQuestions] = useState<CoreFormQuestion[]>([])
  const [rounds, setRounds] = useState<RoundData[]>([
    { round: 1, assignments: [], tableLanguages: {} },
    { round: 2, assignments: [], tableLanguages: {} },
    { round: 3, assignments: [], tableLanguages: {} }
  ])
  const [currentRound, setCurrentRound] = useState(1)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [langTableCounts, setLangTableCounts] = useState<Record<string, number>>({})
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [configRound, setConfigRound] = useState<number | null>(null)
  const [configCounts, setConfigCounts] = useState<Record<string, number>>({})
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [showDebugLogs, setShowDebugLogs] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    void fetchData()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount load + channel; fetchData is stable intent
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

      const { data: sessions } = await supabase
        .from('postings')
        .select('*')
        .eq('category', '언어교환')
        .is('day_of_week', null)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!sessions || sessions.length === 0) {
        setTodaySession(null)
        setLoading(false)
        return
      }

      const foundSession = sessions[0]
      const todayStr = todayYYYYMMDDSeoul()
      const currentDay = koreanWeekdayLetterSeoul()

      const { data: schedule } = await supabase
        .from('language_exchange_schedules')
        .select('*')
        .eq('posting_id', foundSession.id)
        .eq('day_of_week', currentDay)
        .eq('is_active', true)
        .single()
      
      console.log('🔍 [자리배치] 현재 요일:', currentDay)
      console.log('🔍 [자리배치] 스케줄 조회 결과:', schedule)
      
      if (!schedule) {
        console.error('❌ [자리배치] 오늘 세션 없음:', currentDay)
        toast.error(`오늘(${currentDay}요일) 언어교환 세션이 없습니다.`)
        setTodaySession(null)
        setLoading(false)
        return
      }
      
      console.log('✅ [자리배치] 스케줄 form_id:', schedule.form_id)
      
      // 스케줄의 form_id를 사용
      const sessionWithFormId = { ...foundSession, form_id: schedule.form_id, day_of_week: currentDay }
      console.log('✅ [자리배치] 세션 설정 완료:', sessionWithFormId)
      setTodaySession(sessionWithFormId as ArrangePostingSession)

      let questionsForExtract: CoreFormQuestion[] = []
      if (schedule.form_id) {
        const { data: qData } = await supabase
          .from('form_questions')
          .select('*')
          .eq('form_id', schedule.form_id)
          .order('display_order', { ascending: true })
        if (qData) {
          questionsForExtract = qData as CoreFormQuestion[]
          setFormQuestions(qData as CoreFormQuestion[])
        }
      }

      // Load saved table config if exists
      if (foundSession.seating_config?.langTableCounts) {
        setLangTableCounts(foundSession.seating_config.langTableCounts)
      }

      const { data: responsesRaw } = await supabase
        .from('form_responses')
        .select('*')
        .eq('form_id', schedule.form_id)

      const responses = (responsesRaw || []).filter((r) => {
        const ans = (r.answers || {}) as Record<string, unknown>
        const ev = typeof ans._event_date === 'string' ? ans._event_date.slice(0, 10) : ''
        const sel = typeof ans._selected_day === 'string' ? ans._selected_day.trim() : ''
        if (ev === todayStr) return true
        if (!ev && sel === currentDay) return true
        return false
      })

      const mapped: Participant[] = responses.map((r) => {
        const info = extractParticipantInfoFromAnswers(r.answers || {}, questionsForExtract)
        return {
          id: r.id,
          name: info.name || r.answers?.name || r.answers?.이름 || 'Anonymous',
          gender: info.gender || r.answers?.gender || r.answers?.성별 || '?',
          nationality: info.nationality || r.answers?.nationality || r.answers?.국적 || '?',
          language: r.answers?._selected_language || info.language || '-',
          checked_in_at: r.checked_in_at,
        }
      })
      setParticipants(mapped)

      const languageGroups = _.groupBy(mapped, 'language')
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

      // Fetch existing assignments if any (오늘 날짜 스냅샷; 없으면 레거시 null만)
      let existingAssignments: LoadedSeatingRow[] | null = null
      {
        const { data: todayRows } = await supabase
          .from('seating_assignments')
          .select('*')
          .eq('posting_id', foundSession.id)
          .eq('session_date', todayStr)
        if (todayRows && todayRows.length > 0) {
          existingAssignments = todayRows as LoadedSeatingRow[]
        } else {
          const { data: legacy } = await supabase
            .from('seating_assignments')
            .select('*')
            .eq('posting_id', foundSession.id)
            .is('session_date', null)
          existingAssignments = (legacy ?? []) as LoadedSeatingRow[]
        }
      }

      if (existingAssignments && existingAssignments.length > 0) {
        const checkedIds = new Set(mapped.filter((p) => p.checked_in_at).map((p) => p.id))
        const filteredAssignments = existingAssignments.filter((a) => checkedIds.has(a.participant_id))
        const newRounds = [1, 2, 3].map((r) => {
          const assignments = filteredAssignments
            .filter((a) => a.round === r)
            .map((a) => ({ participant_id: a.participant_id, table_label: a.table_label }))
          return {
            round: r,
            assignments,
            tableLanguages: inferTableLanguages(assignments, mapped),
          }
        })
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

  const uncheckedInParticipants = useMemo(
    () => participants.filter((p) => !p.checked_in_at),
    [participants]
  )

  const unassignedForCurrentRound = useMemo(() => {
    const assignments = rounds.find((r) => r.round === currentRound)?.assignments || []
    return participants.filter(
      (p) =>
        Boolean(p.checked_in_at) &&
        !assignments.some((a) => a.participant_id === p.id)
    )
  }, [participants, rounds, currentRound])

  const openConfigForRound = useCallback(
    (roundNumber: number) => {
      const attendees = participants.filter((p) => p.checked_in_at)
      if (attendees.length === 0) {
        toast.error('체크인한 참가자가 없습니다. QR 스캔 후 배치할 수 있습니다.')
        return
      }

      const autoCounts = calculateAutoTableCounts(attendees)
      const nextCounts: Record<string, number> = { ...langTableCounts }
      Object.keys(autoCounts).forEach((lang) => {
        if (nextCounts[lang] == null || nextCounts[lang] < 1) {
          nextCounts[lang] = autoCounts[lang]
        }
      })

      setConfigRound(roundNumber)
      setConfigCounts(nextCounts)
      setIsConfigOpen(true)
    },
    [participants, langTableCounts]
  )

  const handleConfirmConfig = useCallback(() => {
    if (configRound === null) return

    const attendees = participants.filter((p) => p.checked_in_at)
    if (attendees.length === 0) {
      toast.error('체크인한 참가자가 없습니다.')
      return
    }

    const counts: Record<string, number> = {}
    Object.entries(configCounts).forEach(([lang, n]) => {
      const v = typeof n === 'number' ? n : parseInt(String(n), 10)
      if (lang && v >= 1) counts[lang] = v
    })

    setLangTableCounts((prev) => ({ ...prev, ...counts }))

    const previousRounds = rounds.filter((r) => r.round < configRound && r.assignments.length > 0)
    const newRoundData = runSeatingArrangeRound(configRound, attendees, counts, previousRounds)
    const updatedRounds = rounds.map((r) => (r.round === configRound ? newRoundData : r))
    setRounds(updatedRounds)

    const dbgParticipants = attendees.map((p) => ({
      id: p.id,
      name: p.name,
      nationality: String(p.nationality),
      gender: String(p.gender),
      language: p.language,
    }))
    const debugLog = generateDebugLog(configRound, newRoundData, updatedRounds, dbgParticipants)
    setDebugLogs((prev) => [...prev, formatDebugLog(debugLog)])

    toast.success(`${configRound}라운드 배치가 완료되었습니다.`)
    setCurrentRound(configRound)
    setIsConfigOpen(false)
    setConfigRound(null)
  }, [configRound, configCounts, participants, rounds])

  const handleExportRoundCsv = useCallback(
    (roundNum: number) => {
      const rd = rounds.find((x) => x.round === roundNum)
      if (!rd || rd.assignments.length === 0) {
        toast.error('내보낼 배정이 없습니다.')
        return
      }
      const todayStr = todayYYYYMMDDSeoul()
      const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
      const lines = ['table_label,name,language,nationality,gender']
      for (const a of rd.assignments) {
        const p = participants.find((x) => x.id === a.participant_id)
        if (!p) continue
        lines.push(
          [a.table_label, p.name, p.language, String(p.nationality), String(p.gender)].map((c) => esc(String(c))).join(',')
        )
      }
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `langbuddy_round${roundNum}_${todayStr}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`${roundNum}라운드 CSV를 저장했습니다.`)
    },
    [rounds, participants]
  )

  // --- Seating Algorithm ---

  const handleAddParticipant = (newParticipant: Participant) => {
    setParticipants((prev) => {
      const exists = prev.find((p) => p.id === newParticipant.id)
      if (exists) {
        return prev.map((p) => (p.id === newParticipant.id ? { ...p, ...newParticipant } : p))
      }
      return [...prev, newParticipant]
    })

    if (!newParticipant.checked_in_at) {
      toast.info(
        `${newParticipant.name}님은 현장 QR 체크인 전입니다. 체크인 후「미배정 인원」에서 배정할 수 있습니다.`,
        { duration: 5000 }
      )
      return
    }

    const stage = deriveArrangeStage(rounds)
    if (stage === 1) {
      toast.success(`${newParticipant.name}님이 미배정 인원으로 등록되었습니다.`, { duration: 5000 })
      return
    }

    const targetRound = targetRoundForLateJoin(stage)
    if (targetRound == null) return

    const roundData = rounds.find((r) => r.round === targetRound)
    if (!roundData || roundData.assignments.length === 0) {
      toast.info(
        `${targetRound}라운드 배치가 아직 없습니다. 해당 라운드「배치」를 먼저 실행한 뒤 다시 추가해 주세요.`,
        { duration: 5000 }
      )
      return
    }

    if (roundData.assignments.some((a) => a.participant_id === newParticipant.id)) {
      toast.info(`${newParticipant.name}님은 이미 ${targetRound}라운드에 배정되어 있습니다.`, { duration: 4000 })
      return
    }

    const tableLanguages = roundData.tableLanguages || {}
    const matchingTables = Object.keys(tableLanguages).filter(
      (label) => tableLanguages[label] === newParticipant.language
    )

    if (matchingTables.length === 0) {
      toast.warning(
        `${newParticipant.name}님이 추가되었습니다. ${targetRound}라운드에 ${newParticipant.language} 테이블이 없어 미배정 상태입니다.`,
        { duration: 5000 }
      )
      return
    }

    const tableAssignments = roundData.assignments
    const assignmentsByTable = _.groupBy(tableAssignments, 'table_label')

    let minTable = matchingTables[0]
    let minCount = (assignmentsByTable[minTable] || []).length

    matchingTables.forEach((label) => {
      const count = (assignmentsByTable[label] || []).length
      if (count < minCount) {
        minCount = count
        minTable = label
      }
    })

    setRounds((prev) => {
      const updated = [...prev]
      const roundIdx = updated.findIndex((r) => r.round === targetRound)
      if (roundIdx !== -1) {
        updated[roundIdx] = {
          ...updated[roundIdx],
          assignments: [
            ...updated[roundIdx].assignments,
            { participant_id: newParticipant.id, table_label: minTable },
          ],
        }
      }
      return updated
    })

    toast.success(
      `${newParticipant.name}님이 ${targetRound}라운드 ${minTable} 테이블에 배치되었습니다.`,
      { duration: 5000 }
    )
  }

  const handleUpdateParticipant = (updated: Participant) => {
    const oldParticipant = participants.find(p => p.id === updated.id)
    if (!oldParticipant) return

    // 참가자 정보 업데이트
    setParticipants(prev =>
      prev.map(p => p.id === updated.id ? updated : p)
    )

    // 언어가 변경된 경우 현재 라운드 자동 재배정
    if (oldParticipant.language !== updated.language) {
      const currentRoundData = rounds.find(r => r.round === currentRound)
      if (currentRoundData && currentRoundData.assignments.length > 0) {
        const currentAssignment = currentRoundData.assignments.find(
          a => a.participant_id === updated.id
        )

        if (currentAssignment) {
          const tableLanguages = currentRoundData.tableLanguages || {}
          const currentTableLang = tableLanguages[currentAssignment.table_label]

          // 현재 테이블 언어와 새 언어가 다르면 재배정
          if (currentTableLang !== updated.language) {
            const assignmentsByTable = _.groupBy(currentRoundData.assignments, 'table_label')

            // 새 언어와 일치하는 테이블 찾기
            const matchingTables = Object.keys(tableLanguages).filter(
              label => tableLanguages[label] === updated.language
            )

            if (matchingTables.length > 0) {
              // 인원이 가장 적은 테이블 찾기
              let minTable = matchingTables[0]
              let minCount = (assignmentsByTable[minTable] || []).length

              matchingTables.forEach(label => {
                const count = (assignmentsByTable[label] || []).length
                if (count < minCount) {
                  minCount = count
                  minTable = label
                }
              })

              // 재배정
              setRounds(prev => {
                const updatedRounds = [...prev]
                const roundIdx = updatedRounds.findIndex(r => r.round === currentRound)
                if (roundIdx !== -1) {
                  updatedRounds[roundIdx] = {
                    ...updatedRounds[roundIdx],
                    assignments: updatedRounds[roundIdx].assignments.map(a =>
                      a.participant_id === updated.id
                        ? { ...a, table_label: minTable }
                        : a
                    )
                  }
                }
                return updatedRounds
              })

              toast.success(
                `${updated.name}님의 언어가 ${updated.language}로 변경되어 ${minTable}테이블로 재배정되었습니다.`,
                { duration: 5000 }
              )
            } else {
              // 일치하는 테이블이 없으면 미배정으로
              setRounds(prev => {
                const updatedRounds = [...prev]
                const roundIdx = updatedRounds.findIndex(r => r.round === currentRound)
                if (roundIdx !== -1) {
                  updatedRounds[roundIdx] = {
                    ...updatedRounds[roundIdx],
                    assignments: updatedRounds[roundIdx].assignments.filter(
                      a => a.participant_id !== updated.id
                    )
                  }
                }
                return updatedRounds
              })

              toast.warning(
                `${updated.name}님의 언어가 ${updated.language}로 변경되었으나, 현재 라운드에 해당 언어 테이블이 없어 미배정 상태입니다.`,
                { duration: 5000 }
              )
            }
          } else {
            toast.success(`${updated.name}님의 정보가 수정되었습니다.`)
          }
        } else {
          toast.success(`${updated.name}님의 정보가 수정되었습니다.`)
        }
      } else {
        toast.success(`${updated.name}님의 정보가 수정되었습니다.`)
      }
    } else {
      toast.success(`${updated.name}님의 정보가 수정되었습니다.`)
    }
  }

  const [deletingParticipantId, setDeletingParticipantId] = useState<string | null>(null)

  const handleDeleteParticipant = async (p: Participant) => {
    try {
      setDeletingParticipantId(p.id)

      const { error: seatingErr } = await supabase
        .from('seating_assignments')
        .delete()
        .eq('participant_id', p.id)
      if (seatingErr) throw seatingErr

      const { error: responseErr } = await supabase.from('form_responses').delete().eq('id', p.id)
      if (responseErr) throw responseErr

      setParticipants((prev) => prev.filter((x) => x.id !== p.id))
      setRounds((prev) =>
        prev.map((r) => ({
          ...r,
          assignments: r.assignments.filter((a) => a.participant_id !== p.id),
        }))
      )
      setEditingParticipant(null)
      toast.success('참가자를 삭제했습니다.')
    } catch (err) {
      console.error(err)
      toast.error('삭제에 실패했습니다. 권한(RLS) 또는 네트워크를 확인해 주세요.')
      throw err
    } finally {
      setDeletingParticipantId(null)
    }
  }

  const handleSave = async () => {
    if (!session) return

    setLoading(true)
    const todayStr = todayYYYYMMDDSeoul()
    const checkedIds = new Set(participants.filter((p) => p.checked_in_at).map((p) => p.id))
    try {
      // 1. Save table config to session
      const { error: postingErr } = await supabase
        .from('postings')
        .update({ seating_config: { langTableCounts } })
        .eq('id', session.id)
      if (postingErr) throw postingErr

      // 2. 기존 스냅샷 제거: 오늘 날짜 행 + session_date NULL(레거시) — 레거시만 남으면 동일 (posting, round, participant) UNIQUE와 충돌할 수 있음
      const { error: delTodayErr } = await supabase
        .from('seating_assignments')
        .delete()
        .eq('posting_id', session.id)
        .eq('session_date', todayStr)
      if (delTodayErr) throw delTodayErr

      const { error: delLegacyErr } = await supabase
        .from('seating_assignments')
        .delete()
        .eq('posting_id', session.id)
        .is('session_date', null)
      if (delLegacyErr) throw delLegacyErr

      const rawRows = rounds.flatMap((r) =>
        r.assignments
          .filter(
            (a) =>
              a.table_label &&
              String(a.table_label).trim() &&
              checkedIds.has(a.participant_id)
          )
          .map((a) => ({
            posting_id: session.id,
            session_date: todayStr,
            round: r.round,
            table_label: String(a.table_label).trim(),
            participant_id: a.participant_id,
          }))
      )

      const dedupedMap = new Map<string, (typeof rawRows)[0]>()
      for (const row of rawRows) {
        dedupedMap.set(`${row.round}:${row.participant_id}`, row)
      }
      const allAssignments = [...dedupedMap.values()]

      if (allAssignments.length > 0) {
        const { error: insErr } = await supabase.from('seating_assignments').insert(allAssignments)
        if (insErr) throw insErr
      }

      toast.success('배치 결과 및 설정이 저장되었습니다.')
    } catch (err: unknown) {
      console.error(err)
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : '저장에 실패했습니다.'
      toast.error(msg.length < 200 ? `저장 실패: ${msg}` : `저장 실패: ${msg.slice(0, 180)}…`)
    } finally {
      setLoading(false)
    }
  }

  // --- DnD Handlers ---

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || !active) return

    const activeId = active.id as string
    const overId = over.id as string
    const activeParticipant = participants.find((p) => p.id === activeId)

    if (activeParticipant && !activeParticipant.checked_in_at) {
      toast.error('QR 체크인이 완료된 참가자만 자리를 배정할 수 있습니다.', { id: 'need-checkin' })
      return
    }

    const isOverTable = over.data?.current?.type === 'container'

    if (isOverTable && over.data.current) {
      const newTableLabel = over.data.current.tableLabel as string

      if (newTableLabel === 'unassigned') {
        setRounds((prev) => {
          const newRounds = [...prev]
          const roundIdx = newRounds.findIndex((r) => r.round === currentRound)
          const currentAssignments = [...(newRounds[roundIdx].assignments || [])]
          const activeIdx = currentAssignments.findIndex((a) => a.participant_id === activeId)
          if (activeIdx !== -1) {
            currentAssignments.splice(activeIdx, 1)
          }
          newRounds[roundIdx] = { ...newRounds[roundIdx], assignments: currentAssignments }
          return newRounds
        })
      } else {
        const currentRoundData = rounds.find((r) => r.round === currentRound)
        const tableLang = currentRoundData?.tableLanguages?.[newTableLabel]

        if (tableLang && activeParticipant && tableLang !== activeParticipant.language) {
          toast.error(`언어가 다릅니다: ${activeParticipant.language} 참가자는 ${tableLang} 테이블에 앉을 수 없습니다.`, {
            id: 'lang-mismatch',
          })
          return
        }

        setRounds((prev) => {
          const newRounds = [...prev]
          const roundIdx = newRounds.findIndex((r) => r.round === currentRound)
          const currentAssignments = [...(newRounds[roundIdx].assignments || [])]
          const activeIdx = currentAssignments.findIndex((a) => a.participant_id === activeId)

          if (activeIdx !== -1) {
            currentAssignments[activeIdx] = { ...currentAssignments[activeIdx], table_label: newTableLabel }
          } else {
            currentAssignments.push({ participant_id: activeId, table_label: newTableLabel })
          }
          newRounds[roundIdx] = { ...newRounds[roundIdx], assignments: currentAssignments }
          return newRounds
        })
      }
    } else {
      const currentRoundData = rounds.find((r) => r.round === currentRound)
      const currentRoundAssignments = currentRoundData?.assignments || []
      const activeAssignment = currentRoundAssignments.find((a) => a.participant_id === activeId)
      const overAssignment = currentRoundAssignments.find((a) => a.participant_id === overId)

      if (overAssignment && overAssignment.table_label !== activeAssignment?.table_label) {
        const newTableLabel = overAssignment.table_label
        const tableLang = currentRoundData?.tableLanguages?.[newTableLabel]

        if (tableLang && activeParticipant && tableLang !== activeParticipant.language) {
          toast.error(`언어가 다릅니다: ${activeParticipant.language} 참가자는 ${tableLang} 테이블에 앉을 수 없습니다.`, {
            id: 'lang-mismatch',
          })
          return
        }

        setRounds((prev) => {
          const newRounds = [...prev]
          const roundIdx = newRounds.findIndex((r) => r.round === currentRound)
          const currentAssignments = [...(newRounds[roundIdx].assignments || [])]
          const activeIdx = currentAssignments.findIndex((a) => a.participant_id === activeId)

          if (activeIdx !== -1) {
            currentAssignments[activeIdx] = { ...currentAssignments[activeIdx], table_label: newTableLabel }
          } else {
            currentAssignments.push({ participant_id: activeId, table_label: newTableLabel })
          }
          newRounds[roundIdx] = { ...newRounds[roundIdx], assignments: currentAssignments }
          return newRounds
        })
      } else if (!overAssignment && activeAssignment) {
        setRounds((prev) => {
          const newRounds = [...prev]
          const roundIdx = newRounds.findIndex((r) => r.round === currentRound)
          const currentAssignments = [...(newRounds[roundIdx].assignments || [])]
          const activeIdx = currentAssignments.findIndex((a) => a.participant_id === activeId)
          if (activeIdx !== -1) {
            currentAssignments.splice(activeIdx, 1)
          }
          newRounds[roundIdx] = { ...newRounds[roundIdx], assignments: currentAssignments }
          return newRounds
        })
      }
    }
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
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4 p-10">
          <AlertTriangle className="w-14 h-14 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-black">오늘 활성화된 언어교환이 없습니다</h1>
          <p className="text-muted-foreground font-medium">언어교환을 활성화 하고 다시 시도해 주세요</p>
          <Button asChild className="rounded-xl font-bold mt-2">
            <Link href="/admin/language">언어교환 관리로 이동</Link>
          </Button>
        </div>
      </div>
    )
  }

  const currentRoundAssignments = rounds.find((r) => r.round === currentRound)?.assignments || []
  const activeParticipant = participants.find((p) => p.id === activeId)
  const currentRoundDataForView = rounds.find((r) => r.round === currentRound)

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
            <span className="text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded-xl">
              {new Intl.DateTimeFormat('ko-KR', {
                timeZone: 'Asia/Seoul',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              }).format(new Date())}
            </span>
          </div>
          <p className="text-muted-foreground font-medium">{session.title} • {session.date}</p>
        </div>

        <div className="flex flex-col gap-2 items-stretch md:items-end">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              type="button"
              onClick={() => openConfigForRound(1)}
              className="rounded-xl font-black gap-2"
              variant={rounds[0].assignments.length > 0 ? 'outline' : 'default'}
              disabled={rounds[0].assignments.length > 0}
            >
              {rounds[0].assignments.length > 0 ? '1라운드 완료' : '1라운드 배치'}
            </Button>
            <Button
              type="button"
              onClick={() => openConfigForRound(2)}
              className="rounded-xl font-black gap-2"
              variant={rounds[1].assignments.length > 0 ? 'outline' : 'default'}
              disabled={rounds[0].assignments.length === 0 || rounds[1].assignments.length > 0}
            >
              {rounds[1].assignments.length > 0 ? '2라운드 완료' : '2라운드 배치'}
            </Button>
            <Button
              type="button"
              onClick={() => openConfigForRound(3)}
              className="rounded-xl font-black gap-2"
              variant={rounds[2].assignments.length > 0 ? 'outline' : 'default'}
              disabled={rounds[1].assignments.length === 0 || rounds[2].assignments.length > 0}
            >
              {rounds[2].assignments.length > 0 ? '3라운드 완료' : '3라운드 배치'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <RoundImageExporter
              key={currentRound}
              round={currentRound}
              roundData={currentRoundDataForView ?? { round: currentRound, assignments: [], tableLanguages: {} }}
              participants={participants}
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-xl font-bold gap-2"
              onClick={() => handleExportRoundCsv(currentRound)}
            >
              <Download className="w-4 h-4" />
              CSV 내보내기
            </Button>
            <Button type="button" onClick={handleSave} variant="outline" className="rounded-xl font-black gap-2">
              <Save className="w-4 h-4" />
              저장하기
            </Button>
            {debugLogs.length > 0 ? (
              <Button
                type="button"
                onClick={() => setShowDebugLogs(!showDebugLogs)}
                variant={showDebugLogs ? 'default' : 'outline'}
                className="rounded-xl font-bold gap-2"
              >
                디버그 로그 {showDebugLogs ? '숨기기' : '보기'}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {showDebugLogs && debugLogs.length > 0 ? (
        <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-black flex items-center gap-2">배치 디버그 로그</CardTitle>
            <CardDescription className="text-xs font-medium">최근 라운드 배치 시 자동 누적됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {debugLogs.map((log, idx) => (
              <pre
                key={idx}
                className="bg-muted p-4 rounded-xl text-xs overflow-x-auto font-mono whitespace-pre"
              >
                {log}
              </pre>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl font-bold"
              onClick={() => {
                void navigator.clipboard.writeText(debugLogs.join('\n\n'))
                toast.success('디버그 로그를 클립보드에 복사했습니다.')
              }}
            >
              전체 로그 복사
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isConfigOpen && configRound !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
            aria-label="닫기"
            onClick={() => {
              setIsConfigOpen(false)
              setConfigRound(null)
            }}
          />
          <div className="relative z-10 w-full max-w-xl mx-4" onClick={(e) => e.stopPropagation()}>
            <Card className="border-none shadow-2xl rounded-[32px] overflow-hidden bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  {configRound}라운드 테이블 설정
                </CardTitle>
                <CardDescription className="text-sm font-medium">
                  체크인 완료 참가자 기준입니다. 테이블 수를 조정한 뒤 배치를 확정하세요.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(_.groupBy(participants.filter((p) => p.checked_in_at), 'language'))
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([lang, members]) => {
                    const count = members.length
                    const tableCount = configCounts[lang] ?? 1
                    const perTable = (count / tableCount).toFixed(1)
                    return (
                      <div key={lang} className="flex flex-col gap-2 p-4 rounded-2xl bg-muted/50 border border-border">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-foreground uppercase tracking-tight">{lang}</span>
                          <span className="text-[10px] font-bold text-muted-foreground">{count}명 (체크인)</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() =>
                                setConfigCounts((prev) => ({
                                  ...prev,
                                  [lang]: Math.max(1, tableCount - 1),
                                }))
                              }
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              value={tableCount}
                              onChange={(e) => {
                                const value = parseInt(e.target.value, 10) || 1
                                setConfigCounts((prev) => ({
                                  ...prev,
                                  [lang]: Math.max(1, value),
                                }))
                              }}
                              className="h-9 w-16 rounded-xl text-center font-black text-primary focus:ring-primary"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() =>
                                setConfigCounts((prev) => ({
                                  ...prev,
                                  [lang]: tableCount + 1,
                                }))
                              }
                            >
                              +
                            </Button>
                          </div>
                          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                            예상 테이블당 인원수: {perTable}명
                          </span>
                        </div>
                      </div>
                    )
                  })}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl font-bold"
                    onClick={() => {
                      setIsConfigOpen(false)
                      setConfigRound(null)
                    }}
                  >
                    취소
                  </Button>
                  <Button type="button" className="rounded-xl font-black" onClick={handleConfirmConfig}>
                    설정 완료 · 배치 실행
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
          {/* Statistics & Participants Sidebar */}
          <aside className="space-y-6">
            <ParticipantAdder 
              onAddParticipant={handleAddParticipant}
              formId={session?.form_id || ''}
              formQuestions={formQuestions}
              existingParticipantIds={participants.map(p => p.id)}
            />

            <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  참가자 통계
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/50 p-3 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">신청</p>
                    <p className="text-xl font-black">{participants.length}</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">체크인</p>
                    <p className="text-xl font-black text-emerald-600">{checkedInParticipants.length}</p>
                  </div>
                  <div className="bg-slate-100 p-3 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-slate-600 uppercase mb-1">미체크인</p>
                    <p className="text-xl font-black text-slate-700">{uncheckedInParticipants.length}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm font-bold px-1">
                  <span className="text-muted-foreground">이번 라운드 배정</span>
                  <span>{currentRoundAssignments.length}명</span>
                </div>
                
                <div className="h-px bg-muted" />
                
                <div className="space-y-2">
                  <p className="text-xs font-black text-muted-foreground uppercase">언어별 참가자</p>
                  {Object.entries(_.groupBy(participants, 'language')).map(([lang, members]) => (
                    <div key={lang} className="flex justify-between items-center text-sm font-bold">
                      <span>{lang}</span>
                      <span className="text-primary">{members.length}명</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <UnassignedList
              participants={unassignedForCurrentRound}
              round={currentRound}
              onEdit={setEditingParticipant}
            />

            <UncheckedInList participants={uncheckedInParticipants} onEdit={setEditingParticipant} />
          </aside>

          {/* Main Seating Area */}
          <main className="space-y-6">
            <Tabs value={currentRound.toString()} onValueChange={(v) => setCurrentRound(parseInt(v))} className="w-full">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="bg-muted p-1 rounded-2xl h-14">
                  {[1, 2, 3].map((r) => (
                    <TabsTrigger
                      key={r}
                      value={r.toString()}
                      disabled={
                        (r === 2 && rounds[0].assignments.length === 0) ||
                        (r === 3 && rounds[1].assignments.length === 0)
                      }
                      className="rounded-xl px-8 h-full data-[state=active]:bg-card data-[state=active]:shadow-md font-black text-lg"
                    >
                      {r} Round
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-muted-foreground hover:text-primary"
                    onClick={fetchData}
                  >
                    <RotateCcw className={cn('w-5 h-5', loading && 'animate-spin')} />
                  </Button>
                  <Button
                    type="button"
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

              {[1, 2, 3].map((r) => {
                const roundData = rounds.find((rd) => rd.round === r)
                const assignments = roundData?.assignments || []
                const tableLabelsForRound = Object.keys(roundData?.tableLanguages || {}).sort()
                return (
                  <TabsContent key={r} value={r.toString()} className="mt-0 focus-visible:outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {tableLabelsForRound.map((label) => {
                        const tableParticipants = assignments
                          .filter((a) => a.table_label === label)
                          .map((a) => participants.find((p) => p.id === a.participant_id))
                          .filter(Boolean) as Participant[]

                        return (
                          <TableContainer
                            key={label}
                            label={label}
                            participants={tableParticipants}
                            round={r}
                            tableLanguage={roundData?.tableLanguages?.[label]}
                            onEdit={setEditingParticipant}
                          />
                        )
                      })}
                      {tableLabelsForRound.length === 0 ? (
                        <div className="col-span-full py-32 text-center border-2 border-dashed border-border rounded-[40px] bg-card/50">
                          <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                          <p className="text-xl font-black text-muted-foreground">이 라운드 테이블이 아직 없습니다.</p>
                          <p className="text-muted-foreground font-medium mt-2">
                            위에서 해당 라운드「배치」를 실행해 주세요.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </TabsContent>
                )
              })}
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
            <ParticipantCard participant={activeParticipant} isOverlay onEdit={setEditingParticipant} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {editingParticipant && (
        <ParticipantEditor
          key={editingParticipant.id}
          participant={editingParticipant}
          isOpen={true}
          onClose={() => setEditingParticipant(null)}
          onSave={handleUpdateParticipant}
          onDelete={handleDeleteParticipant}
          isDeleting={deletingParticipantId === editingParticipant.id}
        />
      )}
    </div>
  )
}
