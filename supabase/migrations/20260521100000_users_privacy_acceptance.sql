-- 온보딩 시 개인정보 처리방침 동의 기록

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS privacy_policy_version TEXT;

COMMENT ON COLUMN public.users.privacy_accepted_at IS '온보딩 완료 시점 개인정보 처리방침 동의 시각';
COMMENT ON COLUMN public.users.privacy_policy_version IS '동의 시 기준 처리방침 버전(시행일 등)';
