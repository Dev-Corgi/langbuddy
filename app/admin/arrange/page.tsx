'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  Users,
  LayoutGrid,
  Bell,
  RotateCcw,
  UserPlus,
  AlertTriangle,
  ChevronLeft,
  GripVertical,
  Copy,
  Settings,
  Download,
  Trash2,
  Plus,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn, type CoreFormQuestion } from '@/lib/utils'
import {
  formResponseMatchesTodaySession,
  koreanWeekdayLetterSeoul,
  todayYYYYMMDDSeoul,
} from '@/lib/session-event-date'
import { deriveArrangeStage, targetRoundForLateJoin } from '@/lib/arrange-stage'
import { buildLangCheckinModalPayload } from '@/lib/admin-checkin-display'
import { ADMIN_CHECKIN_SOURCE_DRAG, ADMIN_CHECKIN_SOURCE_MODAL } from '@/lib/admin-manual-checkin'
import {
  isWalkInAnswers,
  mapFormResponseToParticipant,
  type ArrangedParticipant,
} from '@/lib/walk-in-participant'
import { SUPPORTED_LANGUAGES, isSupportedLanguage } from '@/lib/supported-languages'

function participantRecencyMs(p: ArrangedParticipant): { checkedIn: number; created: number } {
  const checkedIn = p.checked_in_at ? Date.parse(p.checked_in_at) : 0
  const created = p.created_at ? Date.parse(p.created_at) : checkedIn
  return {
    checkedIn: Number.isFinite(checkedIn) ? checkedIn : 0,
    created: Number.isFinite(created) ? created : 0,
  }
}

/** 미배정 목록: 최근 체크인/추가 순 (현장 walk-in·운영자 드래그 체크인 포함) */
function sortParticipantsByRecencyDesc(list: ArrangedParticipant[]): ArrangedParticipant[] {
  return [...list].sort((a, b) => {
    const aa = participantRecencyMs(a)
    const bb = participantRecencyMs(b)
    if (bb.checkedIn !== aa.checkedIn) return bb.checkedIn - aa.checkedIn
    return bb.created - aa.created
  })
}

/** 미체크인 목록: 이름 가나다·ABC 오름차순 */
function sortParticipantsByNameAsc(list: ArrangedParticipant[]): ArrangedParticipant[] {
  return [...list].sort((a, b) =>
    a.name.localeCompare(b.name, 'ko', { sensitivity: 'base', numeric: true })
  )
}
import {
  loadSeatingLiveState,
  persistSeatingLive,
  type SeatingConfigPayload,
} from '@/lib/seating-live-sync'
import {
  QrScanResultSheet,
  type QrScanResultSheetPayload,
} from '@/components/admin/qr-scan-result-sheet'
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
  pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import _ from 'lodash'
import { arrangeRound as runSeatingArrangeRound, calculateAutoTableCounts, getTableWarnings, pickBestTableForLateJoin, evaluateRoundQuality, formatDuplicateWarningMessage, reunionCountIfJoinedTable } from '@/lib/seating-algorithm'
import type { RoundData } from '@/lib/seating-algorithm'
import { formatDebugLog, generateDebugLog } from '@/lib/seating-debug-logger'
import { RoundImageExporter } from '@/components/admin/round-image-exporter'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  addTableToRound,
  getNextTableLabel,
  mergeLangTableCounts,
  removeTableFromRound,
  sortTableLabels,
  langTableCountsFromRounds,
} from '@/lib/seating-table-ops'

// --- Types ---

type Participant = ArrangedParticipant

type ArrangePostingSession = {
  id: string
  title: string
  date: string
  form_id?: string | null
  day_of_week?: string | null
  seating_config?: SeatingConfigPayload | null
}

/** 라운드당 participant_id 1건 — 드래그 시 중복 배정 방지 */
function setParticipantTableAssignment(
  assignments: RoundData['assignments'],
  participantId: string,
  tableLabel: string | null
): RoundData['assignments'] {
  const next = assignments.filter((a) => a.participant_id !== participantId)
  if (tableLabel && tableLabel.trim()) {
    next.push({ participant_id: participantId, table_label: tableLabel })
  }
  return next
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
        !checkedIn && !isOverlay ? 'border-dashed border-amber-300/70 bg-amber-50/20' : '',
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

function TableContainer({
  label,
  participants,
  round,
  tableLanguage,
  onEdit,
  onDelete,
}: {
  label: string
  participants: Participant[]
  round: number
  tableLanguage?: string
  onEdit?: (participant: Participant) => void
  onDelete?: () => void
}) {
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
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs font-bold text-muted-foreground">{participants.length} 명</span>
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 relative z-50"
                title="테이블 삭제"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onDelete()
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            ) : null}
          </div>
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

