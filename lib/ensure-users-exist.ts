import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * reports/praises 등은 public.users(id) FK를 갖는다.
 * Kakao 로그인 사용자 중 profiles만 있고 users 행이 없는 경우가 있어
 * insert 전에 최소 users 행을 보장한다.
 */
export async function ensureUsersExist(
  admin: SupabaseClient,
  userIds: Array<string | null | undefined>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = [
    ...new Set(
      userIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    ),
  ]
  if (ids.length === 0) return { ok: true }

  const { data: existing, error: existingErr } = await admin
    .from('users')
    .select('id')
    .in('id', ids)

  if (existingErr) {
    console.error('[ensureUsersExist] select users', existingErr)
    return { ok: false, error: existingErr.message }
  }

  const existingSet = new Set((existing || []).map((r) => r.id as string))
  const missing = ids.filter((id) => !existingSet.has(id))
  if (missing.length === 0) return { ok: true }

  const { data: profiles, error: profilesErr } = await admin
    .from('profiles')
    .select('id, name')
    .in('id', missing)

  if (profilesErr) {
    console.error('[ensureUsersExist] select profiles', profilesErr)
    return { ok: false, error: profilesErr.message }
  }

  const profileById = new Map((profiles || []).map((p) => [p.id as string, p]))
  const rows = missing
    .filter((id) => profileById.has(id))
    .map((id) => ({
      id,
      name: (profileById.get(id)?.name as string | null) || null,
      onboarding_completed: false,
    }))

  if (rows.length === 0) {
    return {
      ok: false,
      error: `missing_users_without_profiles:${missing.join(',')}`,
    }
  }

  const { error: upsertErr } = await admin.from('users').upsert(rows, { onConflict: 'id' })
  if (upsertErr) {
    console.error('[ensureUsersExist] upsert', upsertErr)
    return { ok: false, error: upsertErr.message }
  }

  // profile이 없는 id가 남아 있으면 여전히 FK 실패 가능
  const stillMissing = missing.filter((id) => !profileById.has(id))
  if (stillMissing.length > 0) {
    return {
      ok: false,
      error: `missing_users_without_profiles:${stillMissing.join(',')}`,
    }
  }

  return { ok: true }
}
