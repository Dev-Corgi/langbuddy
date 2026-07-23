-- 체크인 시 스탬프 자동 +1 복구 (수동 조정은 StampProgressEditor 유지)
-- le_reward_coupons 자동 증가는 실물 쿠폰 운영으로 제외

CREATE OR REPLACE FUNCTION public.trg_bump_le_stamp_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_p integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.checked_in_at IS NOT NULL
     AND OLD.checked_in_at IS NULL
     AND NEW.user_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.language_exchange_schedules les
       WHERE les.form_id = NEW.form_id AND COALESCE(les.is_active, true)
     )
  THEN
    SELECT u.le_stamp_progress INTO old_p
    FROM public.users u
    WHERE u.id = NEW.user_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.users u
      SET
        le_stamp_progress = (old_p + 1) % 10,
        updated_at = now()
      WHERE u.id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS form_responses_bump_le_stamp ON public.form_responses;
CREATE TRIGGER form_responses_bump_le_stamp
  AFTER UPDATE OF checked_in_at ON public.form_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bump_le_stamp_on_checkin();

COMMENT ON COLUMN public.users.le_stamp_progress IS
  '0-9 언어교환 스탬프. 체크인 시 +1; 관리자가 체크인 모달에서 수동 조정 가능. 10(슬라이더)=실물 쿠폰 사용→0 저장';
