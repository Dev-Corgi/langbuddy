'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase'
import {
  SeatingSessionSyncEngine,
  type PatchResult,
  type SyncEngineStatus,
} from '@/lib/seating-session-client/sync-engine'
import type { ReconcileWarning, SeatingPatch, SeatingSessionSnapshot } from '@/lib/seating-session/types'
import type { CoreFormQuestion } from '@/lib/utils'
import { koreanWeekdayLetterSeoul, todayYYYYMMDDSeoul } from '@/lib/session-event-date'
import { toast } from 'sonner'

export type SeatingSessionSyncStatus = SyncEngineStatus

function showWarnings(warnings: ReconcileWarning[]) {
  const maxVisible = 5
  for (const w of warnings.slice(0, maxVisible)) {
    toast.warning(w.message, { id: `reconcile-${w.participantId ?? w.code}-${w.message}` })
  }
  if (warnings.length > maxVisible) {
    toast.warning(
      `외 ${warnings.length - maxVisible}건: ${warnings.slice(maxVisible).map((w) => w.message).join(' · ')}`,
      { id: 'reconcile-more', duration: 10000 }
    )
  }
}

async function fetchSessionSnapshot(): Promise<{
  snapshot: SeatingSessionSnapshot | null
  meta?: { title?: string; formQuestions?: CoreFormQuestion[] }
}> {
  const sessionDate = todayYYYYMMDDSeoul()
  const dayOfWeek = koreanWeekdayLetterSeoul()
  const res = await fetch(
    `/api/admin/seating-session?sessionDate=${encodeURIComponent(sessionDate)}&dayOfWeek=${encodeURIComponent(dayOfWeek)}`
  )
  if (res.status === 404) return { snapshot: null }
  if (!res.ok) throw new Error('load_failed')
  const data = (await res.json()) as {
    snapshot: SeatingSessionSnapshot
    meta?: { title?: string; formQuestions?: CoreFormQuestion[] }
  }
  return data
}

async function postSessionPatches(
  snapshot: SeatingSessionSnapshot,
  patches: SeatingPatch[]
): Promise<PatchResult> {
  const res = await fetch('/api/admin/seating-session/patch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPatchRequestBody(snapshot, patches)),
  })

  if (res.status === 409) {
    const data = (await res.json()) as { error: string; snapshot: SeatingSessionSnapshot }
    return {
      ok: false,
      conflict: data.error === 'stale_epoch' ? 'stale_epoch' : 'stale_revision',
      snapshot: data.snapshot,
    }
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error || 'patch_failed' }
  }

  const data = (await res.json()) as {
    snapshot: SeatingSessionSnapshot
    warnings?: ReconcileWarning[]
  }
  return { ok: true, snapshot: data.snapshot, warnings: data.warnings }
}

function buildPatchRequestBody(snapshot: SeatingSessionSnapshot, patches: SeatingPatch[]) {
  return {
    postingId: snapshot.key.postingId,
    sessionDate: snapshot.key.sessionDate,
    dayOfWeek: snapshot.key.dayOfWeek,
    expectedRevision: snapshot.revision,
    expectedEpoch: snapshot.key.epoch,
    patches,
  }
}

function sendEmergencyPatch(
  req: { snapshot: SeatingSessionSnapshot; patches: SeatingPatch[] }
): void {
  const body = JSON.stringify(buildPatchRequestBody(req.snapshot, req.patches))
  const url = '/api/admin/seating-session/patch'

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon(url, blob)
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  })
}

