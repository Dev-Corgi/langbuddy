-- seating_assignments: 날짜별 스냅샷 (supabase_update.sql 와 동일 — 원격 DB에 미적용 시 저장 실패 방지)
-- 오류: column seating_assignments.session_date does not exist

ALTER TABLE public.seating_assignments
  ADD COLUMN IF NOT EXISTS session_date text;

CREATE INDEX IF NOT EXISTS idx_seating_assignments_posting_session
  ON public.seating_assignments (posting_id, session_date);

COMMENT ON COLUMN public.seating_assignments.session_date IS 'Asia/Seoul 기준 YYYY-MM-DD; NULL은 마이그레이션 전 레거시 한 덩어리 스냅샷';
