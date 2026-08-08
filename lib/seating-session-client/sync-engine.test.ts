import { strict as assert } from 'node:assert'
import test from 'node:test'
import { orderedTableLabels } from '@/lib/seating-table-ops'
import { SeatingSessionSyncEngine } from './sync-engine'
import type { SeatingSessionSnapshot } from '@/lib/seating-session/types'

function baseSnapshot(revision = 0): SeatingSessionSnapshot {
  return {
    key: {
      postingId: 'p1',
      sessionDate: '2026-08-08',
      formId: 'f1',
      dayOfWeek: '토',
      epoch: 0,
    },
    revision,
    updatedAt: '2026-08-08T00:00:00Z',
    participants: [],
    rounds: [
      { round: 1, assignments: [], tableLanguages: {} },
      { round: 2, assignments: [], tableLanguages: {} },
      { round: 3, assignments: [], tableLanguages: {} },
    ],
    config: { langTableCounts: {} },
  }
}

function snapshotWithCheckedInParticipant(revision = 0): SeatingSessionSnapshot {
  return {
    ...baseSnapshot(revision),
    participants: [
      {
        id: 'u1',
        userId: 'user-1',
        name: 'Alice',
        language: '영어',
        nationality: '외국인',
        gender: '여',
        checked_in_at: '2026-08-08T01:00:00Z',
        isWalkIn: false,
        paymentMethod: 'cash',
        isStaff: false,
      },
    ],
    rounds: [
      {
        round: 1,
        assignments: [],
        tableLanguages: { A: '영어', B: '영어', C: '영어' },
        tableOrder: ['A', 'B', 'C'],
      },
      { round: 2, assignments: [], tableLanguages: {} },
      { round: 3, assignments: [], tableLanguages: {} },
    ],
  }
}

function round1Assignments(snapshot: SeatingSessionSnapshot) {
  return snapshot.rounds[0]?.assignments ?? []
}

test('serial outbox: rapid commits never use stale revision', async () => {
  let serverRevision = 0
  let postCount = 0
  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => baseSnapshot(serverRevision),
    postPatches: async (snap) => {
      postCount += 1
      assert.equal(snap.revision, serverRevision)
      serverRevision += 1
      return { ok: true, snapshot: baseSnapshot(serverRevision) }
    },
  })
  engine.replaceSnapshot(baseSnapshot(0))

  const [a, b] = await Promise.all([
    engine.commit([
      {
        op: 'replace_round',
        round: 1,
        assignments: [],
        tableLanguages: { A: '영어' },
        tableOrder: ['A'],
      },
    ]),
    engine.commit([
      {
        op: 'replace_round',
        round: 1,
        assignments: [],
        tableLanguages: { A: '영어', B: '영어' },
        tableOrder: ['A', 'B'],
      },
    ]),
  ])

  await new Promise((r) => setTimeout(r, 150))

  assert.equal(a, true)
  assert.equal(b, true)
  assert.ok(postCount >= 1)
  assert.equal(engine.getSnapshot()?.revision, postCount)
  assert.equal(engine.getPendingCount(), 0)
})

