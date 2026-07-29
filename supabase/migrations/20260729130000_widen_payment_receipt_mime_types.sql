-- 계좌이체 영수증 업로드 버그 수정: 아이폰 카메라 촬영(HEIC/HEIF)이나 일부 안드로이드
-- 편집 앱(WEBP)으로 저장된 이미지가 jpeg/png만 허용하던 버킷 정책 때문에 업로드 거부되던 문제 해결.
-- (한국인 유저 다수가 "계좌이체 스샷 업로드 안됨" 문의)

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']::text[]
WHERE id = 'payment-receipts';
