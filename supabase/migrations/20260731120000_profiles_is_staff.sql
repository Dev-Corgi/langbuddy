-- 유저 관리 Role: 스탭(현장 운영) 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_staff IS
  '스탭: QR 체크인·자리배치 등 현장 운영 메뉴 접근. is_superadmin/is_admin 과 배타적으로 사용.';