test('in-flight server ack does not revert newer optimistic edits', async () => {
  let serverRevision = 0
  let postCount = 0
  let releaseFirst!: () => void
  let firstPostStarted!: () => void
  const firstGate = new Promise<void>((r) => {
    releaseFirst = r
  })
  const firstPostStartedPromise = new Promise<void>((r) => {
    firstPostStarted = r
  })

  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => baseSnapshot(serverRevision),
    postPatches: async () => {
      postCount += 1

      if (postCount === 1) {
        firstPostStarted()
        await firstGate
        serverRevision += 1
        return {
          ok: true,
          snapshot: {
            ...baseSnapshot(serverRevision),
            rounds: baseSnapshot(serverRevision).rounds.map((r) =>
              r.round === 1
                ? {
                    ...r,
                    tableLanguages: { A: '영어' },
                    tableOrder: ['A'],
                  }
                : r
            ),
          },
        }
      }

      serverRevision += 1
      return {
        ok: true,
        snapshot: {
          ...baseSnapshot(serverRevision),
          rounds: baseSnapshot(serverRevision).rounds.map((r) =>
            r.round === 1
              ? {
                  ...r,
                  tableLanguages: { A: '영어', B: '영어' },
                  tableOrder: ['A', 'B'],
                }
              : r
          ),
        },
      }
    },
  })
  engine.replaceSnapshot(baseSnapshot(0))

  const first = engine.commit([
    {
      op: 'replace_round',
      round: 1,
      assignments: [],
      tableLanguages: { A: '영어' },
      tableOrder: ['A'],
    },
  ])

  await firstPostStartedPromise

  const second = engine.commit([
    {
      op: 'replace_round',
      round: 1,
      assignments: [],
      tableLanguages: { A: '영어', B: '영어' },
      tableOrder: ['A', 'B'],
    },
  ])

  assert.deepEqual(engine.getSnapshot()?.rounds[0]?.tableOrder, ['A', 'B'])

  releaseFirst()
  await new Promise((r) => setTimeout(r, 10))
  assert.deepEqual(
    engine.getSnapshot()?.rounds[0]?.tableOrder,
    ['A', 'B'],
    'first ack must not wipe pending second edit'
  )

  await first
  await second
  assert.equal(engine.getPendingCount(), 0)
  assert.deepEqual(engine.getSnapshot()?.rounds[0]?.tableOrder, ['A', 'B'])
  assert.equal(postCount, 2)
})

test('debounced flush coalesces rapid commits into one post', async () => {
  let postCount = 0
  let serverRevision = 0
  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => baseSnapshot(serverRevision),
    postPatches: async (snap, patches) => {
      postCount += 1
      serverRevision += 1
      const replace = patches.find((p) => p.op === 'replace_round')
      assert.ok(replace && replace.op === 'replace_round')
      return {
        ok: true,
        snapshot: {
          ...baseSnapshot(serverRevision),
          rounds: baseSnapshot(serverRevision).rounds.map((r) =>
            r.round === 1
              ? {
                  ...r,
                  tableLanguages: replace.tableLanguages,
                  tableOrder: replace.tableOrder ?? undefined,
                }
              : r
          ),
        },
      }
    },
  })
  engine.replaceSnapshot(baseSnapshot(0))

  void engine.commit([
    {
      op: 'replace_round',
      round: 1,
      assignments: [],
      tableLanguages: { A: '영어' },
      tableOrder: ['A'],
    },
  ])
  void engine.commit([
    {
      op: 'replace_round',
      round: 1,
      assignments: [],
      tableLanguages: { A: '영어', B: '영어' },
      tableOrder: ['A', 'B'],
    },
  ])
  void engine.commit([
    {
      op: 'replace_round',
      round: 1,
      assignments: [],
      tableLanguages: { A: '영어', B: '영어', C: '영어' },
      tableOrder: ['A', 'B', 'C'],
    },
  ])

  await new Promise((r) => setTimeout(r, 150))
  assert.equal(postCount, 1)
  assert.deepEqual(engine.getSnapshot()?.rounds[0]?.tableOrder, ['A', 'B', 'C'])
})

test('assign: in-flight ack keeps newer drag target', async () => {
  let serverRevision = 0
  let postCount = 0
  let releaseFirst!: () => void
  let firstPostStarted!: () => void
  const firstGate = new Promise<void>((r) => {
    releaseFirst = r
  })
  const firstPostStartedPromise = new Promise<void>((r) => {
    firstPostStarted = r
  })

  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => snapshotWithCheckedInParticipant(serverRevision),
    postPatches: async () => {
      postCount += 1
      if (postCount === 1) {
        firstPostStarted()
        await firstGate
        serverRevision += 1
        return {
          ok: true,
          snapshot: {
            ...snapshotWithCheckedInParticipant(serverRevision),
            rounds: snapshotWithCheckedInParticipant(serverRevision).rounds.map((r) =>
              r.round === 1
                ? {
                    ...r,
                    assignments: [{ participant_id: 'u1', table_label: 'A' }],
                  }
                : r
            ),
          },
        }
      }
      serverRevision += 1
      return {
        ok: true,
        snapshot: {
          ...snapshotWithCheckedInParticipant(serverRevision),
          rounds: snapshotWithCheckedInParticipant(serverRevision).rounds.map((r) =>
            r.round === 1
              ? {
                  ...r,
                  assignments: [{ participant_id: 'u1', table_label: 'B' }],
                }
              : r
          ),
        },
      }
    },
  })
  engine.replaceSnapshot(snapshotWithCheckedInParticipant(0))

  const first = engine.commit([{ op: 'assign', round: 1, participantId: 'u1', tableLabel: 'A' }])
  await firstPostStartedPromise

  const second = engine.commit([{ op: 'assign', round: 1, participantId: 'u1', tableLabel: 'B' }])
  assert.deepEqual(round1Assignments(engine.getSnapshot()!), [
    { participant_id: 'u1', table_label: 'B' },
  ])

  releaseFirst()
  await new Promise((r) => setTimeout(r, 10))
  assert.deepEqual(round1Assignments(engine.getSnapshot()!), [
    { participant_id: 'u1', table_label: 'B' },
  ])

  await first
  await second
  assert.deepEqual(round1Assignments(engine.getSnapshot()!), [
    { participant_id: 'u1', table_label: 'B' },
  ])
})

