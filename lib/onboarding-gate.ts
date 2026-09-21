import type { SupabaseClient } from '@supabase/supabase-js'

export function buildOnboardingUrl(returnPath: string): string {
  const safe =
    returnPath.startsWith('/') && !returnPath.startsWith('//') ? returnPath : '/'
  return `/auth/onboarding?next=${encodeURIComponent(safe)}`
}

export async function isOnboardingCompleted(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('id', userId)
    .maybeSingle()
  return !!data?.onboarding_completed
}
