-- 언어교환 요일별 장소 영문 표기 (영어 UI용)
ALTER TABLE public.language_exchange_schedules
  ADD COLUMN IF NOT EXISTS location_en text;

COMMENT ON COLUMN public.language_exchange_schedules.location_en IS
  '장소 영문 표기. 영어 UI에서 location 대신 표시. 비어 있으면 location fallback.';
