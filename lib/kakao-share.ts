// Kakao Share utility functions
declare global {
  interface Window {
    Kakao: any;
  }
}

export function initKakaoSDK(appKey: string) {
  if (typeof window === 'undefined') return;
  
  if (!window.Kakao) {
    const script = document.createElement('script');
    script.src = 'https://developers.kakao.com/sdk/js/kakao.min.js';
    script.async = true;
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(appKey);
        console.log('✅ Kakao SDK initialized');
      }
    };
    document.head.appendChild(script);
  } else if (!window.Kakao.isInitialized()) {
    window.Kakao.init(appKey);
    console.log('✅ Kakao SDK initialized');
  }
}

export function shareQRToKakao(params: {
  qrCode: string;
  formTitle: string;
  name: string;
  day?: string;
  paymentMethod?: string;
  qrImageUrl: string;
}) {
  if (typeof window === 'undefined' || !window.Kakao) {
    console.error('Kakao SDK not loaded');
    return false;
  }

  try {
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '🎉 LangBuddy 신청 완료!',
        description: `${params.formTitle}\n이름: ${params.name}${params.day ? `\n요일: ${params.day}` : ''}`,
        imageUrl: params.qrImageUrl,
        link: {
          mobileWebUrl: window.location.href,
          webUrl: window.location.href,
        },
      },
      buttons: [
        {
          title: 'QR 코드 확인',
          link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href,
          },
        },
      ],
    });
    return true;
  } catch (error) {
    console.error('Kakao share error:', error);
    return false;
  }
}

export async function sendQRToKakaoTalk(params: {
  kakaoId: string;
  qrCode: string;
  formTitle: string;
  name: string;
  responseId: string;
}) {
  try {
    const response = await fetch('/api/send-kakao-qr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Failed to send Kakao message');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending QR to KakaoTalk:', error);
    throw error;
  }
}
