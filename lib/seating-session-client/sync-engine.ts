/**
 * Seating session client sync (standard admin-app pattern):
 *
 * 모든 mutation(assign, replace_round, checkin, uncheckin, lang counts)이
 * commit() → outbox → serial flush 한 경로를 탄다.
 *
 * 1. Local snapshot = UI source of truth (optimistic update on every mutation)
 * 2. Mutation outbox = pending writes, flushed serially (one in flight)
 * 3. Server ack = revision만 동기화 (optimistic UI는 절대 덮어쓰지 않음)
 * 4. External reload = pending work 없을 때만 + local progress 우선 merge
 */

import { applyPatchesToSnapshot } from '@/lib/seating-session/apply-patch'
import { coalescePatches } from '@/lib/seating-session-client/coalesce-patches'
import {
  coalesceOutboxEntries,
  collectPendingPatches,
  type OutboxEntry,
} from '@/lib/seating-session-client/coalesce-mutations'
import {
  buildCatchUpPatches,
  clearEmergencyBackup,
  matchesEmergencySession,
  readEmergencyBackup,
  writeEmergencyBackup,
} from '@/lib/seating-session-client/emergency-persist'
import {
  mergeServerSnapshot,
  mergeSnapshotPreferLocalProgress,
} from '@/lib/seating-session/merge-snapshot'
import type { ReconcileWarning, SeatingPatch, SeatingSessionSnapshot } from '@/lib/seating-session/types'

export type SyncEngineStatus = 'idle' | 'loading' | 'syncing' | 'conflict' | 'stale_epoch'

export type PatchResult =
  | { ok: true; snapshot: SeatingSessionSnapshot; warnings?: ReconcileWarning[] }
  | { ok: false; conflict: 'stale_epoch' | 'stale_revision'; snapshot: SeatingSessionSnapshot }
  | { ok: false; error: string }

export type SyncEngineCallbacks = {
  postPatches: (snapshot: SeatingSessionSnapshot, patches: SeatingPatch[]) => Promise<PatchResult>
  loadSnapshot: () => Promise<SeatingSessionSnapshot | null>
  onWarnings?: (warnings: ReconcileWarning[]) => void
  onConflict?: (kind: 'stale_epoch' | 'stale_revision') => void
  onError?: (message: string) => void
}

type Listener = () => void

export class SeatingSessionSyncEngine {
  private static readonly OUTBOX_SETTLE_MS = 150
  private static readonly OUTBOX_SETTLE_MAX_MS = 800

  private snapshot: SeatingSessionSnapshot | null = null
  private status: SyncEngineStatus = 'loading'
  private outbox: OutboxEntry[] = []
  private flushing = false
  private inFlightPatches: SeatingPatch[] | null = null
  private immediateFlush = false
  private listeners = new Set<Listener>()
  private callbacks: SyncEngineCallbacks

  constructor(callbacks: SyncEngineCallbacks) {
    this.callbacks = callbacks
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }

  getSnapshot(): SeatingSessionSnapshot | null {
    return this.snapshot
  }

  getStatus(): SyncEngineStatus {
    return this.status
  }

  getPendingCount(): number {
    return this.outbox.length
  }

  /** outbox·flush 중 — 외부 reload / 서버 데이터 merge 금지 */
  hasPendingLocalWork(): boolean {
    return this.outbox.length > 0 || this.flushing
  }

  /** 외부(realtime) reload 허용 */
  canApplyExternalReload(): boolean {
    return !this.hasPendingLocalWork()
  }

  setStatus(status: SyncEngineStatus) {
    this.status = status
    this.emit()
  }

  replaceSnapshot(next: SeatingSessionSnapshot | null) {
    if (next === null) {
      this.snapshot = null
    } else {
      this.snapshot = mergeServerSnapshot(this.snapshot, next)
    }
    this.emit()
  }

  /** 초기 로드 / 명시적 refresh — outbox·flush 중이면 덮어쓰지 않음 */
  async hydrate(options?: { force?: boolean }): Promise<{
    snapshot: SeatingSessionSnapshot | null
    skipped: boolean
  }> {
    if (!options?.force && !this.canApplyExternalReload()) {
      return { snapshot: this.snapshot, skipped: true }
    }

    const hadSnapshot = this.snapshot !== null
    this.setStatus(hadSnapshot ? 'syncing' : 'loading')
    try {
      let loaded = await this.callbacks.loadSnapshot()
      loaded = await this.recoverEmergencyBackup(loaded)
      this.snapshot = loaded
      if (loaded && !this.hasPendingLocalWork()) {
        clearEmergencyBackup()
      }
      this.setStatus('idle')
      return { snapshot: loaded, skipped: false }
    } catch {
      this.setStatus('idle')
      this.callbacks.onError?.('자리배치 세션을 불러오지 못했습니다.')
      return { snapshot: null, skipped: false }
    }
  }