function AddTableCard({
  languages,
  disabled,
  onAdd,
}: {
  languages: string[]
  disabled?: boolean
  onAdd: (language: string) => void
}) {
  const [open, setOpen] = useState(false)

  const handleOpen = () => {
    if (disabled) {
      toast.error('테이블은 최대 26개(A~Z)까지 추가할 수 있습니다.')
      return
    }
    if (languages.length === 1) {
      onAdd(languages[0]!)
      return
    }
    setOpen(true)
  }

  const dashedButton = (
    <button
      type="button"
      className={cn(
        'w-full min-h-[160px] h-full flex flex-col items-center justify-center gap-2 rounded-[24px]',
        'border-2 border-dashed border-border/80 bg-card/30 transition-colors',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:border-primary/50 hover:bg-muted/20 cursor-pointer'
      )}
      onClick={languages.length <= 1 ? handleOpen : undefined}
    >
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Plus className="w-5 h-5 text-primary" />
      </div>
      <span className="text-sm font-black text-muted-foreground">테이블 추가</span>
    </button>
  )

  if (languages.length > 1 && !disabled) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'w-full min-h-[160px] h-full flex flex-col items-center justify-center gap-2 rounded-[24px]',
              'border-2 border-dashed border-border/80 bg-card/30 transition-colors',
              'hover:border-primary/50 hover:bg-muted/20 cursor-pointer'
            )}
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-black text-muted-foreground">테이블 추가</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 rounded-2xl p-3" align="start">
          <p className="text-xs font-bold text-muted-foreground mb-2 px-1">테이블 언어 선택</p>
          <div className="flex flex-col gap-1">
            {languages.map((lang) => (
              <Button
                key={lang}
                type="button"
                variant="ghost"
                className="justify-start rounded-xl font-bold"
                onClick={() => {
                  onAdd(lang)
                  setOpen(false)
                }}
              >
                {lang}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return dashedButton
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
    <div ref={setNodeRef} className="rounded-[32px]">
      <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card h-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-black flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-500" />
            미배정 인원
          </CardTitle>
          <CardDescription className="text-xs font-medium">
            현장 QR 체크인이 완료되었고, 이번 라운드에 테이블이 아직 없는 참가자입니다. 드래그로 테이블에 배정할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[400px] overflow-y-auto p-3 min-h-[100px]">
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
    </div>
  )
}

function UncheckedInList({ participants, onEdit }: { participants: Participant[]; onEdit?: (p: Participant) => void }) {
  const [searchQuery, setSearchQuery] = useState('')

  const visibleParticipants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return participants
    return participants.filter((p) => p.name.toLowerCase().includes(q))
  }, [participants, searchQuery])

  return (
    <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card border border-dashed border-muted-foreground/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-slate-500" />
          미체크인 인원
          <span className="text-sm font-bold text-muted-foreground ml-auto tabular-nums">
            {searchQuery.trim()
              ? `${visibleParticipants.length} / ${participants.length}명`
              : `${participants.length}명`}
          </span>
        </CardTitle>
        <CardDescription className="text-xs font-medium leading-relaxed">
          신청만 완료되었고 현장 QR 스캔 전입니다. 미배정 또는 테이블로 드래그하면 운영자 확인 체크인 후 이동·배정됩니다.
        </CardDescription>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름으로 검색"
            className="h-9 rounded-xl text-sm font-medium pl-9"
            autoComplete="off"
          />
        </div>
      </CardHeader>
      <CardContent className="max-h-[400px] overflow-y-auto p-3 min-h-[80px]">
        <SortableContext
          items={visibleParticipants.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleParticipants.map((p) => (
            <ParticipantCard key={p.id} participant={p} onEdit={onEdit} />
          ))}
        </SortableContext>
        {participants.length === 0 ? (
          <p className="text-center py-4 text-xs font-bold text-muted-foreground">미체크인 신청자가 없습니다.</p>
        ) : searchQuery.trim() && visibleParticipants.length === 0 ? (
          <p className="text-center py-4 text-xs font-bold text-muted-foreground">
            「{searchQuery.trim()}」과(와) 일치하는 이름이 없습니다.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

// --- Main Page ---

export default function AdminArrangePage() {
  const supabase = useMemo(() => createClient(), [])
  const sessionRef = useRef<ArrangePostingSession | null>(null)
  const formQuestionsRef = useRef<CoreFormQuestion[]>([])
  const participantsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seatingPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressParticipantRefreshRef = useRef(false)
  const suppressParticipantRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyForPersistRef = useRef(false)
  const applyingRemoteSeatingRef = useRef(false)
  const suppressRemoteReloadRef = useRef(false)
  const pendingPersistAfterRemoteRef = useRef(false)
  const seatingPersistInFlightRef = useRef(false)
  const seatingPersistPendingRef = useRef(false)
  const persistFailedAtRef = useRef(0)
  const participantsRef = useRef<Participant[]>([])
  const roundsRef = useRef<RoundData[]>([])
  const langTableCountsRef = useRef<Record<string, number>>({})
  const lastCheckinModalRef = useRef<{ id: string; at: number } | null>(null)
  const seenCheckedInIdsRef = useRef<Set<string>>(new Set())
  const activeDragIdRef = useRef<string | null>(null)

  const [checkinModalOpen, setCheckinModalOpen] = useState(false)
  const [checkinModalPayload, setCheckinModalPayload] =
    useState<QrScanResultSheetPayload | null>(null)

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
  const [seatingSyncing, setSeatingSyncing] = useState(false)
  const [notifyingRound, setNotifyingRound] = useState<number | null>(null)

  sessionRef.current = session
  formQuestionsRef.current = formQuestions
  participantsRef.current = participants
  roundsRef.current = rounds
  langTableCountsRef.current = langTableCounts

  const showCheckinModalForResponse = useCallback(
    async (row: {
      id: string
      user_id?: string | null
      answers?: Record<string, unknown> | null
      payment_status?: string | null
      checked_in_at?: string | null
    }) => {
      const s = sessionRef.current
      const questions = formQuestionsRef.current
      if (!s?.id || !row.checked_in_at) return

      const todayStr = todayYYYYMMDDSeoul()
      const currentDay = koreanWeekdayLetterSeoul()
      if (
        !formResponseMatchesTodaySession(
          (row.answers || {}) as Record<string, unknown>,
          todayStr,
          currentDay
        )
      ) {
        return
      }

      const now = Date.now()
      const last = lastCheckinModalRef.current
      if (last && last.id === row.id && now - last.at < 2500) return
      lastCheckinModalRef.current = { id: row.id, at: now }

      try {
        const payload = await buildLangCheckinModalPayload(
          supabase,
          row,
          questions,
          s.id,
          todayStr
        )
        setCheckinModalPayload(payload)
        setCheckinModalOpen(true)
      } catch (e) {
        console.error('[arrange] check-in modal:', e)
      }
    },
    [supabase]
  )

  const scheduleParticipantsRefresh = useCallback(() => {
    if (suppressParticipantRefreshRef.current) return
    if (participantsRefreshTimerRef.current) {
      clearTimeout(participantsRefreshTimerRef.current)
    }
    participantsRefreshTimerRef.current = setTimeout(() => {
      participantsRefreshTimerRef.current = null
      if (suppressParticipantRefreshRef.current) return
      void (async () => {
        const s = sessionRef.current
        const questionsForExtract = formQuestionsRef.current
        if (!s?.form_id) return
        const todayStr = todayYYYYMMDDSeoul()
        const currentDay = koreanWeekdayLetterSeoul()
        const { data: responsesRaw } = await supabase
          .from('form_responses')
          .select('*')
          .eq('form_id', s.form_id)
        const responses = (responsesRaw || []).filter((r) => {
          const ans = (r.answers || {}) as Record<string, unknown>
          const ev = typeof ans._event_date === 'string' ? ans._event_date.slice(0, 10) : ''
          const sel = typeof ans._selected_day === 'string' ? ans._selected_day.trim() : ''
          if (ev === todayStr) return true
          if (!ev && sel === currentDay) return true
          return false
        })
        const mapped: Participant[] = responses.map((r) =>
          mapFormResponseToParticipant(r, questionsForExtract)
        )
        setParticipants(mapped)
        seenCheckedInIdsRef.current = new Set(
          mapped.filter((p) => p.checked_in_at).map((p) => p.id)
        )
      })()
    }, 350)
  }, [supabase])

  const finishApplyingRemoteSeating = useCallback(() => {
    applyingRemoteSeatingRef.current = false
    if (pendingPersistAfterRemoteRef.current) {
      pendingPersistAfterRemoteRef.current = false
      scheduleSeatingPersistRef.current?.()
    }
  }, [])

  const markLocalSeatingEdit = useCallback(() => {
    suppressRemoteReloadRef.current = true
    suppressParticipantRefreshRef.current = true
    if (suppressParticipantRefreshTimerRef.current) {
      clearTimeout(suppressParticipantRefreshTimerRef.current)
    }
    suppressParticipantRefreshTimerRef.current = setTimeout(() => {
      suppressParticipantRefreshRef.current = false
      suppressParticipantRefreshTimerRef.current = null
    }, 1200)
  }, [])

  const scheduleSeatingPersistRef = useRef<(() => void) | null>(null)

  const reloadSeatingFromServer = useCallback(async () => {
    const s = sessionRef.current
    if (!s?.id) return
    if (activeDragIdRef.current) return
    if (suppressRemoteReloadRef.current) return
    if (persistFailedAtRef.current !== 0) return

    const todayStr = todayYYYYMMDDSeoul()
    const currentParticipants = participantsRef.current
    const checkedIds = new Set(
      currentParticipants.filter((p) => p.checked_in_at).map((p) => p.id)
    )

    const { data: postingRow } = await supabase
      .from('postings')
      .select('seating_config')
      .eq('id', s.id)
      .maybeSingle()

    const seatingConfig = (postingRow?.seating_config || s.seating_config || null) as SeatingConfigPayload | null
    const { rounds: loadedRounds, langTableCounts: loadedCounts } = await loadSeatingLiveState(
      supabase,
      s.id,
      todayStr,
      currentParticipants,
      seatingConfig,
      checkedIds
    )

    applyingRemoteSeatingRef.current = true
    setRounds(loadedRounds)
    if (seatingConfig?.langTableCounts) {
      setLangTableCounts(seatingConfig.langTableCounts)
    } else if (Object.keys(loadedCounts).length > 0) {
      setLangTableCounts(loadedCounts)
    }
    requestAnimationFrame(() => {
      finishApplyingRemoteSeating()
    })
  }, [supabase, finishApplyingRemoteSeating])

  const runSeatingPersist = useCallback(async () => {
    const s = sessionRef.current
    if (!s?.id) return

    if (seatingPersistInFlightRef.current) {
      seatingPersistPendingRef.current = true
      return
    }

    seatingPersistInFlightRef.current = true
    const todayStr = todayYYYYMMDDSeoul()
    const currentParticipants = participantsRef.current
    const checkedIds = new Set(
      currentParticipants.filter((p) => p.checked_in_at).map((p) => p.id)
    )

    setSeatingSyncing(true)
    suppressRemoteReloadRef.current = true
    try {
      await persistSeatingLive({
        postingId: s.id,
        sessionDate: todayStr,
        rounds: roundsRef.current,
        langTableCounts: langTableCountsRef.current,
        checkedParticipantIds: checkedIds,
      })
      persistFailedAtRef.current = 0
      setTimeout(() => {
        if (!seatingPersistInFlightRef.current && persistFailedAtRef.current === 0) {
          suppressRemoteReloadRef.current = false
        }
      }, 800)
    } catch (err) {
      persistFailedAtRef.current = Date.now()
      console.error('[arrange] seating persist:', err)
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : '동기화에 실패했습니다.'
      toast.error(msg.length < 200 ? `동기화 실패: ${msg}` : `동기화 실패: ${msg.slice(0, 180)}…`)
      seatingPersistPendingRef.current = true
    } finally {
      setSeatingSyncing(false)
      seatingPersistInFlightRef.current = false
      if (seatingPersistPendingRef.current) {
        seatingPersistPendingRef.current = false
        if (seatingPersistTimerRef.current) {
          clearTimeout(seatingPersistTimerRef.current)
        }
        seatingPersistTimerRef.current = setTimeout(() => {
          seatingPersistTimerRef.current = null
          scheduleSeatingPersistRef.current?.()
        }, 1500)
      }
    }
  }, [])

  const scheduleSeatingPersist = useCallback(() => {
    if (!readyForPersistRef.current) return
    if (applyingRemoteSeatingRef.current) {
      pendingPersistAfterRemoteRef.current = true
      return
    }
    markLocalSeatingEdit()
    if (seatingPersistTimerRef.current) {
      clearTimeout(seatingPersistTimerRef.current)
    }
    seatingPersistTimerRef.current = setTimeout(() => {
      seatingPersistTimerRef.current = null
      void runSeatingPersist()
    }, 300)
  }, [runSeatingPersist, markLocalSeatingEdit])

  scheduleSeatingPersistRef.current = scheduleSeatingPersist

  const flushSeatingPersistSoon = useCallback(() => {
    if (!readyForPersistRef.current) return
    markLocalSeatingEdit()
    if (seatingPersistTimerRef.current) {
      clearTimeout(seatingPersistTimerRef.current)
    }
    seatingPersistTimerRef.current = setTimeout(() => {
      seatingPersistTimerRef.current = null
      void runSeatingPersist()
    }, 50)
  }, [markLocalSeatingEdit, runSeatingPersist])

  useEffect(() => {
    if (!readyForPersistRef.current || !session?.id) return
    if (applyingRemoteSeatingRef.current) {
      pendingPersistAfterRemoteRef.current = true
      return
    }
    scheduleSeatingPersist()
  }, [rounds, langTableCounts, session?.id, scheduleSeatingPersist])

  useEffect(() => {
    return () => {
      if (seatingPersistTimerRef.current) {
        clearTimeout(seatingPersistTimerRef.current)
      }
      if (suppressParticipantRefreshTimerRef.current) {
        clearTimeout(suppressParticipantRefreshTimerRef.current)
      }
    }
  }, [])

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

  const seatingCollisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerHits = pointerWithin(args)
    if (pointerHits.length > 0) {
      const containerHit = pointerHits.find((c) => c.data?.current?.type === 'container')
      if (containerHit) return [containerHit]
      return pointerHits
    }
    return closestCenter(args)
  }, [])

  useEffect(() => {
    void fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [supabase])

  useEffect(() => {
    const formId = session?.form_id
    if (!formId) return

    const channel = supabase
      .channel(`checkin-updates-${formId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'form_responses',
          filter: `form_id=eq.${formId}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string
            user_id?: string | null
            answers?: Record<string, unknown> | null
            payment_status?: string | null
            payment_receipt_url?: string | null
            checked_in_at?: string | null
            created_at?: string | null
          }

          const rowId = row?.id
          const answers = (row.answers || {}) as Record<string, unknown>

          if (rowId && payload.eventType === 'UPDATE') {
            const questions = formQuestionsRef.current
            const patched = mapFormResponseToParticipant(
              {
                id: rowId,
                user_id: row.user_id,
                answers: row.answers,
                checked_in_at: row.checked_in_at,
                created_at: row.created_at,
                payment_status: row.payment_status,
                payment_receipt_url: row.payment_receipt_url,
              },
              questions
            )
            setParticipants((prev) => {
              const idx = prev.findIndex((p) => p.id === rowId)
              if (idx === -1) {
                if (!suppressParticipantRefreshRef.current) scheduleParticipantsRefresh()
                return prev
              }
              const next = [...prev]
              next[idx] = patched
              participantsRef.current = next
              return next
            })
            setEditingParticipant((prev) => (prev?.id === rowId ? patched : prev))
          } else if (!suppressParticipantRefreshRef.current) {
            scheduleParticipantsRefresh()
          }

          if (
            rowId &&
            row.checked_in_at &&
            !seenCheckedInIdsRef.current.has(rowId)
          ) {
            seenCheckedInIdsRef.current.add(rowId)
            if (
              !isWalkInAnswers(answers) &&
              answers._checkin_source !== ADMIN_CHECKIN_SOURCE_DRAG
            ) {
              void showCheckinModalForResponse({ ...row, id: rowId })
            }
          }
        }
      )
      .subscribe()

    return () => {
      if (participantsRefreshTimerRef.current) {
        clearTimeout(participantsRefreshTimerRef.current)
        participantsRefreshTimerRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [
    supabase,
    session?.form_id,
    scheduleParticipantsRefresh,
    showCheckinModalForResponse,
  ])

  useEffect(() => {
    const postingId = session?.id
    if (!postingId) return

    const channel = supabase
      .channel(`seating-live-${postingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seating_assignments',
          filter: `posting_id=eq.${postingId}`,
        },
        () => {
          if (suppressRemoteReloadRef.current) return
          void reloadSeatingFromServer()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, session?.id, reloadSeatingFromServer])

  const fetchData = async () => {
    readyForPersistRef.current = false
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

      if (!profile?.is_superadmin && !isSuperAdminEmail(user.email)) {
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
      const seatingConfig = (foundSession.seating_config || null) as SeatingConfigPayload | null
      if (seatingConfig?.langTableCounts) {
        setLangTableCounts(seatingConfig.langTableCounts)
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

      const mapped: Participant[] = responses.map((r) =>
        mapFormResponseToParticipant(r, questionsForExtract)
      )
      setParticipants(mapped)
      seenCheckedInIdsRef.current = new Set(
        mapped.filter((p) => p.checked_in_at).map((p) => p.id)
      )

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

      const checkedIds = new Set(mapped.filter((p) => p.checked_in_at).map((p) => p.id))
      const { rounds: loadedRounds } = await loadSeatingLiveState(
        supabase,
        foundSession.id,
        todayStr,
        mapped,
        seatingConfig,
        checkedIds
      )
      if (loadedRounds.some((r) => r.assignments.length > 0)) {
        applyingRemoteSeatingRef.current = true
        setRounds(loadedRounds)
        requestAnimationFrame(() => {
          finishApplyingRemoteSeating()
          readyForPersistRef.current = true
        })
      } else {
        readyForPersistRef.current = true
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
    () => sortParticipantsByNameAsc(participants.filter((p) => !p.checked_in_at)),
    [participants]
  )

  const unassignedForCurrentRound = useMemo(() => {
    const assignments = rounds.find((r) => r.round === currentRound)?.assignments || []
    const unassigned = participants.filter(
      (p) =>
        Boolean(p.checked_in_at) &&
        !assignments.some((a) => a.participant_id === p.id)
    )
    return sortParticipantsByRecencyDesc(unassigned)
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

    const quality = evaluateRoundQuality(newRoundData, updatedRounds, dbgParticipants)
    if (quality.duplicatedPairCount > 0) {
      toast.warning(formatDuplicateWarningMessage(quality), { duration: 12000 })
    }

    toast.success(`${configRound}라운드 배치가 완료되었습니다.`)
    setCurrentRound(configRound)
    setIsConfigOpen(false)
    setConfigRound(null)
  }, [configRound, configCounts, participants, rounds, session])

  const tableLanguageOptions = useMemo(() => {
    const langs = new Set<string>()
    for (const p of participants) {
      if (p.language && p.language !== '-' && isSupportedLanguage(p.language)) {
        langs.add(p.language)
      }
    }
    for (const lang of Object.keys(langTableCounts)) {
      if (isSupportedLanguage(lang)) langs.add(lang)
    }
    if (langs.size === 0) {
      for (const lang of SUPPORTED_LANGUAGES) langs.add(lang)
    }
    return [...langs].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [participants, langTableCounts])

  const handleAddTable = useCallback(
    (roundNum: number, language: string) => {
      const roundData = roundsRef.current.find((r) => r.round === roundNum)
      if (!roundData) return

      const result = addTableToRound(roundData, language)
      if (!result) {
        toast.error('테이블은 최대 26개(A~Z)까지 추가할 수 있습니다.')
        return
      }

      markLocalSeatingEdit()
      const updated = roundsRef.current.map((r) => (r.round === roundNum ? result.roundData : r))
      setLangTableCounts(
        mergeLangTableCounts(langTableCountsRef.current, result.roundData.tableLanguages ?? {})
      )
      setRounds(updated)
      toast.success(`${result.label} 테이블이 추가되었습니다. (${language})`)
    },
    [markLocalSeatingEdit]
  )

  const handleDeleteTable = useCallback(
    (roundNum: number, label: string) => {
      const roundData = roundsRef.current.find((r) => r.round === roundNum)
      if (!roundData) return

      const atTable = roundData.assignments.filter((a) => a.table_label === label).length
      if (atTable > 0) {
        const ok = window.confirm(
          `이 테이블을 삭제할까요? ${atTable}명이 미배정으로 이동합니다.`
        )
        if (!ok) return
      }

      const { roundData: nextRound, removedAssignmentCount } = removeTableFromRound(
        roundData,
        label
      )
      markLocalSeatingEdit()
      const updated = roundsRef.current.map((r) => (r.round === roundNum ? nextRound : r))
      setLangTableCounts(langTableCountsFromRounds(updated))
      setRounds(updated)

      if (removedAssignmentCount > 0) {
        toast.success(`${label} 테이블 삭제 · ${removedAssignmentCount}명 미배정`)
      } else {
        toast.success(`${label} 테이블이 삭제되었습니다.`)
      }
    },
    [markLocalSeatingEdit]
  )

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
    if (newParticipant.checked_in_at) {
      seenCheckedInIdsRef.current.add(newParticipant.id)
    }

    setParticipants((prev) => {
      const exists = prev.find((p) => p.id === newParticipant.id)
      if (exists) {
        return prev.map((p) => (p.id === newParticipant.id ? { ...p, ...newParticipant } : p))
      }
      return [...prev, newParticipant]
    })

    if (!newParticipant.checked_in_at) {
      toast.info(
        `${newParticipant.name}님은 현장 QR 체크인 전입니다. 미체크인 목록에서 미배정 또는 테이블로 드래그하면 체크인 후 이동·배정할 수 있습니다.`,
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
    const previousRounds = rounds.filter(
      (r) => r.round < targetRound && r.assignments.length > 0
    )
    const allAttendees = [...participants.filter((p) => p.checked_in_at), newParticipant]
    const bestTable = pickBestTableForLateJoin(
      newParticipant,
      roundData.assignments,
      tableLanguages,
      allAttendees,
      previousRounds
    )

    if (!bestTable) {
      toast.warning(
        `${newParticipant.name}님이 추가되었습니다. ${targetRound}라운드에 ${newParticipant.language} 테이블이 없어 미배정 상태입니다.`,
        { duration: 5000 }
      )
      return
    }

    setRounds((prev) => {
      const updated = [...prev]
      const roundIdx = updated.findIndex((r) => r.round === targetRound)
      if (roundIdx !== -1) {
        updated[roundIdx] = {
          ...updated[roundIdx],
          assignments: [
            ...updated[roundIdx].assignments,
            { participant_id: newParticipant.id, table_label: bestTable },
          ],
        }
      }
      return updated
    })

    toast.success(
      `${newParticipant.name}님이 ${targetRound}라운드 ${bestTable} 테이블에 배치되었습니다.`,
      { duration: 5000 }
    )
  }

  const applyLanguageReassignment = useCallback(
    (oldParticipant: Participant, updated: Participant) => {
      if (oldParticipant.language === updated.language) return

      const currentRoundData = roundsRef.current.find((r) => r.round === currentRound)
      if (!currentRoundData || currentRoundData.assignments.length === 0) return

      const currentAssignment = currentRoundData.assignments.find(
        (a) => a.participant_id === updated.id
      )
      if (!currentAssignment) return

      const tableLanguages = currentRoundData.tableLanguages || {}
      const currentTableLang = tableLanguages[currentAssignment.table_label]
      if (currentTableLang === updated.language) return

      const assignmentsByTable = _.groupBy(currentRoundData.assignments, 'table_label')
      const matchingTables = Object.keys(tableLanguages).filter(
        (label) => tableLanguages[label] === updated.language
      )

      if (matchingTables.length > 0) {
        let minTable = matchingTables[0]
        let minCount = (assignmentsByTable[minTable] || []).length

        matchingTables.forEach((label) => {
          const count = (assignmentsByTable[label] || []).length
          if (count < minCount) {
            minCount = count
            minTable = label
          }
        })

        markLocalSeatingEdit()
        setRounds((prev) => {
          const updatedRounds = [...prev]
          const roundIdx = updatedRounds.findIndex((r) => r.round === currentRound)
          if (roundIdx !== -1) {
            updatedRounds[roundIdx] = {
              ...updatedRounds[roundIdx],
              assignments: updatedRounds[roundIdx].assignments.map((a) =>
                a.participant_id === updated.id ? { ...a, table_label: minTable } : a
              ),
            }
          }
          roundsRef.current = updatedRounds
          return updatedRounds
        })

        toast.success(
          `${updated.name}님의 언어가 ${updated.language}로 변경되어 ${minTable}테이블로 재배정되었습니다.`,
          { duration: 5000 }
        )
        return
      }

      markLocalSeatingEdit()
      setRounds((prev) => {
        const updatedRounds = [...prev]
        const roundIdx = updatedRounds.findIndex((r) => r.round === currentRound)
        if (roundIdx !== -1) {
          updatedRounds[roundIdx] = {
            ...updatedRounds[roundIdx],
            assignments: updatedRounds[roundIdx].assignments.filter(
              (a) => a.participant_id !== updated.id
            ),
          }
        }
        roundsRef.current = updatedRounds
        return updatedRounds
      })

      toast.warning(
        `${updated.name}님의 언어가 ${updated.language}로 변경되었으나, 현재 라운드에 해당 언어 테이블이 없어 미배정 상태입니다.`,
        { duration: 5000 }
      )
    },
    [currentRound, markLocalSeatingEdit]
  )

  const handleParticipantFieldSave = useCallback(
    async (updated: Participant): Promise<boolean> => {
      const oldParticipant = participantsRef.current.find((p) => p.id === updated.id)
      if (!oldParticipant) return false

      const body: Record<string, string | null | undefined> = {
        name: updated.name,
        gender: updated.gender,
        nationality: updated.nationality,
        language: updated.language,
      }
      if (updated.paymentMethod) {
        body.paymentMethod = updated.paymentMethod
      }

      let persisted = updated
      try {
        if (updated.isWalkIn) {
          const res = await fetch(`/api/admin/walk-in-participant/${updated.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = (await res.json().catch(() => ({}))) as {
            error?: string
            participant?: Participant
          }
          if (!res.ok || !data.participant) {
            toast.error(data.error || '참가자 정보 저장에 실패했습니다.')
            return false
          }
          persisted = data.participant
        } else {
          const res = await fetch(`/api/admin/form-response-participant/${updated.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = (await res.json().catch(() => ({}))) as {
            error?: string
            participant?: Participant
          }
          if (!res.ok || !data.participant) {
            toast.error(data.error || '참가자 정보 저장에 실패했습니다.')
            return false
          }
          persisted = data.participant
        }
      } catch (err) {
        console.error(err)
        toast.error('참가자 정보 저장에 실패했습니다.')
        return false
      }

      markLocalSeatingEdit()
      setParticipants((prev) => {
        const next = prev.map((p) => (p.id === persisted.id ? persisted : p))
        participantsRef.current = next
        return next
      })
      setEditingParticipant((prev) => (prev?.id === persisted.id ? persisted : prev))
      applyLanguageReassignment(oldParticipant, persisted)
      return true
    },
    [applyLanguageReassignment, markLocalSeatingEdit]
  )

  const handleReceiptUpload = useCallback(
    async (participantId: string, file: File): Promise<Participant | null> => {
      const oldParticipant = participantsRef.current.find((p) => p.id === participantId)
      if (!oldParticipant) return null

      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch(`/api/admin/form-response-participant/${participantId}`, {
          method: 'POST',
          body: formData,
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          participant?: Participant
        }
        if (!res.ok || !data.participant) {
          toast.error(data.error || '영수증 업로드에 실패했습니다.')
          return null
        }

        const persisted = data.participant
        markLocalSeatingEdit()
        setParticipants((prev) => {
          const next = prev.map((p) => (p.id === persisted.id ? persisted : p))
          participantsRef.current = next
          return next
        })
        setEditingParticipant((prev) => (prev?.id === persisted.id ? persisted : prev))
        toast.success('영수증이 업로드되었습니다.')
        return persisted
      } catch (err) {
        console.error(err)
        toast.error('영수증 업로드에 실패했습니다.')
        return null
      }
    },
    [markLocalSeatingEdit]
  )

  const [deletingParticipantId, setDeletingParticipantId] = useState<string | null>(null)

  const handleDeleteParticipant = async (p: Participant) => {
    try {
      setDeletingParticipantId(p.id)

      const { error: responseErr } = await supabase.rpc('admin_delete_form_response', {
        p_response_id: p.id,
        p_refund_coupon: true,
      })
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

  const handleNotifyParticipants = useCallback(
    async (roundNum: number) => {
      const sessionForNotify = session
      if (!sessionForNotify?.id) return

      const roundData = roundsRef.current.find((r) => r.round === roundNum)
      if (!roundData || roundData.assignments.length === 0) {
        toast.error(`${roundNum}라운드에 배정된 참가자가 없습니다.`)
        return
      }

      if (seatingPersistTimerRef.current) {
        clearTimeout(seatingPersistTimerRef.current)
        seatingPersistTimerRef.current = null
        await runSeatingPersist()
      }

      const attendees = participantsRef.current.filter((p) => p.checked_in_at)
      setNotifyingRound(roundNum)
      try {
        const res = await fetch('/api/admin/notify-seating-round', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postingId: sessionForNotify.id,
            sessionDate: todayYYYYMMDDSeoul(),
            round: roundNum,
            tableLanguages: roundData.tableLanguages || {},
            assignments: roundData.assignments,
            participants: attendees.map((p) => ({
              id: p.id,
              name: p.name,
              nationality: String(p.nationality),
              gender: String(p.gender),
              language: p.language,
            })),
            eventTitle: sessionForNotify.title || 'LangBuddy',
          }),
        })
        const j = (await res.json().catch(() => ({}))) as {
          sent?: { kakao?: number; email?: number; skipped?: number }
          errors?: string[]
          message?: string
          debug?: {
            summary?: Record<string, unknown>
            steps?: string[]
            recipients?: unknown[]
          }
        }
        if (!res.ok) {
          console.error('[seating-notify] HTTP error', res.status, j.debug ?? j)
          toast.error(`참가자 알림 실패 (${res.status}): ${j.message || 'see console'}`)
          return
        }
        if (j.debug && typeof console !== 'undefined') {
          console.groupCollapsed('[seating-notify] debug')
          console.log('summary', j.debug.summary)
          console.log('steps', j.debug.steps)
          if (j.debug.recipients?.length) console.table(j.debug.recipients)
          if (j.errors?.length) console.warn('errors', j.errors)
          console.groupEnd()
        }
        const s = j.sent
        toast.success(
          `${roundNum}라운드 알림 완료 — 카카오 ${s?.kakao ?? 0} · 이메일 ${s?.email ?? 0} · 건너뜀 ${s?.skipped ?? 0}`
        )
        if (j.errors?.length) {
          toast.info(`알림 일부 오류: ${j.errors.slice(0, 4).join(' · ')}`, {
            duration: 12000,
          })
        }
      } catch {
        toast.error('참가자 알림 요청 중 오류')
      } finally {
        setNotifyingRound(null)
      }
    },
    [runSeatingPersist, session]
  )

  // --- DnD Handlers ---

  const onDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string
    activeDragIdRef.current = id
    markLocalSeatingEdit()
    setActiveId(id)
  }

  const showReunionHint = useCallback((maxReunions: number, toastId: string) => {
    toast.info(
      `이 테이블에는 이전 라운드에서 ${maxReunions}번 만난 참가자가 있습니다. 배치는 적용됩니다.`,
      { id: toastId, duration: 5000 }
    )
  }, [])

  const applyOptimisticCheckin = useCallback(
    (participantId: string) => {
      const checkedInAt = new Date().toISOString()
      seenCheckedInIdsRef.current.add(participantId)
      markLocalSeatingEdit()
      setParticipants((prev) => {
        const next = prev.map((p) =>
          p.id === participantId ? { ...p, checked_in_at: checkedInAt } : p
        )
        participantsRef.current = next
        return next
      })
      return checkedInAt
    },
    [markLocalSeatingEdit]
  )

  const revertOptimisticCheckin = useCallback((participantId: string) => {
    seenCheckedInIdsRef.current.delete(participantId)
    setParticipants((prev) => {
      const next = prev.map((p) =>
        p.id === participantId ? { ...p, checked_in_at: null } : p
      )
      participantsRef.current = next
      return next
    })
  }, [])

  const syncCheckinToServer = useCallback(
    async (participantId: string, source: string = ADMIN_CHECKIN_SOURCE_DRAG) => {
      try {
        const res = await fetch('/api/admin/manual-checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            responseId: participantId,
            source,
          }),
        })
        if (!res.ok) throw new Error('checkin_failed')
        const data = (await res.json()) as { checked_in_at?: string }
        if (data.checked_in_at) {
          setParticipants((prev) => {
            const next = prev.map((p) =>
              p.id === participantId ? { ...p, checked_in_at: data.checked_in_at! } : p
            )
            participantsRef.current = next
            return next
          })
        }
        return true
      } catch {
        revertOptimisticCheckin(participantId)
        toast.error('체크인 처리에 실패했습니다.')
        return false
      }
    },
    [revertOptimisticCheckin]
  )

  const handleModalCheckin = useCallback(
    async (participant: Participant) => {
      applyOptimisticCheckin(participant.id)
      const ok = await syncCheckinToServer(participant.id, ADMIN_CHECKIN_SOURCE_MODAL)
      if (ok) {
        setEditingParticipant(null)
      }
    },
    [applyOptimisticCheckin, syncCheckinToServer]
  )

  const handleModalUncheckin = useCallback(
    async (participant: Participant) => {
      const prevCheckedInAt = participant.checked_in_at
      const prevRounds = structuredClone(roundsRef.current) as RoundData[]

      seenCheckedInIdsRef.current.delete(participant.id)
      markLocalSeatingEdit()
      setParticipants((prev) => {
        const next = prev.map((p) =>
          p.id === participant.id ? { ...p, checked_in_at: null } : p
        )
        participantsRef.current = next
        return next
      })
      setRounds((prev) => {
        const next = prev.map((r) => ({
          ...r,
          assignments: r.assignments.filter((a) => a.participant_id !== participant.id),
        }))
        roundsRef.current = next
        return next
      })
      scheduleSeatingPersist()

      try {
        const res = await fetch('/api/admin/manual-uncheckin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responseId: participant.id }),
        })
        if (!res.ok) throw new Error('uncheckin_failed')
        setEditingParticipant(null)
      } catch {
        if (prevCheckedInAt) {
          seenCheckedInIdsRef.current.add(participant.id)
        }
        setParticipants((prev) => {
          const next = prev.map((p) =>
            p.id === participant.id ? { ...p, checked_in_at: prevCheckedInAt } : p
          )
          participantsRef.current = next
          return next
        })
        setRounds(prevRounds)
        roundsRef.current = prevRounds
        scheduleSeatingPersist()
        toast.error('체크인 해제에 실패했습니다.')
        throw new Error('uncheckin_failed')
      }
    },
    [markLocalSeatingEdit, scheduleSeatingPersist]
  )

  const applyRoundAssignmentUpdate = useCallback(
    (targetRound: number, updater: (assignments: RoundData['assignments']) => RoundData['assignments']) => {
      markLocalSeatingEdit()
      setRounds((prev) => {
        const newRounds = [...prev]
        const roundIdx = newRounds.findIndex((r) => r.round === targetRound)
        if (roundIdx === -1) return prev
        const currentAssignments = [...(newRounds[roundIdx].assignments || [])]
        newRounds[roundIdx] = {
          ...newRounds[roundIdx],
          assignments: updater(currentAssignments),
        }
        roundsRef.current = newRounds
        return newRounds
      })
    },
    [markLocalSeatingEdit]
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    try {
      if (!over || !active) return

      const activeId = active.id as string
      const overId = over.id as string
      const activeParticipant = participantsRef.current.find((p) => p.id === activeId)
      if (!activeParticipant) return

      let assignmentChanged = false
      const commitAssignment = (targetRound: number, tableLabel: string | null) => {
        assignmentChanged = true
        applyRoundAssignmentUpdate(targetRound, (currentAssignments) =>
          setParticipantTableAssignment(currentAssignments, activeId, tableLabel)
        )
      }

      const overContainerRound =
      over.data?.current?.type === 'container' && over.data.current.round != null
        ? Number(over.data.current.round)
        : currentRound
    const targetRound = Number.isFinite(overContainerRound) ? overContainerRound : currentRound
    const roundData = roundsRef.current.find((r) => r.round === targetRound)
    const roundAssignments = roundData?.assignments || []

    const isOverTable = over.data?.current?.type === 'container'
    const isOverUnassignedContainer =
      isOverTable && over.data.current?.tableLabel === 'unassigned'
    const isOverUnassignedId = String(overId).startsWith('unassigned-')
    const isOverUnassignedParticipant = (() => {
      const hit = participantsRef.current.find((p) => p.id === overId)
      if (!hit?.checked_in_at) return false
      return !roundAssignments.some((a) => a.participant_id === overId)
    })()
    const isOverUnassigned =
      isOverUnassignedContainer || isOverUnassignedId || isOverUnassignedParticipant

    let assignTableLabel: string | null = null

    if (isOverTable && over.data.current) {
      const newTableLabel = over.data.current.tableLabel as string
      if (newTableLabel !== 'unassigned') {
        assignTableLabel = newTableLabel
      }
    } else {
      const activeAssignment = roundAssignments.find((a) => a.participant_id === activeId)
      const overAssignment = roundAssignments.find((a) => a.participant_id === overId)

      if (overAssignment && overAssignment.table_label !== activeAssignment?.table_label) {
        assignTableLabel = overAssignment.table_label
      }
    }

    if (assignTableLabel) {
      const tableRoundData = roundsRef.current.find((r) => r.round === targetRound)
      const tableLang = tableRoundData?.tableLanguages?.[assignTableLabel]
      if (tableLang && tableLang !== activeParticipant.language) {
        toast.error(
          `언어가 다릅니다: ${activeParticipant.language} 참가자는 ${tableLang} 테이블에 앉을 수 없습니다.`,
          { id: 'lang-mismatch' }
        )
        return
      }
    }

    if (!activeParticipant.checked_in_at) {
      if (!assignTableLabel && !isOverUnassigned) {
        return
      }
      if (assignTableLabel) {
        const ok = window.confirm(
          `${activeParticipant.name}님을 QR 체크인 없이 배정합니다.\n\n운영자 확인으로 체크인 처리한 뒤 테이블에 배치합니다. 계속할까요?`
        )
        if (!ok) return
      }
      applyOptimisticCheckin(activeId)
      void syncCheckinToServer(activeId)
    }

    if (isOverUnassigned && !assignTableLabel) {
      commitAssignment(targetRound, null)
      flushSeatingPersistSoon()
      return
    }

    if (isOverTable && over.data.current) {
      const newTableLabel = over.data.current.tableLabel as string

      if (newTableLabel === 'unassigned') {
        commitAssignment(targetRound, null)
      } else {
        const currentRoundData = roundsRef.current.find((r) => r.round === targetRound)

        const previousRoundsForDrag = roundsRef.current.filter(
          (r) => r.round < targetRound && r.assignments.length > 0
        )
        const { maxReunions } = reunionCountIfJoinedTable(
          activeId,
          newTableLabel,
          currentRoundData?.assignments || [],
          previousRoundsForDrag
        )
        if (maxReunions > 0) {
          showReunionHint(maxReunions, 'reunion-hint')
        }

        commitAssignment(targetRound, newTableLabel)
      }
    } else {
      const currentRoundData = roundsRef.current.find((r) => r.round === targetRound)
      const currentRoundAssignments = currentRoundData?.assignments || []
      const activeAssignment = currentRoundAssignments.find((a) => a.participant_id === activeId)
      const overAssignment = currentRoundAssignments.find((a) => a.participant_id === overId)

      if (overAssignment && overAssignment.table_label !== activeAssignment?.table_label) {
        const newTableLabel = overAssignment.table_label

        const previousRoundsForDrag = roundsRef.current.filter(
          (r) => r.round < targetRound && r.assignments.length > 0
        )
        const { maxReunions } = reunionCountIfJoinedTable(
          activeId,
          newTableLabel,
          currentRoundAssignments,
          previousRoundsForDrag
        )
        if (maxReunions > 0) {
          showReunionHint(maxReunions, 'reunion-hint-participant')
        }

        commitAssignment(targetRound, newTableLabel)
      } else if (!overAssignment && activeAssignment) {
        commitAssignment(targetRound, null)
      }
    }

    if (assignmentChanged) {
      flushSeatingPersistSoon()
    }
    } finally {
      activeDragIdRef.current = null
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
            <Button
              type="button"
              variant="default"
              className="rounded-xl font-black gap-2"
              disabled={
                notifyingRound !== null ||
                (rounds.find((r) => r.round === currentRound)?.assignments.length ?? 0) === 0
              }
              onClick={() => void handleNotifyParticipants(currentRound)}
            >
              {notifyingRound === currentRound ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              참가자 알림
            </Button>
            {seatingSyncing ? (
              <span className="text-xs font-bold text-muted-foreground self-center px-1">
                동기화 중…
              </span>
            ) : null}
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
        collisionDetection={seatingCollisionDetection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
          {/* Statistics & Participants Sidebar */}
          <aside className="space-y-6">
            <ParticipantAdder 
              onAddParticipant={handleAddParticipant}
              formId={session?.form_id || ''}
              sessionDate={todayYYYYMMDDSeoul()}
              selectedDay={koreanWeekdayLetterSeoul()}
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
                const tableLabelsForRound = sortTableLabels(
                  Object.keys(roundData?.tableLanguages || {})
                )
                const canAddTable =
                  getNextTableLabel(tableLabelsForRound) !== null
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
                            onDelete={() => handleDeleteTable(r, label)}
                          />
                        )
                      })}
                      <AddTableCard
                        languages={tableLanguageOptions}
                        disabled={!canAddTable}
                        onAdd={(lang) => handleAddTable(r, lang)}
                      />
                    </div>
                    {tableLabelsForRound.length === 0 ? (
                      <p className="text-center text-sm font-bold text-muted-foreground mt-4">
                        테이블이 없습니다. 「테이블 추가」로 빈 테이블을 만든 뒤 드래그하거나, 위에서「배치」를 실행하세요.
                      </p>
                    ) : null}
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
          onFieldSave={handleParticipantFieldSave}
          onReceiptUpload={handleReceiptUpload}
          onCheckin={handleModalCheckin}
          onUncheckin={handleModalUncheckin}
          onDelete={handleDeleteParticipant}
          isDeleting={deletingParticipantId === editingParticipant.id}
        />
      )}

      <QrScanResultSheet
        open={checkinModalOpen}
        onOpenChange={(open) => {
          setCheckinModalOpen(open)
          if (!open) setCheckinModalPayload(null)
        }}
        payload={checkinModalPayload}
      />
    </div>
  )
}
