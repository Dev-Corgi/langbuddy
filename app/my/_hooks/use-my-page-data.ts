'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { extractParticipantInfoFromAnswers } from '@/lib/utils'
import {
  todayYYYYMMDDSeoul,
  resolveApplicationSessionYmd,
  buildRecurringSessionDisplayTitles,
} from '@/lib/session-event-date'
import type { AppCategory, ApplicationRow, SeatingMemory, SeatingSession } from '../_lib/types'

export function useMyPageData(isEn: boolean) {
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [userRow, setUserRow] = useState<{
    name?: string
  } | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [seatingHistory, setSeatingHistory] = useState<SeatingMemory[]>([])
  const [seatingSessions, setSeatingSessions] = useState<SeatingSession[]>([])
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setReady(false)
    const {
      data: { user: u },
    } = await supabase.auth.getUser()
    setUser(u)
    if (!u) {
      setShowAuth(true)
      setUserRow(null)
    setApplications([])
    setSeatingHistory([])
    setSeatingSessions([])
    setMarkedDates(new Set())
      setReady(true)
      return
    }
    setShowAuth(false)

    const { data: profile } = await supabase
      .from('users')
      .select('name')
      .eq('id', u.id)
      .single()
    setUserRow(profile || {})

    const [{ data: leSched }, { data: postingRows }] = await Promise.all([
      supabase.from('language_exchange_schedules').select('form_id, posting_id').eq('is_active', true),
      supabase.from('postings').select('id, form_id, category, title, title_en').eq('status', 'active'),
    ])

    const leFormIds = new Set((leSched || []).map((r) => r.form_id).filter(Boolean) as string[])

    function categoryForForm(fid: string): AppCategory {
      if (leFormIds.has(fid)) return '언어교환'
      return '번개'
    }

    const { data: responses } = await supabase
      .from('form_responses')
      .select('id, form_id, answers, created_at, forms(title, title_en)')
      .eq('user_id', u.id)
      .order('created_at', { ascending: false })

    const marks = new Set<string>()
    const apps: ApplicationRow[] = []

    for (const r of responses || []) {
      const fid = r.form_id as string
      const cat = categoryForForm(fid)
      const formTitle = (r as { forms?: { title?: string; title_en?: string } }).forms?.title || ''
      const formTitleEn = (r as { forms?: { title?: string; title_en?: string } }).forms?.title_en || ''
      const ans = (r.answers || {}) as Record<string, unknown>
      const eventDate = resolveApplicationSessionYmd(ans._selected_day, ans._event_date, r.created_at as string)
      marks.add(eventDate)

      const recurringKind = cat === '언어교환' ? ('language' as const) : null
      const builtTitles =
        recurringKind && eventDate.length >= 10
          ? buildRecurringSessionDisplayTitles(ans._selected_day, eventDate, recurringKind)
          : null
      const listingTitle = builtTitles
        ? isEn
          ? builtTitles.title_en
          : builtTitles.title
        : isEn && formTitleEn
          ? formTitleEn
          : formTitle

      let meetupHref: string | undefined
      if (cat === '언어교환') meetupHref = '/posting/language'
      else {
        const hit = (postingRows || []).find((p) => p.form_id === fid && p.category === '번개')
        if (hit?.id) meetupHref = `/posting/${hit.id}`
      }

      apps.push({
        id: r.id,
        form_id: fid,
        created_at: r.created_at,
        answers: ans,
        category: cat,
        label: listingTitle,
        eventDate,
        applicationHref: `/apply/complete?id=${r.id}`,
        meetupHref,
      })
    }

    setApplications(apps)
    setMarkedDates(marks)

    const leResponses = (responses || []).filter((r) => leFormIds.has(r.form_id as string))
    const myParticipantIds = leResponses.map((r) => r.id)

    // 실시간(이번 주) 자리배치 — 매주 일요일 초기화되므로 지난 주 이전 기록은 여기 없음.
    const history: SeatingMemory[] = []
    if (myParticipantIds.length > 0) {
      const { data: myAssignments } = await supabase
        .from('seating_assignments')
        .select('*')
        .in('participant_id', myParticipantIds)

      if (myAssignments?.length) {
        const resById = Object.fromEntries(leResponses.map((r) => [r.id, r])) as Record<
          string,
          { answers?: Record<string, unknown> }
        >

        // Batch-fetch ALL seating assignments for the same postings+sessions at once
        // to avoid N+1 queries per assignment row.
        const myParticipantIdSet = new Set(myParticipantIds)
        const uniquePostingIds = [...new Set(myAssignments.map((a) => a.posting_id as string))]
        const uniqueSessionDates = [
          ...new Set(myAssignments.map((a) => a.session_date as string | null)),
        ].filter((d): d is string => !!d)

        // One query: all assignments for these postings (may include other sessions, filtered locally)
        let allSessionAssignmentsQuery = supabase
          .from('seating_assignments')
          .select('participant_id, posting_id, round, table_label, session_date')
          .in('posting_id', uniquePostingIds)
        if (uniqueSessionDates.length > 0) {
          allSessionAssignmentsQuery = allSessionAssignmentsQuery.in('session_date', uniqueSessionDates)
        }
        const { data: allSessionAssignments } = await allSessionAssignmentsQuery

        // Build a lookup: `posting_id|session_date|round|table_label` → participant_id[]
        const tableParticipants = new Map<string, string[]>()
        for (const row of allSessionAssignments || []) {
          const tableKey = `${row.posting_id}|${row.session_date ?? ''}|${row.round}|${row.table_label}`
          const existing = tableParticipants.get(tableKey)
          if (existing) {
            existing.push(row.participant_id as string)
          } else {
            tableParticipants.set(tableKey, [row.participant_id as string])
          }
        }

        // Collect ALL unique mate participant_ids across all assignments in one pass
        const allMateIds = new Set<string>()
        for (const a of myAssignments) {
          const tableKey = `${a.posting_id}|${a.session_date ?? ''}|${a.round}|${a.table_label}`
          const pids = tableParticipants.get(tableKey) || []
          for (const pid of pids) {
            if (!myParticipantIdSet.has(pid)) allMateIds.add(pid)
          }
        }

        // One batch fetch for all mate form_responses
        const mateAnswersById: Record<string, Record<string, unknown>> = {}
        if (allMateIds.size > 0) {
          const { data: matesRows } = await supabase
            .from('form_responses')
            .select('id, answers')
            .in('id', [...allMateIds])
          for (const row of matesRows || []) {
            mateAnswersById[row.id as string] = (row.answers || {}) as Record<string, unknown>
          }
        }

        const seen = new Set<string>()

        for (const a of myAssignments) {
          const fr = resById[a.participant_id as string]
          const ev =
            (a.session_date as string) ||
            (typeof fr?.answers?._event_date === 'string'
              ? String(fr.answers._event_date).slice(0, 10)
              : null) ||
            todayYYYYMMDDSeoul()
          const dayKo = typeof fr?.answers?._selected_day === 'string' ? String(fr.answers._selected_day) : ''
          const key = `${a.posting_id}|${ev}|${a.round}|${a.table_label}|${a.participant_id}`
          if (seen.has(key)) continue
          seen.add(key)

          const tableKey = `${a.posting_id}|${a.session_date ?? ''}|${a.round}|${a.table_label}`
          const mateIds = (tableParticipants.get(tableKey) || [])
            .filter((pid) => !myParticipantIdSet.has(pid))

          const mateNames = mateIds.map((pid) => {
            const ans = mateAnswersById[pid]
            if (!ans) return '?'
            return extractParticipantInfoFromAnswers(ans, []).name || '?'
          })

          history.push({
            key,
            posting_id: a.posting_id as string,
            session_date: (a.session_date as string) || ev,
            round: a.round as number,
            table_label: String(a.table_label),
            dayLabel: dayKo,
            mateNames,
          })
        }
      }
    }

    // 지난 주 이전 기록 — 매주 초기화 전에 스냅샷으로 보관된 아카이브 (최대 2개월)
    const { data: archivedRows } = await supabase
      .from('le_participation_archive')
      .select('response_id, posting_id, session_date, round, table_label, day_label, mates')
      .eq('user_id', u.id)

    for (const a of archivedRows || []) {
      const key = `archive|${a.response_id}|${a.round}`
      history.push({
        key,
        posting_id: a.posting_id as string,
        session_date: a.session_date as string | null,
        round: a.round as number,
        table_label: String(a.table_label),
        dayLabel: (a.day_label as string) || '',
        mateNames: ((a.mates as Array<{ name?: string }> | null) || []).map((m) => m.name || '?'),
      })
    }

    if (history.length === 0) {
      setSeatingHistory([])
      setSeatingSessions([])
      setReady(true)
      return
    }

    history.sort((x, y) => {
      const da = (x.session_date || '').localeCompare(y.session_date || '')
      if (da !== 0) return -da
      return x.round - y.round
    })

    setSeatingHistory(history)

    // 최근 2개월(60일) 세션 그룹핑 — 언어교환 응답은 매주 초기화되지만
    // le_participation_archive 스냅샷으로 최대 2개월까지 보관됨
    const twoMonthsAgo = new Date()
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60)
    const cutoff = twoMonthsAgo.toISOString().slice(0, 10)

    const sessionMap = new Map<string, SeatingSession>()
    for (const h of history) {
      const date = h.session_date || ''
      if (!date || date < cutoff) continue
      const sessionKey = `${h.posting_id}|${date}`
      const existing = sessionMap.get(sessionKey)
      if (existing) {
        if (!existing.rounds.includes(h.round)) existing.rounds.push(h.round)
      } else {
        sessionMap.set(sessionKey, {
          posting_id: h.posting_id,
          session_date: date,
          dayLabel: h.dayLabel,
          rounds: [h.round],
        })
      }
    }
    const sessions = Array.from(sessionMap.values()).sort((a, b) =>
      b.session_date.localeCompare(a.session_date)
    )
    setSeatingSessions(sessions)

    setReady(true)
  }, [supabase, isEn])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load()
    })
    return () => subscription.unsubscribe()
  }, [supabase, load])

  return {
    ready,
    user,
    userRow,
    showAuth,
    applications,
    seatingHistory,
    seatingSessions,
    markedDates,
    reload: load,
  }
}
