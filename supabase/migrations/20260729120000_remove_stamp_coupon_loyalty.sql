-- 쿠폰/스탬프 로열티 프로그램 전체 폐지 1단계: 체크인 자동 스탬프 적립 트리거 제거
-- (le_stamp_progress / le_reward_coupons 컬럼 자체는 과거 기록 보존을 위해 당분간 유지)

DROP TRIGGER IF EXISTS form_responses_bump_le_stamp ON public.form_responses;
DROP FUNCTION IF EXISTS public.trg_bump_le_stamp_on_checkin();

COMMENT ON COLUMN public.users.le_stamp_progress IS
  'DEPRECATED (2026-07-29): 쿠폰/스탬프 로열티 프로그램 폐지. 신규 적립 없음. 과거 기록 조회용으로만 보존.';
COMMENT ON COLUMN public.users.le_reward_coupons IS
  'DEPRECATED (2026-06-20): 디지털 쿠폰 자동 지급/차감 폐지. 2026-07-29부터 스탬프 적립도 완전 중단.';