  /** silent external refresh (realtime, other tab) */
  async refreshExternal(): Promise<void> {
    if (!this.canApplyExternalReload()) return
    this.setStatus('syncing')
    try {
      const loaded = await this.callbacks.loadSnapshot()
      if (loaded && this.snapshot) {
        this.snapshot = mergeSnapshotPreferLocalProgress(this.snapshot, loaded)
      } else if (loaded) {
        this.snapshot = loaded
      }
      this.setStatus('idle')
    } catch {
      this.setStatus('idle')
    }
  }

  commit(patches: SeatingPatch[], options?: { optimistic?: boolean }): Promise<boolean> {
    if (!this.snapshot || patches.length === 0) return Promise.resolve(false)

    const optimistic = options?.optimistic !== false
    if (optimistic) {
      const { snapshot: next, warnings } = applyPatchesToSnapshot(this.snapshot, patches)
      this.snapshot = next
      if (warnings.length) this.callbacks.onWarnings?.(warnings)
      writeEmergencyBackup(next)
      this.emit()
    }

    return new Promise((resolve) => {
      this.outbox.push({ patches, resolve })
      this.emit()
      this.scheduleFlush()
    })
  }

  private flushPromise: Promise<void> | null = null

  /** debounce 취소 + outbox 전부 POST 완료까지 대기 */
  async flushNowAndWait(): Promise<void> {
    this.immediateFlush = true
    try {
      if (this.outbox.length > 0) {
        await this.flushOutbox()
      }
      await this.waitUntilIdle()
    } finally {
      this.immediateFlush = false
    }
  }

  /**
   * F5/pagehide: settle 없이 outbox + in-flight PATCH 1회 (keepalive/beacon)
   */
  buildEmergencyPatchRequest(): {
    snapshot: SeatingSessionSnapshot
    patches: SeatingPatch[]
  } | null {
    if (!this.snapshot) return null
    const patches = this.collectAllPendingPatches()
    if (patches.length === 0) return null
    writeEmergencyBackup(this.snapshot)
    return { snapshot: this.snapshot, patches }
  }

  /** @deprecated use buildEmergencyPatchRequest */
  peekKeepalivePatchRequest(): {
    snapshot: SeatingSessionSnapshot
    patches: SeatingPatch[]
  } | null {
    return this.buildEmergencyPatchRequest()
  }

  private collectAllPendingPatches(): SeatingPatch[] {
    const pending = collectPendingPatches(this.outbox)
    const inFlight = this.inFlightPatches ?? []
    return coalescePatches([...pending, ...inFlight])
  }

  /** F5 직후: sessionStorage 백업 → 서버 따라잡기 */
  private async recoverEmergencyBackup(
    loaded: SeatingSessionSnapshot | null
  ): Promise<SeatingSessionSnapshot | null> {
    if (!loaded) return loaded

    const backup = readEmergencyBackup()
    if (!backup || !matchesEmergencySession(loaded, backup)) {
      return loaded
    }

    const catchUp = buildCatchUpPatches(loaded, backup.snapshot)
    if (catchUp.length === 0) {
      clearEmergencyBackup()
      return loaded
    }

    this.snapshot = loaded
    this.immediateFlush = true
    try {
      const result = await this.callbacks.postPatches(loaded, catchUp)
      if (!result.ok) {
        if ('conflict' in result) {
          const retryPatches = buildCatchUpPatches(result.snapshot, backup.snapshot)
          if (retryPatches.length > 0) {
            const retry = await this.callbacks.postPatches(result.snapshot, retryPatches)
            if (retry.ok) {
              clearEmergencyBackup()
              return retry.snapshot
            }
          }
          return result.snapshot
        }
        return loaded
      }
      clearEmergencyBackup()
      return result.snapshot
    } finally {
      this.immediateFlush = false
    }
  }

