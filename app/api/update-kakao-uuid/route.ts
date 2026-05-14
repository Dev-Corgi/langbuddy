import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  console.log('🔄 [Update Kakao UUID] Request received')
  
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [Update Kakao UUID] Not authenticated:', authError)
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('✅ [Update Kakao UUID] User authenticated:', user.id)
    console.log('🔍 [Update Kakao UUID] User app_metadata:', user.app_metadata)
    console.log('🔍 [Update Kakao UUID] User user_metadata:', user.user_metadata)
    console.log('🔍 [Update Kakao UUID] User identities:', user.identities)

    // Check if Kakao provider
    if (user.app_metadata?.provider !== 'kakao') {
      console.log('⏭️ [Update Kakao UUID] Not a Kakao user')
      return NextResponse.json({
        success: false,
        message: 'Not a Kakao user'
      });
    }

    // Try to extract UUID from various sources
    const kakaoUuid = user.user_metadata?.provider_id || 
                     user.user_metadata?.sub || 
                     user.identities?.[0]?.id ||
                     user.id;

    console.log('📝 [Update Kakao UUID] Extracted UUID:', kakaoUuid)

    // Update users table
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({
        kakao_uuid: kakaoUuid,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select();

    if (updateError) {
      console.error('❌ [Update Kakao UUID] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update UUID', details: updateError },
        { status: 500 }
      );
    }

    console.log('✅ [Update Kakao UUID] UUID updated successfully:', updateData)

    return NextResponse.json({
      success: true,
      kakaoUuid,
      message: 'Kakao UUID updated successfully'
    });

  } catch (error) {
    console.error('❌ [Update Kakao UUID] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
