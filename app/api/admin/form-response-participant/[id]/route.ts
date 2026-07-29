import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-api-auth'
import {
  normalizeGender,
  normalizeLanguage,
  normalizeNationality,
  type CanonicalFormQuestion,
} from '@/lib/form-answer-canonical'
import { mergeParticipantFieldPatchIntoAnswers } from '@/lib/admin-participant-patch'
import { uploadPaymentReceipt } from '@/lib/payment-receipt-upload'
import {
  isSupportedPaymentMethod,
  type PaymentMethod,
} from '@/lib/supported-payment-methods'
import {
  isWalkInAnswers,
  mapFormResponseToParticipant,
} from '@/lib/walk-in-participant'
import { isSupportedLanguage } from '@/lib/supported-languages'

type RouteContext = { params: Promise<{ id: string }> }

function parsePaymentMethod(body: Record<string, unknown>): PaymentMethod | undefined {
  if (body.paymentMethod === undefined) return undefined
  const raw = typeof body.paymentMethod === 'string' ? body.paymentMethod.trim() : ''
  if (!isSupportedPaymentMethod(raw)) return undefined
  return raw
}

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
    const paymentMethod = parsePaymentMethod(body as Record<string, unknown>)

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
      .select(
        'id, form_id, user_id, answers, checked_in_at, created_at, payment_status, payment_receipt_url'
      )
      .eq('id', id)
      .single()

    if (loadErr || !existing) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const prevAnswers = (existing.answers || {}) as Record<string, unknown>
    if (isWalkInAnswers(prevAnswers)) {
      return NextResponse.json({ error: 'use_walk_in_endpoint' }, { status: 400 })
    }

    const { data: questionRows, error: qErr } = await admin
      .from('form_questions')
      .select('id, system_key, question_type, options, options_en')
      .eq('form_id', existing.form_id)

    if (qErr) {
      console.error('[form-response-participant] questions error:', qErr)
      return NextResponse.json({ error: 'questions_load_failed' }, { status: 500 })
    }

    const questions = (questionRows || []) as CanonicalFormQuestion[]
    const { answers: nextAnswers, payment_status } = mergeParticipantFieldPatchIntoAnswers(
      prevAnswers,
      questions,
      {
        name,
        gender,
        nationality,
        language,
        paymentMethod,
      },
      {
        hasReceipt: Boolean(existing.payment_receipt_url),
        previousPaymentStatus: existing.payment_status,
      }
    )

    const updatePayload: Record<string, unknown> = { answers: nextAnswers }
    if (paymentMethod !== undefined) {
      updatePayload.payment_status = payment_status
    }

    const { data: row, error } = await admin
      .from('form_responses')
      .update(updatePayload)
      .eq('id', id)
      .select(
        'id, user_id, answers, checked_in_at, created_at, payment_status, payment_receipt_url'
      )
      .single()

    if (error || !row) {
      console.error('[form-response-participant] patch error:', error)
      return NextResponse.json(
        { error: error?.message || 'update_failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      participant: mapFormResponseToParticipant(row, questions),
    })
  } catch (err) {
    console.error('[form-response-participant] unexpected PATCH:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const adminUser = await getAdminUser(supabase)
    if (!adminUser) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'file_required' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const { data: existing, error: loadErr } = await admin
      .from('form_responses')
      .select('id, form_id, answers, payment_status, payment_receipt_url')
      .eq('id', id)
      .single()

    if (loadErr || !existing) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const publicUrl = await uploadPaymentReceipt(admin, id, file, file.name)

    const prevAnswers = (existing.answers || {}) as Record<string, unknown>
    const nextAnswers = {
      ...prevAnswers,
      _payment_method: '계좌이체',
    }

    const payment_status =
      existing.payment_status === 'confirmed' ? 'confirmed' : 'pending'

    const { data: questionRows } = await admin
      .from('form_questions')
      .select('id, system_key, question_type, options, options_en')
      .eq('form_id', existing.form_id)

    const { data: row, error } = await admin
      .from('form_responses')
      .update({
        answers: nextAnswers,
        payment_receipt_url: publicUrl,
        payment_status,
      })
      .eq('id', id)
      .select(
        'id, user_id, answers, checked_in_at, created_at, payment_status, payment_receipt_url'
      )
      .single()

    if (error || !row) {
      console.error('[form-response-participant] receipt upload error:', error)
      return NextResponse.json(
        { error: error?.message || 'upload_failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      participant: mapFormResponseToParticipant(
        row,
        (questionRows || []) as CanonicalFormQuestion[]
      ),
    })
  } catch (err) {
    console.error('[form-response-participant] unexpected POST receipt:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