  private waitForOutboxSettle(): Promise<void> {
    if (this.immediateFlush || this.outbox.length === 0) return Promise.resolve()

    return new Promise((resolve) => {
      const started = Date.now()
      let timer: ReturnType<typeof setTimeout> | null = null
      let lastOutboxLen = this.outbox.length

      const finish = () => {
        if (timer) clearTimeout(timer)
        unsub()
        resolve()
      }

      const arm = () => {
        if (timer) clearTimeout(timer)
        if (Date.now() - started >= SeatingSessionSyncEngine.OUTBOX_SETTLE_MAX_MS) {
          finish()
          return
        }
        timer = setTimeout(finish, SeatingSessionSyncEngine.OUTBOX_SETTLE_MS)
      }

      const unsub = this.subscribe(() => {
        const len = this.outbox.length
        if (len === 0 && lastOutboxLen > 0) {
          finish()
          return
        }
        if (len !== lastOutboxLen) {
          lastOutboxLen = len
          arm()
        }
      })

      arm()
    })
  }

  private waitUntilIdle(): Promise<void> {
    if (!this.hasPendingLocalWork()) return Promise.resolve()
    return new Promise((resolve) => {
      const unsub = this.subscribe(() => {
        if (!this.hasPendingLocalWork()) {
          unsub()
          resolve()
        }
      })
    })
  }

  /** 서버 snapshot으로 교체 (명시적 새로고침) */
  async refreshFromServer(): Promise<{
    snapshot: SeatingSessionSnapshot | null
    skipped: boolean
  }> {
    await this.flushNowAndWait()
    return this.hydrate({ force: true })
  }

  private scheduleFlush() {
    void this.flushOutbox()
  }

  private flushOutbox(): Promise<void> {
    if (this.flushPromise) return this.flushPromise
    this.flushPromise = this.drainOutbox().finally(() => {
      this.flushPromise = null
    })
    return this.flushPromise
  }

  /** outbox가 빌 때까지 settle → coalesce → POST 반복 (self-await deadlock 방지) */
  private async drainOutbox(): Promise<void> {
    while (this.outbox.length > 0) {
      await this.runFlushBatch()
    }
  }

  private async runFlushBatch(): Promise<void> {
    this.flushing = true
    this.setStatus('syncing')

    let rawEntries: OutboxEntry[] = []

    try {
      await this.waitForOutboxSettle()
      if (this.outbox.length === 0) return

      rawEntries = this.outbox.splice(0)
      const batch = coalesceOutboxEntries(rawEntries)
      const merged = batch[0]
      if (!merged || merged.patches.length === 0) {
        merged?.resolve(true)
        return
      }

      this.inFlightPatches = merged.patches
      this.emit()

      const ok = await this.flushEntry(merged)
      merged.resolve(ok)

      if (!ok) {
        this.outbox.unshift(...rawEntries)
        this.emit()
      }
    } finally {
      this.inFlightPatches = null
      this.flushing = false
      this.setStatus(this.outbox.length > 0 ? 'syncing' : 'idle')
      this.emit()
      if (!this.hasPendingLocalWork() && this.snapshot) {
        clearEmergencyBackup()
      }
    }
  }

  private async flushEntry(entry: OutboxEntry): Promise<boolean> {
    if (entry.patches.length === 0) return true
    if (!this.snapshot) return false

    const localBeforeAck = this.snapshot
    const result = await this.callbacks.postPatches(this.snapshot, entry.patches)

    if (!result.ok) {
      if ('conflict' in result) {
        this.outbox.splice(0, this.outbox.length)
        this.snapshot = result.snapshot
        this.emit()
        this.setStatus(result.conflict === 'stale_epoch' ? 'stale_epoch' : 'conflict')
        this.callbacks.onConflict?.(result.conflict)
        return false
      }
      this.setStatus('idle')
      await this.refreshAfterFailure()
      this.callbacks.onError?.('저장에 실패했습니다. 최신 상태로 되돌렸습니다.')
      return false
    }

    // 성공 ack: optimistic UI가 정본. revision만 서버와 맞춘다 (rounds/participants 덮어쓰지 않음)
    const head = this.snapshot ?? localBeforeAck
    this.snapshot = {
      ...head,
      revision: result.snapshot.revision,
      updatedAt: result.snapshot.updatedAt,
      key: { ...head.key, epoch: result.snapshot.key.epoch },
    }
    if (result.warnings?.length) this.callbacks.onWarnings?.(result.warnings)
    this.emit()
    return true
  }

  private async refreshAfterFailure(): Promise<void> {
    if (!this.canApplyExternalReload()) return
    try {
      const loaded = await this.callbacks.loadSnapshot()
      if (loaded && this.snapshot) {
        this.snapshot = mergeSnapshotPreferLocalProgress(this.snapshot, loaded)
      } else if (loaded) {
        this.snapshot = loaded
      }
      this.emit()
    } catch {
      /* ignore */
    }
  }
}