test('checkin: rapid commits stay visible through partial ack', async () => {
  let serverRevision = 0
  let postCount = 0
  let releaseFirst!: () => void
  let firstPostStarted!: () => void
  const firstGate = new Promise<void>((r) => {
    releaseFirst = r
  })
  const firstPostStartedPromise = new Promise<void>((r) => {
    firstPostStarted = r
  })

  const unchecked = {
    ...baseSnapshot(0),
    participants: [
      {
        id: 'u1',
        userId: 'user-1',
        name: 'Alice',
        language: '영어',
        nationality: '외국인',
        gender: '여',
        checked_in_at: null,
        isWalkIn: false,
        paymentMethod: 'cash',
        isStaff: false,
      },
      {
        id: 'u2',
        userId: 'user-2',
        name: 'Bob',
        language: '영어',
        nationality: '외국인',
        gender: '남',
        checked_in_at: null,
        isWalkIn: false,
        paymentMethod: 'cash',
        isStaff: false,
      },
    ],
  }

  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => baseSnapshot(serverRevision),
    postPatches: async () => {
      postCount += 1
      if (postCount === 1) {
        firstPostStarted()
        await firstGate
        serverRevision += 1
        const snap = { ...unchecked, revision: serverRevision }
        return {
          ok: true,
          snapshot: {
            ...snap,
            participants: snap.participants.map((p) =>
              p.id === 'u1' ? { ...p, checked_in_at: '2026-08-08T01:00:00Z' } : p
            ),
          },
        }
      }
      serverRevision += 1
      const snap = { ...unchecked, revision: serverRevision }
      return {
        ok: true,
        snapshot: {
          ...snap,
          participants: snap.participants.map((p) =>
            p.id === 'u1' || p.id === 'u2'
              ? { ...p, checked_in_at: '2026-08-08T01:00:00Z' }
              : p
          ),
        },
      }
    },
  })
  engine.replaceSnapshot(unchecked)

  const first = engine.commit([{ op: 'checkin', participantId: 'u1' }])
  await firstPostStartedPromise
  const second = engine.commit([{ op: 'checkin', participantId: 'u2' }])

  const checkedCount = () =>
    engine.getSnapshot()?.participants.filter((p) => p.checked_in_at).length ?? 0
  assert.equal(checkedCount(), 2)

  releaseFirst()
  await new Promise((r) => setTimeout(r, 10))
  assert.equal(checkedCount(), 2, 'partial checkin ack must not uncheck pending u2')

  await first
  await second
  assert.equal(checkedCount(), 2)
})

test('mixed assign + replace_round: debounced into one post', async () => {
  let postCount = 0
  let serverRevision = 0
  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => snapshotWithCheckedInParticipant(serverRevision),
    postPatches: async (_snap, patches) => {
      postCount += 1
      serverRevision += 1
      assert.ok(patches.some((p) => p.op === 'assign'))
      assert.ok(patches.some((p) => p.op === 'replace_round'))
      return {
        ok: true,
        snapshot: {
          ...snapshotWithCheckedInParticipant(serverRevision),
          rounds: snapshotWithCheckedInParticipant(serverRevision).rounds.map((r) =>
            r.round === 1
              ? {
                  ...r,
                  tableLanguages: { A: '영어', B: '영어', C: '영어' },
                  tableOrder: ['A', 'B', 'C'],
                  assignments: [{ participant_id: 'u1', table_label: 'C' }],
                }
              : r
          ),
        },
      }
    },
  })
  engine.replaceSnapshot(snapshotWithCheckedInParticipant(0))

  void engine.commit([
    {
      op: 'replace_round',
      round: 1,
      assignments: [],
      tableLanguages: { A: '영어', B: '영어', C: '영어' },
      tableOrder: ['A', 'B', 'C'],
    },
  ])
  void engine.commit([{ op: 'assign', round: 1, participantId: 'u1', tableLabel: 'C' }])

  await new Promise((r) => setTimeout(r, 150))
  assert.equal(postCount, 1)
  assert.deepEqual(engine.getSnapshot()?.rounds[0]?.tableOrder, ['A', 'B', 'C'])
  assert.deepEqual(round1Assignments(engine.getSnapshot()!), [
    { participant_id: 'u1', table_label: 'C' },
  ])
})

