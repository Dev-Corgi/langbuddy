# 카카오톡 QR 자동 전송 기능 설정 가이드

## 개요
신청 완료 시 사용자의 카카오톡으로 QR 코드 이미지가 **자동으로 전송**되는 기능입니다.
**사업자 등록 없이** 개인 카카오 계정만으로 카카오톡 채널 메시지 API를 사용합니다.

## 필수 설정

### 1. Supabase Storage 버킷 생성
1. Supabase 대시보드 > Storage
2. 새 버킷 생성: `qr-codes`
3. Public 버킷으로 설정 (QR 이미지 접근 가능하도록)

### 2. 카카오톡 채널 개설 (무료, 개인 가능)
1. [카카오톡 채널 관리자센터](https://center-pf.kakao.com/) 접속
2. 새 채널 만들기
3. 개인 카카오 계정으로 채널 개설 (사업자 등록 불필요)
4. 채널 ID 확인 (예: `_abc1234`)

### 3. 카카오 개발자 앱 생성
1. [Kakao Developers](https://developers.kakao.com/) 접속
2. 내 애플리케이션 > 애플리케이션 추가하기
3. 앱 이름 입력 후 생성

### 4. 카카오 로그인 활성화
1. 제품 설정 > 카카오 로그인 > 활성화 설정 ON
2. Redirect URI 등록:
   - `http://localhost:3000/auth/callback`
   - `https://yourdomain.com/auth/callback`

### 5. 친구 목록 가져오기 권한 설정
1. 제품 설정 > 카카오 로그인 > 동의 항목
2. "카카오톡 채널 추가 상태" 항목 활성화
3. "친구 목록 가져오기" 권한 설정

### 6. API 키 발급
1. 앱 설정 > 요약 정보
2. **REST API 키** 복사

### 7. 환경 변수 설정
`.env.local` 파일에 다음 내용 추가:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Kakao Channel Message API (개인 계정 가능)
KAKAO_REST_API_KEY=your_kakao_rest_api_key
KAKAO_CHANNEL_ID=_your_channel_id

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 작동 방식

### 자동 전송 플로우
1. 사용자가 신청 폼 제출
2. 서버가 QR 코드 생성
3. **자동으로 다음 작업 수행:**
   - QR 이미지를 PNG로 생성
   - Supabase Storage에 업로드
   - 사용자가 입력한 카카오 ID로 메시지 전송
   - 메시지에 QR 이미지 포함
4. 사용자 카카오톡에 QR 도착

### 수동 재전송
완료 페이지에서 "카카오톡 전송" 버튼을 눌러 재전송 가능

## API 엔드포인트

### POST `/api/send-kakao-qr`
QR 코드를 생성하고 카카오톡으로 전송

**Request Body:**
```json
{
  "kakaoId": "user_kakao_id",
  "qrCode": "uuid_qr_code",
  "formTitle": "Form Title",
  "name": "User Name",
  "responseId": "response_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "qrImageUrl": "https://...",
  "message": "QR code sent to KakaoTalk successfully",
  "kakaoSendStatus": "sent"
}
```

## 메시지 형식
카카오톡으로 전송되는 메시지:
- **제목**: 🎉 {폼 제목} 신청이 완료되었습니다!
- **내용**: 이름, QR 코드 안내
- **이미지**: QR 코드 PNG
- **버튼**: "QR 코드 다시 보기" (완료 페이지 링크)

## 중요 사항

### 사용자가 채널 친구여야 함
- 메시지를 받으려면 사용자가 **카카오톡 채널을 친구 추가**해야 합니다
- 신청 폼에 "채널 친구 추가 필수" 안내 추가 권장
- 채널 친구가 아닌 경우 메시지 전송 실패

### 비용
- 카카오톡 채널 메시지는 **무료**입니다
- 사업자 등록 불필요
- 알림톡과 달리 비용 발생 없음

### UUID vs 카카오 ID
- API는 사용자의 **UUID**(친구 고유 ID)를 사용합니다
- 사용자가 입력하는 "카카오 ID"와는 다릅니다
- 실제 구현 시 OAuth로 UUID를 받아와야 합니다

## 트러블슈팅

### QR 이미지가 업로드되지 않는 경우
- Supabase Storage 버킷 `qr-codes` 생성 확인
- 버킷이 Public으로 설정되어 있는지 확인
- `SUPABASE_SERVICE_ROLE_KEY` 환경 변수 확인

### 카카오톡 메시지가 전송되지 않는 경우
- `KAKAO_REST_API_KEY`, `KAKAO_CHANNEL_ID` 환경 변수 확인
- 사용자가 채널 친구인지 확인
- 카카오 로그인 권한 설정 확인
- 서버 로그에서 에러 메시지 확인

### API 키가 설정되지 않은 경우
- QR 이미지는 Supabase에 업로드되지만 카카오톡 전송은 건너뜀
- 콘솔에 'Kakao API not configured' 경고 표시

## 대안: 카카오 i 오픈빌더 사용

더 간단한 방법으로 **카카오 i 오픈빌더**를 사용할 수도 있습니다:

1. [카카오 i 오픈빌더](https://i.kakao.com/) 접속
2. 챗봇 생성 및 시나리오 구성
3. Webhook 연동으로 외부 서버와 통신
4. 사용자가 채널에 메시지를 보내면 자동 응답

이 방법은 코딩 없이도 기본적인 자동화가 가능합니다.
