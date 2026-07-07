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
  isWalkInAnswers,
  mapFormResponseToWalkInParticipant,
} from '@/lib/walk-in-participant'
import {
  defaultPaymentStatusForMethod,
  isSupportedPaymentMethod,
  parseOptionalPaymentMethod,
  type PaymentMethod,
} from '@/lib/supported-payment-methods'
import { isSupportedLanguage } from '@/lib/supported-languages'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const genderRaw = typeof body.gender === 'string' ? body.gender : ''
    const nationalityRaw = typeof body.nationality === 'string' ? body.nationality : ''
    const languageRaw = typeof body.language === 'string' ? body.language.trim() : ''
    const gender = normalizeGender(genderRaw)
    const nationality = normalizeNationality(nationalityRaw)
    const language = normalizeLanguage(languageRaw)
    const paymentMethod = parseOptionalPaymentMethod(body.paymentMethod)

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
    if (body.paymentMethod !== undefined && !paymentMethod) {
      return NextResponse.json({ error: 'invalid_payment_method' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const { data: existing, error: loadErr } = await admin
      .from('form_responses')
      .select('id, answers, checked_in_at, created_at, payment_status, payment_receipt_url')
      .eq('id', id)
      .single()

    if (loadErr || !existing) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const prevAnswers = (existing.answers || {}) as Record<string, unknown>
    if (!isWalkInAnswers(prevAnswers)) {
      return NextResponse.json({ error: 'not_walk_in' }, { status: 400 })
    }

    const sessionDate =
      typeof prevAnswers._event_date === 'string'
        ? prevAnswers._event_date.slice(0, 10)
        : ''
    const selectedDay =
      typeof prevAnswers._selected_day === 'string'
        ? prevAnswers._selected_day.trim()
        : ''

    if (!sessionDate || !selectedDay) {
      return NextResponse.json({ error: 'invalid_walk_in_session' }, { status: 400 })
    }

    let resolvedPaymentMethod: PaymentMethod = '현장현금'
    if (paymentMethod) {
      resolvedPaymentMethod = paymentMethod
    } else {
      const prevMethod =
        typeof prevAnswers._payment_method === 'string'
          ? prevAnswers._payment_method.trim()
          : ''
      if (isSupportedPaymentMethod(prevMethod)) {
        resolvedPaymentMethod = prevMethod
      }
    }

    const hasReceipt = Boolean(existing.payment_receipt_url)
    let payment_status: string | null = existing.payment_status ?? null
    if (paymentMethod !== undefined) {
      if (paymentMethod === '계좌이체') {
        if (existing.payment_status === 'confirmed' && hasReceipt) {
          payment_status = 'confirmed'
        } else {
          payment_status = defaultPaymentStatusForMethod(paymentMethod, hasReceipt)
        }
      } else {
        payment_status = null
      }
    }

    const updatePayload: Record<string, unknown> = {
      answers: buildWalkInAnswers({
        name,
        gender,
        nationality,
        language,
        sessionDate,
        selectedDay,
        paymentMethod: resolvedPaymentMethod,
      }),
    }
    if (paymentMethod !== undefined) {
      updatePayload.payment_status = payment_status
    }

    const { data: row, error } = await admin
      .from('form_responses')
      .update(updatePayload)
      .eq('id', id)
      .select('id, answers, checked_in_at, created_at, payment_status, payment_receipt_url')
      .single()

    if (error || !row) {
      console.error('[walk-in-participant] patch error:', error)
      return NextResponse.json(
        { error: error?.message || 'update_failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      participant: mapFormResponseToWalkInParticipant(row),
    })
  } catch (err) {
    console.error('[walk-in-participant] unexpected PATCH:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
