'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { extractParticipantInfoFromAnswers } from '@/lib/utils'
import {
  todayYYYYMMDDSeoul,
  resolveApplicationSessionYmd,
  buildRecurringSessionDisplayTitles,
} from '@/lib/session-event-date'
import type { AppCategory, ApplicationRow, SeatingMemory } from '../_lib/types'

export function useMyPageData(isEn: boolean) {
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [userRow, setUserRow] = useState<{
    name?: string
    le_stamp_progress?: number
    le_reward_coupons?: number
  } | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [seatingHistory, setSeatingHistory] = useState<SeatingMemory[]>([])
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
      setMarkedDates(new Set())
      setReady(true)
      return
    }
    setShowAuth(false)

    const { data: profile } = await supabase
      .from('users')
      .select('name, le_stamp_progress, le_reward_coupons')
      .eq('id', u.id)
      .single()
    setUserRow(profile || {})

    const [{ data: leSched }, { data: stSched }, { data: postingRows }] = await Promise.all([
      supabase.from('language_exchange_schedules').select('form_id, posting_id').eq('is_active', true),
      supabase.from('study_schedules').select('form_id, posting_id').eq('is_active', true),
      supabase.from('postings').select('id, form_id, category, title, title_en').eq('status', 'active'),
    ])

    const leFormIds = new Set((leSched || []).map((r) => r.form_id).filter(Boolean) as string[])
    const stFormIds = new Set((stSched || []).map((r) => r.form_id).filter(Boolean) as string[])

    function categoryForForm(fid: string): AppCategory {
      if (leFormIds.has(fid)) return '언어교환'
      if (stFormIds.has(fid)) return '스터디'
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

      const recurringKind =
        cat === '언어교환' ? ('language' as const) : cat === '스터디' ? ('study' as const) : null
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
      else if (cat === '스터디') meetupHref = '/posting/study'
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
    if (myParticipantIds.length === 0) {
      setSeatingHistory([])
      setReady(true)
      return
    }

    const { data: myAssignments } = await supabase
      .from('seating_assignments')
      .select('*')
      .in('participant_id', myParticipantIds)

    if (!myAssignments?.length) {
      setSeatingHistory([])
      setReady(true)
      return
    }

    const resById = Object.fromEntries(leResponses.map((r) => [r.id, r])) as Record<
      string,
      { answers?: Record<string, unknown> }
    >

    const history: SeatingMemory[] = []
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

      let q = supabase
        .from('seating_assignments')
        .select('participant_id')
        .eq('posting_id', a.posting_id as string)
        .eq('round', a.round as number)
        .eq('table_label', a.table_label as string)

      if (a.session_date) {
        q = q.eq('session_date', a.session_date as string)
      } else {
        q = q.is('session_date', null)
      }

      const { data: rowMates } = await q
      const mateIds = (rowMates || [])
        .map((m) => m.participant_id as string)
        .filter((pid) => pid !== a.participant_id)

      let mateNames: string[] = []
      if (mateIds.length) {
        const { data: matesRows } = await supabase.from('form_responses').select('answers').in('id', mateIds)

        mateNames =
          matesRows?.map((row) => {
            const n = extractParticipantInfoFromAnswers((row.answers || {}) as Record<string, unknown>, []).name
            return n || '?'
          }) || []
      }

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

    history.sort((x, y) => {
      const da = (x.session_date || '').localeCompare(y.session_date || '')
      if (da !== 0) return -da
      return x.round - y.round
    })

    setSeatingHistory(history)
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
    markedDates,
    reload: load,
  }
}
