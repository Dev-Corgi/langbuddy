import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'
import { ensureValidKakaoAccessToken } from '@/lib/kakao-token-ensure'
import { expiryIsoFromKakaoAccessToken } from '@/lib/kakao-oauth'
import { buildRecurringSessionDisplayTitles, resolveApplicationSessionYmd } from '@/lib/session-event-date'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * 요청에 실린 Supabase 세션 쿠키에서, 대상 사용자 본인이 호출한 경우에만
 * 최신 Kakao provider_token을 가져온다. (Supabase가 세션 갱신 시 함께 돌아오는 값)
 * 관리자가 다른 userId로 보낼 때는 세션 uid가 달라 null → DB 저장 토큰 사용.
 */
async function getLiveKakaoTokenForUser(requestUserId: string): Promise<string | null> {
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          /* Route Handler에서 set 실패는 무시 */
        }
      },
    },
  })
  const {
    data: { session },
  } = await supabaseAuth.auth.getSession()
  if (!session?.user?.id || session.user.id !== requestUserId) {
    return null
  }
  return typeof session.provider_token === 'string' && session.provider_token.length > 0
    ? session.provider_token
    : null
}

export async function POST(request: NextRequest) {
  console.log('🚀 [Kakao QR API] Request received')
  
  try {
    const body = await request.json();
    const { kakaoId, qrCode, formTitle, name, responseId, userId } = body;

    console.log('📋 [Kakao QR API] Request body:', {
      kakaoId: kakaoId ? `${kakaoId.substring(0, 10)}...` : 'missing',
      qrCode: qrCode ? `${qrCode.substring(0, 8)}...` : 'missing',
      formTitle,
      name,
      responseId,
      userId: userId ? 'provided' : 'missing',
    })

    if (!kakaoId || !qrCode || !userId || !responseId) {
      console.error('❌ [Kakao QR API] Missing required fields:', {
        kakaoId: !!kakaoId,
        qrCode: !!qrCode,
        userId: !!userId,
        responseId: !!responseId,
      })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: responseRow, error: responseErr } = await supabase
      .from('form_responses')
      .select('id, user_id, answers, created_at, form_id, qr_code')
      .eq('id', responseId)
      .single()

    if (responseErr || !responseRow) {
      console.error('❌ [Kakao QR API] Response load:', responseErr)
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (responseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (responseRow.qr_code && responseRow.qr_code !== qrCode) {
      return NextResponse.json({ error: 'QR mismatch' }, { status: 400 })
    }

    console.log('🎨 [Kakao QR API] Generating QR image...')
    // Generate QR code as PNG buffer
    const qrImageBuffer = await QRCode.toBuffer(qrCode, {
      width: 600,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      type: 'png',
    });
    console.log('✅ [Kakao QR API] QR image generated, size:', qrImageBuffer.length, 'bytes')

    // Upload QR image to Supabase Storage
    console.log('☁️ [Kakao QR API] Uploading to Supabase Storage...')
    const fileName = `qr-${responseId}-${Date.now()}.png`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('qr-codes')
      .upload(fileName, qrImageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('❌ [Kakao QR API] Supabase upload error:', uploadError);
      throw uploadError;
    }
    console.log('✅ [Kakao QR API] Upload successful:', fileName)

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('qr-codes')
      .getPublicUrl(fileName);

    console.log('🔗 [Kakao QR API] Public URL:', publicUrl);

    const liveToken = await getLiveKakaoTokenForUser(userId)
    let kakaoAccessToken: string | null = null

    if (liveToken) {
      kakaoAccessToken = liveToken
      const syncedExp =
        expiryIsoFromKakaoAccessToken(liveToken) ??
        new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('users')
        .update({
          kakao_access_token: liveToken,
          kakao_token_expires_at: syncedExp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
      console.log('🔍 [Kakao QR API] Using session provider_token; synced expiry to DB')
    } else {
      const ensured = await ensureValidKakaoAccessToken(supabase, userId)
      if (!ensured.ok) {
        if (ensured.code === 'user_not_found') {
          return NextResponse.json({
            success: false,
            qrImageUrl: publicUrl,
            message:
              'DB에서 사용자를 찾을 수 없어 카카오톡으로 보내지 못했습니다. 사용자 프로필을 확인해 주세요.',
            messageEn: 'Could not load user for Kakao send.',
            kakaoSendStatus: 'user_not_found',
          })
        }
        if (ensured.code === 'no_refresh_token') {
          return NextResponse.json({
            success: false,
            qrImageUrl: publicUrl,
            message:
              '카카오 액세스 토큰이 만료되었거나 없고, 저장된 refresh_token도 없습니다. 카카오로 다시 로그인해 주세요.',
            messageEn:
              'No valid Kakao access token and no refresh token. Please sign in with Kakao again.',
            kakaoSendStatus: 'token_expired',
          })
        }
        return NextResponse.json({
          success: false,
          qrImageUrl: publicUrl,
          message: `카카오 토큰 갱신 실패: ${ensured.message || ensured.code}`,
          messageEn: 'Kakao token refresh failed.',
          kakaoSendStatus: 'refresh_failed',
          kakaoError: ensured.kakao,
        })
      }
      kakaoAccessToken = ensured.accessToken
      console.log('🔍 [Kakao QR API] Using DB / refreshed Kakao access token')
    }

    if (!kakaoAccessToken) {
      console.warn('⚠️ [Kakao QR API] No Kakao access token after resolve')
      return NextResponse.json({
        success: false,
        qrImageUrl: publicUrl,
        message:
          '카카오 액세스 토큰을 가져오지 못했습니다. 카카오로 다시 로그인한 뒤 시도해 주세요.',
        messageEn: 'Could not obtain Kakao access token. Sign in with Kakao again.',
        kakaoSendStatus: 'no_token',
      })
    }

    // Kakao Channel Message API call
    // Note: This requires the user to be a friend of your Kakao Channel
    console.log('📨 [Kakao QR API] Preparing Kakao message...')

    let recurringKind: 'language' | 'study' | null = null
    if (responseRow.form_id) {
      const [{ data: leRow }, { data: stRow }] = await Promise.all([
        supabase
          .from('language_exchange_schedules')
          .select('form_id')
          .eq('form_id', responseRow.form_id as string)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('study_schedules')
          .select('form_id')
          .eq('form_id', responseRow.form_id as string)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle(),
      ])
      recurringKind = leRow ? 'language' : stRow ? 'study' : null
    }

    const answers = (responseRow.answers || {}) as Record<string, unknown>
    const sessionYmd = resolveApplicationSessionYmd(
      answers._selected_day,
      answers._event_date,
      (responseRow.created_at as string) || new Date().toISOString()
    )
    const builtTitles =
      recurringKind && sessionYmd.length >= 10
        ? buildRecurringSessionDisplayTitles(answers._selected_day, sessionYmd, recurringKind)
        : null
    const displayEventTitle =
      builtTitles?.title ||
      (typeof formTitle === 'string' && formTitle.trim()) ||
      'LangBuddy'

    const templateObject = {
      object_type: 'feed',
      content: {
        title: '🎉 LangBuddy 신청 완료!',
        description: `${displayEventTitle}\n이름: ${name}\n\n아래 QR 코드를 행사 현장에서 제시해주세요.`,
        image_url: publicUrl,
        image_width: 600,
        image_height: 600,
        link: {
          web_url: `${process.env.NEXT_PUBLIC_APP_URL}/apply/complete?id=${responseId}`,
          mobile_web_url: `${process.env.NEXT_PUBLIC_APP_URL}/apply/complete?id=${responseId}`,
        },
      },
      buttons: [
        {
          title: 'QR 코드 다시 보기',
          link: {
            web_url: `${process.env.NEXT_PUBLIC_APP_URL}/apply/complete?id=${responseId}`,
            mobile_web_url: `${process.env.NEXT_PUBLIC_APP_URL}/apply/complete?id=${responseId}`,
          },
        },
      ],
    }

    console.log('📨 [Kakao QR API] Template object:', JSON.stringify(templateObject, null, 2))
    console.log('📨 [Kakao QR API] Using "Send to Me" API...')
    console.log('📨 [Kakao QR API] Access token (prefix):', kakaoAccessToken.substring(0, 20) + '...')

    // Use "Send to Me" API - no business registration required
    const kakaoResponse = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kakaoAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        template_object: JSON.stringify(templateObject),
      }),
    });

    console.log('📥 [Kakao QR API] Response status:', kakaoResponse.status)
    console.log('📥 [Kakao QR API] Response headers:', Object.fromEntries(kakaoResponse.headers.entries()))

    const kakaoResult = await kakaoResponse.json();
    console.log('📥 [Kakao QR API] Response body:', kakaoResult)

    if (!kakaoResponse.ok) {
      console.error('❌ [Kakao QR API] Kakao API error:', kakaoResult);
      const msg =
        typeof kakaoResult?.msg === 'string'
          ? kakaoResult.msg
          : typeof kakaoResult?.message === 'string'
            ? kakaoResult.message
            : '카카오 API 응답 오류'
      return NextResponse.json({
        success: false,
        qrImageUrl: publicUrl,
        message: `카카오톡 전송에 실패했습니다: ${msg}`,
        messageEn: 'KakaoTalk send failed.',
        kakaoSendStatus: 'failed',
        kakaoError: kakaoResult,
      });
    }

    console.log('✅ [Kakao QR API] Kakao message sent successfully!');

    return NextResponse.json({
      success: true,
      qrImageUrl: publicUrl,
      message: 'QR code sent to KakaoTalk successfully',
      kakaoSendStatus: 'sent',
    });

  } catch (error) {
    console.error('Error in send-kakao-qr:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
