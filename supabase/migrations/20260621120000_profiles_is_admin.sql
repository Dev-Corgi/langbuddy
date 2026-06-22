-- 일반 관리자 패널 접근 (번개 등). is_superadmin 과 별도.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS
  'Admin panel access for meetup managers. Super admins use is_superadmin.';