export function useSeatingSession() {
  const supabase = useMemo(() => createClient(), [])
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [formQuestions, setFormQuestions] = useState<CoreFormQuestion[]>([])
  const [postingTitle, setPostingTitle] = useState('')

  const engineRef = useRef<SeatingSessionSyncEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new SeatingSessionSyncEngine({
      postPatches: postSessionPatches,
      loadSnapshot: async () => {
        const data = await fetchSessionSnapshot()
        setFormQuestions(data.meta?.formQuestions ?? [])
        setPostingTitle(data.meta?.title ?? '')
        return data.snapshot
      },
      onWarnings: showWarnings,
      onConflict: (kind) => {
        toast.error(
          kind === 'stale_epoch'
            ? '세션이 초기화되었습니다. 새로고침 후 다시 진행해 주세요.'
            : '다른 변경과 겹쳐 저장하지 못했습니다. 최신 상태로 맞췄습니다.',
          { id: 'seating-conflict' }
        )
      },
      onError: (message) => toast.error(message),
    })
  }
  const engine = engineRef.current

  const subscribe = useCallback((onStoreChange: () => void) => engine.subscribe(onStoreChange), [engine])

  const getSnapshot = useCallback(() => engine.getSnapshot(), [engine])
  const getServerSnapshot = useCallback((): SeatingSessionSnapshot | null => null, [])

  const sessionSnapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const syncStatus = useSyncExternalStore(
    useCallback((cb) => engine.subscribe(cb), [engine]),
    () => engine.getStatus(),
    () => 'loading' as SyncEngineStatus
  )
  const pendingPatchCount = useSyncExternalStore(
    useCallback((cb) => engine.subscribe(cb), [engine]),
    () => engine.getPendingCount(),
    () => 0
  )
  const hasPendingLocalWork = useSyncExternalStore(
    useCallback((cb) => engine.subscribe(cb), [engine]),
    () => engine.hasPendingLocalWork(),
    () => false
  )

  const loadSession = useCallback(
    async (options?: { force?: boolean }) => {
      const result = await engine.hydrate(options)
      if (result.skipped) {
        toast.info('저장 중입니다. 잠시 후 다시 시도해 주세요.', { id: 'seating-refresh-skipped' })
      }
      return result.snapshot
    },
    [engine]
  )

  /** pending 저장 flush → 서버 snapshot 로드 (수동 reload용) */
  const refreshSession = useCallback(async () => {
    const result = await engine.refreshFromServer()
    return result.snapshot
  }, [engine])

  const commitPatches = useCallback(
    (patches: SeatingPatch[], options?: { optimistic?: boolean }) => engine.commit(patches, options),
    [engine]
  )

  const setSnapshot = useCallback(
    (next: SeatingSessionSnapshot | null) => engine.replaceSnapshot(next),
    [engine]
  )

  /** React 리렌더 전에도 최신 optimistic snapshot (mutation 입력용) */
  const getLiveSnapshot = useCallback(() => engine.getSnapshot(), [engine])

  const [initialLoadDone, setInitialLoadDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    void engine.hydrate().finally(() => {
      if (!cancelled) setInitialLoadDone(true)
    })
    return () => {
      cancelled = true
    }
  }, [engine])

  /** F5 / 탭 닫기 — 저장 중이면 브라우저 기본 이탈 확인 (차단 아님) */
  useEffect(() => {
    if (!hasPendingLocalWork) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasPendingLocalWork])

  /** F5/Ctrl+R 직전: hidden 시점에 pending 저장 시도 (page unload 전에 실행됨) */
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return
      if (!engine.hasPendingLocalWork()) return
      void engine.flushNowAndWait()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [engine])

  /** pagehide: keepalive/beacon + sessionStorage (F5 중 syncing 도중 유실 방지) */
  useEffect(() => {
    const onPageHide = () => {
      const req = engine.buildEmergencyPatchRequest()
      if (!req) return
      sendEmergencyPatch(req)
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [engine])

  useEffect(() => {
    const postingId = sessionSnapshot?.key.postingId
    const formId = sessionSnapshot?.key.formId
    if (!postingId || !formId) return

    const scheduleExternalRefresh = () => {
      if (!engine.canApplyExternalReload()) return
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null
        if (!engine.canApplyExternalReload()) return
        void engine.refreshExternal()
      }, 400)
    }

    const channel = supabase
      .channel(`seating-session-${postingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'form_responses', filter: `form_id=eq.${formId}` },
        scheduleExternalRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seating_assignments',
          filter: `posting_id=eq.${postingId}`,
        },
        scheduleExternalRefresh
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'postings', filter: `id=eq.${postingId}` },
        scheduleExternalRefresh
      )
      .subscribe()

    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [supabase, sessionSnapshot?.key.postingId, sessionSnapshot?.key.formId, engine])

  const participants = sessionSnapshot?.participants ?? []
  const rounds = sessionSnapshot?.rounds ?? []
  const langTableCounts = sessionSnapshot?.config.langTableCounts ?? {}

  return {
    snapshot: sessionSnapshot,
    participants,
    rounds,
    langTableCounts,
    formQuestions,
    postingTitle,
    syncStatus,
    pendingPatchCount,
    hasPendingLocalWork,
    initialLoadDone,
    loadSession,
    refreshSession,
    commitPatches,
    setSnapshot,
    getLiveSnapshot,
  }
}
