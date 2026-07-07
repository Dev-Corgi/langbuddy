import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import {
  normalizeGender,
  normalizeLanguage,
  normalizeNationality,
} from '@/lib/form-answer-canonical'
import {
  buildWalkInAnswers,
  mapFormResponseToWalkInParticipant,
} from '@/lib/walk-in-participant'
import {
  koreanWeekdayLetterSeoul,
  todayYYYYMMDDSeoul,
} from '@/lib/session-event-date'
import { isSupportedLanguage } from '@/lib/supported-languages'
import {
  defaultPaymentStatusForMethod,
  parseOptionalPaymentMethod,
  type PaymentMethod,
} from '@/lib/supported-payment-methods'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const formId = body.formId as string | undefined
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const genderRaw = typeof body.gender === 'string' ? body.gender : ''
    const nationalityRaw = typeof body.nationality === 'string' ? body.nationality : ''
    const languageRaw = typeof body.language === 'string' ? body.language.trim() : ''
    const gender = normalizeGender(genderRaw)
    const nationality = normalizeNationality(nationalityRaw)
    const language = normalizeLanguage(languageRaw)
    const sessionDate =
      typeof body.sessionDate === 'string' && body.sessionDate.length >= 10
        ? body.sessionDate.slice(0, 10)
        : todayYYYYMMDDSeoul()
    const selectedDay =
      typeof body.selectedDay === 'string' && body.selectedDay.trim()
        ? body.selectedDay.trim()
        : koreanWeekdayLetterSeoul()

    if (!formId) {
      return NextResponse.json({ error: 'missing_form_id' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 })
    }
    if (gender !== '남' && gender !== '여') {
      return NextResponse.json({ error: 'invalid_gender' }, { status: 400 })
    }
    if (nationality !== '한국인' && nationality !== '외국인') {
      return NextResponse.json({ error: 'invalid_nationality' }, { status: 400 })
    }
    if (!language) {
      return NextResponse.json({ error: 'language_required' }, { status: 400 })
    }
    if (!isSupportedLanguage(language)) {
      return NextResponse.json({ error: 'invalid_language' }, { status: 400 })
    }

    const paymentMethodRaw = parseOptionalPaymentMethod(body.paymentMethod)
    if (body.paymentMethod !== undefined && !paymentMethodRaw) {
      return NextResponse.json({ error: 'invalid_payment_method' }, { status: 400 })
    }
    const paymentMethod: PaymentMethod = paymentMethodRaw ?? '현장현금'

    const admin = createSupabaseAdmin()
    const checkedInAt = new Date().toISOString()

    const { data: row, error } = await admin
      .from('form_responses')
      .insert({
        form_id: formId,
        answers: buildWalkInAnswers({
          name,
          gender,
          nationality,
          language,
          sessionDate,
          selectedDay,
          paymentMethod,
        }),
        checked_in_at: checkedInAt,
        payment_status: defaultPaymentStatusForMethod(paymentMethod, false),
        user_id: null,
        qr_code: null,
      })
      .select('id, answers, checked_in_at, created_at, payment_status, payment_receipt_url')
      .single()

    if (error || !row) {
      console.error('[walk-in-participant] insert error:', error)
      return NextResponse.json(
        { error: error?.message || 'insert_failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      participant: mapFormResponseToWalkInParticipant(row),
    })
  } catch (err) {
    console.error('[walk-in-participant] unexpected POST:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
