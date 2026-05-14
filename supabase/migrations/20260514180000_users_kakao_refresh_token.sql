-- 카카오 OAuth refresh_token (서버 전용). 클라이언트 RLS에서 SELECT하지 말 것.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS kakao_refresh_token text;

COMMENT ON COLUMN public.users.kakao_refresh_token IS
  'Kakao OAuth refresh_token. Use only from server (service role). Prefer not exposing via anon/authenticated SELECT policies.';