function roundWithTables(labels: string[], revision = 0): SeatingSessionSnapshot {
  const tableLanguages = Object.fromEntries(labels.map((l) => [l, '영어']))
  return {
    ...baseSnapshot(revision),
    rounds: baseSnapshot(revision).rounds.map((r) =>
      r.round === 1
        ? { ...r, tableLanguages, tableOrder: labels }
        : r
    ),
  }
}

test('rapid table adds D→L: each commit builds on live engine snapshot', async () => {
  let serverRevision = 0
  let postCount = 0
  const labelsThroughD = ['A', 'B', 'C', 'D']
  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => roundWithTables(labelsThroughD, serverRevision),
    postPatches: async (_snap, patches) => {
      postCount += 1
      serverRevision += 1
      const replace = patches.find((p) => p.op === 'replace_round')
      assert.ok(replace && replace.op === 'replace_round')
      return {
        ok: true,
        snapshot: roundWithTables(replace.tableOrder ?? labelsThroughD, serverRevision),
      }
    },
  })
  engine.replaceSnapshot(roundWithTables(labelsThroughD, 0))

  for (const label of ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
    const live = engine.getSnapshot()!
    const round = live.rounds.find((r) => r.round === 1)!
    const existing = orderedTableLabels(round.tableLanguages ?? {}, round.tableOrder)
    const nextLabels = [...existing, label]
    const tableLanguages = Object.fromEntries(nextLabels.map((l) => [l, '영어']))
    await engine.commit([
      {
        op: 'replace_round',
        round: 1,
        assignments: round.assignments,
        tableLanguages,
        tableOrder: nextLabels,
      },
    ])
    assert.deepEqual(
      orderedTableLabels(
        engine.getSnapshot()!.rounds[0]!.tableLanguages ?? {},
        engine.getSnapshot()!.rounds[0]!.tableOrder
      ),
      nextLabels,
      `after adding ${label}`
    )
  }

  await new Promise((r) => setTimeout(r, 150))
  assert.ok(postCount >= 1)
  assert.deepEqual(
    orderedTableLabels(
      engine.getSnapshot()!.rounds[0]!.tableLanguages ?? {},
      engine.getSnapshot()!.rounds[0]!.tableOrder
    ),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  )
  assert.equal(engine.getPendingCount(), 0)
})

test('stale patch ack must not regress live optimistic progress', async () => {
  let serverRevision = 0
  let releasePost!: () => void
  const postGate = new Promise<void>((r) => {
    releasePost = r
  })

  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => roundWithTables(['A', 'B', 'C', 'D'], serverRevision),
    postPatches: async () => {
      await postGate
      serverRevision += 1
      return { ok: true, snapshot: roundWithTables(['A', 'B', 'C', 'D', 'E'], serverRevision) }
    },
  })
  engine.replaceSnapshot(roundWithTables(['A', 'B', 'C', 'D'], 0))

  void engine.commit([
    {
      op: 'replace_round',
      round: 1,
      assignments: [],
      tableLanguages: { A: '영어', B: '영어', C: '영어', D: '영어', E: '영어' },
      tableOrder: ['A', 'B', 'C', 'D', 'E'],
    },
  ])
  await new Promise((r) => setTimeout(r, 110))

  for (const label of ['F', 'G', 'H', 'I', 'J', 'K', 'L']) {
    const live = engine.getSnapshot()!
    const round = live.rounds.find((r) => r.round === 1)!
    const existing = orderedTableLabels(round.tableLanguages ?? {}, round.tableOrder)
    const nextLabels = [...existing, label]
    void engine.commit([
      {
        op: 'replace_round',
        round: 1,
        assignments: [],
        tableLanguages: Object.fromEntries(nextLabels.map((l) => [l, '영어'])),
        tableOrder: nextLabels,
      },
    ])
  }

  assert.deepEqual(
    orderedTableLabels(
      engine.getSnapshot()!.rounds[0]!.tableLanguages ?? {},
      engine.getSnapshot()!.rounds[0]!.tableOrder
    ),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  )

  releasePost()
  await new Promise((r) => setTimeout(r, 150))
  assert.deepEqual(
    orderedTableLabels(
      engine.getSnapshot()!.rounds[0]!.tableLanguages ?? {},
      engine.getSnapshot()!.rounds[0]!.tableOrder
    ),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
    'partial E ack must not wipe L progress'
  )
})

