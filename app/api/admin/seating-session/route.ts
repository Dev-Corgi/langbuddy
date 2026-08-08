import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import {
  assembleSeatingSessionSnapshot,
  resolveTodayLanguageExchangeSession,
} from '@/lib/seating-session-server/assemble'
import { getStaffOpsUser } from '@/lib/seating-session-server/staff-auth'
import { koreanWeekdayLetterSeoul, todayYYYYMMDDSeoul } from '@/lib/session-event-date'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getStaffOpsUser(supabase)
    if (!user) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const sessionDate =
      request.nextUrl.searchParams.get('sessionDate')?.trim().slice(0, 10) ||
      todayYYYYMMDDSeoul()
    const dayOfWeek =
      request.nextUrl.searchParams.get('dayOfWeek')?.trim() || koreanWeekdayLetterSeoul()

    const admin = createSupabaseAdmin()
    const resolved = await resolveTodayLanguageExchangeSession(admin, sessionDate, dayOfWeek)
    if (!resolved) {
      return NextResponse.json({ error: 'no_active_session' }, { status: 404 })
    }

    const postingIdParam = request.nextUrl.searchParams.get('postingId')?.trim()
    const postingId = postingIdParam || resolved.postingId

    const snapshot = await assembleSeatingSessionSnapshot(admin, {
      postingId,
      sessionDate,
      formId: resolved.formId,
      dayOfWeek,
      epoch: resolved.epoch,
      revision: resolved.revision,
      seatingConfig: resolved.seatingConfig,
    })

    const [{ data: postingRow }, { data: qRows }] = await Promise.all([
      admin.from('postings').select('title').eq('id', postingId).single(),
      admin
        .from('form_questions')
        .select('*')
        .eq('form_id', resolved.formId)
        .order('display_order', { ascending: true }),
    ])

    return NextResponse.json({
      snapshot,
      meta: {
        title: (postingRow?.title as string | null) ?? '',
        formQuestions: qRows ?? [],
      },
    })
  } catch (err) {
    console.error('[seating-session GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
