'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { canAccessStaffOps } from '@/lib/admin-access'
import { useSeatingSession } from '@/hooks/use-seating-session'
import type { SeatingPatch } from '@/lib/seating-session/types'
import type { SeatingConfigPayload } from '@/lib/seating-live-sync'
import type { RoundData } from '@/lib/seating-algorithm'
import { mergeLangTableCounts, langTableCountsFromRounds } from '@/lib/seating-table-ops'

export type ArrangePostingSession = {
  id: string
  title: string
  date: string
  form_id?: string | null
  day_of_week?: string | null
  seating_config?: SeatingConfigPayload | null
}

/** arrange page ↔ seating-session snapshot bridge */
export function useArrangeSync() {
  const supabase = useMemo(() => createClient(), [])
  const seating = useSeatingSession()
  const [authReady, setAuthReady] = useState(false)
  const seenCheckedInIdsRef = useRef<Set<string>>(new Set())

  const session = useMemo<ArrangePostingSession | null>(() => {
    if (!seating.snapshot) return null
    return {
      id: seating.snapshot.key.postingId,
      title: seating.postingTitle,
      date: seating.snapshot.key.sessionDate,
      form_id: seating.snapshot.key.formId,
      day_of_week: seating.snapshot.key.dayOfWeek,
      seating_config: seating.snapshot.config,
    }
  }, [seating.snapshot, seating.postingTitle])

  const loading = !authReady || (seating.syncStatus === 'loading' && !seating.snapshot)
  const seatingSyncing = seating.syncStatus === 'syncing'

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/admin/login'
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin, is_staff')
        .eq('id', user.id)
        .single()
      if (!canAccessStaffOps(user.email, profile)) {
        window.location.href = '/admin/dashboard'
        return
      }
      setAuthReady(true)
    })()
  }, [supabase])

  useEffect(() => {
    if (!authReady) return
    void seating.loadSession().then((loaded) => {
      if (loaded) {
        seenCheckedInIdsRef.current = new Set(
          loaded.participants.filter((p) => p.checked_in_at).map((p) => p.id)
        )
      }
    })
  }, [authReady, seating.loadSession])

  const fetchData = useCallback(async () => {
    const loaded = await seating.loadSession()
    if (loaded) {
      seenCheckedInIdsRef.current = new Set(
        loaded.participants.filter((p) => p.checked_in_at).map((p) => p.id)
      )
    }
  }, [seating.loadSession])

  const commitAssign = useCallback(
    (round: number, participantId: string, tableLabel: string | null) => {
      void seating.commitPatches([
        { op: 'assign', round, participantId, tableLabel },
      ])
    },
    [seating.commitPatches]
  )

  const commitRoundState = useCallback(
    async (
      roundNum: number,
      roundData: RoundData,
      langCounts?: Record<string, number>
    ) => {
      const patches: SeatingPatch[] = [
        {
          op: 'replace_round',
          round: roundNum,
          assignments: roundData.assignments,
          tableLanguages: roundData.tableLanguages ?? {},
          tableOrder: roundData.tableOrder ?? null,
        },
      ]
      const counts = langCounts ?? seating.langTableCounts
      if (counts && Object.keys(counts).length > 0) {
        patches.push({ op: 'set_lang_table_counts', langTableCounts: counts })
      }
      return seating.commitPatches(patches)
    },
    [seating.commitPatches, seating.langTableCounts]
  )

  const commitCheckin = useCallback(
    (participantId: string, source?: string) => {
      void seating.commitPatches([{ op: 'checkin', participantId, source }])
    },
    [seating.commitPatches]
  )

  const commitUncheckin = useCallback(
    (participantId: string) => {
      void seating.commitPatches([{ op: 'uncheckin', participantId }])
    },
    [seating.commitPatches]
  )

  const mergeLangCountsFromRounds = useCallback((updatedRounds: RoundData[]) => {
    return langTableCountsFromRounds(updatedRounds)
  }, [])

  const mergeLangCounts = useCallback(
    (current: Record<string, number>, tableLanguages: Record<string, string>) => {
      return mergeLangTableCounts(current, tableLanguages)
    },
    []
  )

  return {
    supabase,
    session,
    participants: seating.participants,
    rounds: seating.rounds,
    langTableCounts: seating.langTableCounts,
    formQuestions: seating.formQuestions,
    snapshot: seating.snapshot,
    syncStatus: seating.syncStatus,
    loading,
    seatingSyncing,
    fetchData,
    commitAssign,
    commitRoundState,
    commitCheckin,
    commitUncheckin,
    mergeLangCountsFromRounds,
    mergeLangCounts,
    seenCheckedInIdsRef,
    setSnapshot: seating.setSnapshot,
    reloadSession: seating.loadSession,
  }
}