test('assign ack never regresses optimistic placement', async () => {
  let serverRevision = 0
  let releasePost!: () => void
  const postGate = new Promise<void>((r) => {
    releasePost = r
  })

  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => snapshotWithCheckedInParticipant(serverRevision),
    postPatches: async () => {
      await postGate
      serverRevision += 1
      return {
        ok: true,
        snapshot: {
          ...snapshotWithCheckedInParticipant(serverRevision),
          rounds: snapshotWithCheckedInParticipant(serverRevision).rounds.map((r) =>
            r.round === 1
              ? { ...r, assignments: [{ participant_id: 'u1', table_label: 'A' }] }
              : r
          ),
        },
      }
    },
  })
  engine.replaceSnapshot(snapshotWithCheckedInParticipant(0))

  void engine.commit([{ op: 'assign', round: 1, participantId: 'u1', tableLabel: 'A' }])
  await new Promise((r) => setTimeout(r, 110))
  void engine.commit([{ op: 'assign', round: 1, participantId: 'u1', tableLabel: 'B' }])
  void engine.commit([{ op: 'assign', round: 1, participantId: 'u1', tableLabel: 'C' }])

  assert.deepEqual(round1Assignments(engine.getSnapshot()!), [
    { participant_id: 'u1', table_label: 'C' },
  ])

  releasePost()
  await new Promise((r) => setTimeout(r, 150))
  assert.deepEqual(round1Assignments(engine.getSnapshot()!), [
    { participant_id: 'u1', table_label: 'C' },
  ], 'stale A ack must not move participant back from C')
})

test('409: server snapshot wins, no retry', async () => {
  let conflicts = 0
  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => baseSnapshot(1),
    postPatches: async () => ({
      ok: false,
      conflict: 'stale_revision' as const,
      snapshot: baseSnapshot(1),
    }),
    onConflict: () => {
      conflicts += 1
    },
  })
  engine.replaceSnapshot(baseSnapshot(0))

  const ok = await engine.commit([
    {
      op: 'replace_round',
      round: 1,
      assignments: [],
      tableLanguages: { A: '영어' },
      tableOrder: ['A'],
    },
  ])

  assert.equal(ok, false)
  assert.equal(conflicts, 1)
  assert.equal(engine.getSnapshot()?.revision, 1)
})

test('hydrate blocked while outbox pending', async () => {
  let resolvePost!: (v: { ok: true; snapshot: SeatingSessionSnapshot }) => void
  const postPromise = new Promise<{ ok: true; snapshot: SeatingSessionSnapshot }>((r) => {
    resolvePost = r
  })
  let loadCalls = 0

  const engine = new SeatingSessionSyncEngine({
    loadSnapshot: async () => {
      loadCalls += 1
      return baseSnapshot(99)
    },
    postPatches: async () => postPromise,
  })
  engine.replaceSnapshot(baseSnapshot(0))

  void engine.commit([
    {
      op: 'replace_round',
      round: 1,
      assignments: [],
      tableLanguages: { A: '영어' },
      tableOrder: ['A'],
    },
  ])

  const result = await engine.hydrate()
  assert.equal(result.skipped, true)
  assert.equal(loadCalls, 0)
  assert.equal(engine.getSnapshot()?.revision, 0)

  resolvePost({ ok: true, snapshot: baseSnapshot(1) })
  await new Promise((r) => setTimeout(r, 150))
})
