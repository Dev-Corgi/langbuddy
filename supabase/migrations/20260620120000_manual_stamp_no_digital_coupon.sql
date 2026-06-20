-- 실물 쿠폰·수동 스탬프 운영: 신청 시 쿠폰 차감·체크인 시 스탬프 자동 적립 폐지

DROP TRIGGER IF EXISTS form_responses_consume_le_coupon ON public.form_responses;
DROP TRIGGER IF EXISTS form_responses_refund_le_coupon ON public.form_responses;
DROP TRIGGER IF EXISTS form_responses_bump_le_stamp ON public.form_responses;

COMMENT ON COLUMN public.users.le_stamp_progress IS
  '0-9 언어교환 스탬프. 카운터 QR 체크인 모달에서 수동 갱신. 10(슬라이더)=쿠폰 사용→0 저장';

COMMENT ON COLUMN public.users.le_reward_coupons IS
  'DEPRECATED: 디지털 쿠폰 장수 미사용. 실물 쿠폰 운영.';
