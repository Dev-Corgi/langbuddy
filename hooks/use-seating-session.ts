'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { applyPatchesToSnapshot } from '@/lib/seating-session/apply-patch'
import type { ReconcileWarning, SeatingPatch, SeatingSessionSnapshot } from '@/lib/seating-session/types'
import type { CoreFormQuestion } from '@/lib/utils'
import { koreanWeekdayLetterSeoul, todayYYYYMMDDSeoul } from '@/lib/session-event-date'
import { toast } from 'sonner'

export type SeatingSessionSyncStatus = 'idle' | 'loading' | 'syncing' | 'conflict' | 'stale_epoch'

export function useSeatingSession() {
  const supabase = useMemo(() => createClient(), [])
  const [snapshot, setSnapshot] = useState<SeatingSessionSnapshot | null>(null)
  const [formQuestions, setFormQuestions] = useState<CoreFormQuestion[]>([])
  const [postingTitle, setPostingTitle] = useState('')
  const [syncStatus, setSyncStatus] = useState<SeatingSessionSyncStatus>('loading')
  const snapshotRef = useRef<SeatingSessionSnapshot | null>(null)
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSyncRef = useRef(false)

  snapshotRef.current = snapshot

  const showWarnings = useCallback((warnings: ReconcileWarning[]) => {
    const maxVisible = 5
    for (const w of warnings.slice(0, maxVisible)) {
      toast.warning(w.message, { id: `reconcile-${w.participantId ?? w.code}-${w.message}` })
    }
    if (warnings.length > maxVisible) {
      const restSummary = warnings
        .slice(maxVisible)
        .map((w) => w.message)
        .join(' · ')
      toast.warning(`외 ${warnings.length - maxVisible}건: ${restSummary}`, {
        id: 'reconcile-more',
        duration: 10000,
      })
    }
  }, [])

  const loadSession = useCallback(async () => {
    setSyncStatus('loading')
    try {
      const sessionDate = todayYYYYMMDDSeoul()
      const dayOfWeek = koreanWeekdayLetterSeoul()
      const res = await fetch(
        `/api/admin/seating-session?sessionDate=${encodeURIComponent(sessionDate)}&dayOfWeek=${encodeURIComponent(dayOfWeek)}`
      )
      if (res.status === 404) {
        setSnapshot(null)
        setFormQuestions([])
        setPostingTitle('')
        setSyncStatus('idle')
        return null
      }
      if (!res.ok) throw new Error('load_failed')
      const data = (await res.json()) as {
        snapshot: SeatingSessionSnapshot
        meta?: { title?: string; formQuestions?: CoreFormQuestion[] }
      }
      setSnapshot(data.snapshot)
      setFormQuestions(data.meta?.formQuestions ?? [])
      setPostingTitle(data.meta?.title ?? '')
      setSyncStatus('idle')
      return data.snapshot
    } catch (err) {
      console.error('[useSeatingSession] load', err)
      setSyncStatus('idle')
      toast.error('자리배치 세션을 불러오지 못했습니다.')
      return null
    }
  }, [])

  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null
      void loadSession()
    }, 200)
  }, [loadSession])

  const commitPatches = useCallback(
    async (patches: SeatingPatch[], options?: { optimistic?: boolean }) => {
      const current = snapshotRef.current
      if (!current || patches.length === 0) return false

      const optimistic = options?.optimistic !== false
      if (optimistic) {
        const { snapshot: next, warnings } = applyPatchesToSnapshot(current, patches)
        setSnapshot(next)
        if (warnings.length) showWarnings(warnings)
      }

      setSyncStatus('syncing')
      try {
        const res = await fetch('/api/admin/seating-session/patch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postingId: current.key.postingId,
            sessionDate: current.key.sessionDate,
            dayOfWeek: current.key.dayOfWeek,
            expectedRevision: current.revision,
            expectedEpoch: current.key.epoch,
            patches,
          }),
        })

        if (res.status === 409) {
          const data = (await res.json()) as {
            error: string
            snapshot: SeatingSessionSnapshot
          }
          setSnapshot(data.snapshot)
          setSyncStatus(data.error === 'stale_epoch' ? 'stale_epoch' : 'conflict')
          toast.error(
            data.error === 'stale_epoch'
              ? '세션이 초기화되었습니다. 새로고침 후 다시 진행해 주세요.'
              : '다른 화면에서 변경이 있었습니다. 최신 상태로 맞췄습니다.',
            { id: 'seating-conflict' }
          )
          return false
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error || 'patch_failed')
        }

        const data = (await res.json()) as {
          snapshot: SeatingSessionSnapshot
          warnings?: ReconcileWarning[]
        }
        setSnapshot(data.snapshot)
        if (data.warnings?.length) showWarnings(data.warnings)
        setSyncStatus('idle')
        return true
      } catch (err) {
        console.error('[useSeatingSession] patch', err)
        setSyncStatus('idle')
        await loadSession()
        toast.error('저장에 실패했습니다. 최신 상태로 되돌렸습니다.')
        return false
      }
    },
    [loadSession, showWarnings]
  )

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    const postingId = snapshot?.key.postingId
    const formId = snapshot?.key.formId
    if (!postingId || !formId) return

    const channel = supabase
      .channel(`seating-session-${postingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'form_responses', filter: `form_id=eq.${formId}` },
        () => scheduleReload()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seating_assignments',
          filter: `posting_id=eq.${postingId}`,
        },
        () => scheduleReload()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'postings', filter: `id=eq.${postingId}` },
        () => scheduleReload()
      )
      .subscribe()

    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [supabase, snapshot?.key.postingId, snapshot?.key.formId, scheduleReload])

  const participants = snapshot?.participants ?? []
  const rounds = snapshot?.rounds ?? []
  const langTableCounts = snapshot?.config.langTableCounts ?? {}

  return {
    snapshot,
    participants,
    rounds,
    langTableCounts,
    formQuestions,
    postingTitle,
    syncStatus,
    loadSession,
    commitPatches,
    setSnapshot,
  }
}
