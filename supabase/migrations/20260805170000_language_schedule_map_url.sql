-- 요일별 언어교환 장소에 네이버 지도 등 외부 링크를 저장.
-- 비어 있으면 클라이언트에서 location 텍스트로 검색 URL fallback.
ALTER TABLE public.language_exchange_schedules
  ADD COLUMN IF NOT EXISTS location_map_url text;

COMMENT ON COLUMN public.language_exchange_schedules.location_map_url IS
  '장소 안내용 지도 URL(주로 네이버 지도). NULL/빈 값이면 location 텍스트로 검색 링크 생성.';
