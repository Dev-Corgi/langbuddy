-- LangBuddy: 언어교환 스탬프/쿠폰 컬럼, 체크인 적립, 신청 시 원자적 차감, 취소 시 복구

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS le_stamp_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS le_reward_coupons integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.le_stamp_progress IS '0-9, 언어교환 체크인 시 +1; 9→다음 체크인 시 쿠폰+1 후 0';
COMMENT ON COLUMN public.users.le_reward_coupons IS '10스탬프로 적립된 언어교환 무료 쿠폰 개수';

-- 언어교환 폼 응답이 최초 체크인될 때만 스탬프 적립
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
        le_reward_coupons = u.le_reward_coupons + CASE WHEN old_p >= 9 THEN 1 ELSE 0 END,
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

-- 언어교환 신청 시 쿠폰 원자적 차감 (insert 실패 시 롤백)
CREATE OR REPLACE FUNCTION public.trg_consume_le_coupon_on_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wants_coupon boolean;
  cur integer;
BEGIN
  wants_coupon := COALESCE((NEW.answers->>'_le_free_coupon')::boolean, false)
    OR COALESCE(NEW.answers->>'_payment_method', '') IN ('무료쿠폰', '무료쿠폰(10스탬프)');

  IF NOT wants_coupon OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.language_exchange_schedules les
    WHERE les.form_id = NEW.form_id AND COALESCE(les.is_active, true)
  ) THEN
    RAISE EXCEPTION 'coupon_not_applicable'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT u.le_reward_coupons INTO cur
  FROM public.users u
  WHERE u.id = NEW.user_id
  FOR UPDATE;

  IF NOT FOUND OR cur <= 0 THEN
    RAISE EXCEPTION 'no_coupon_available'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.users
  SET le_reward_coupons = cur - 1, updated_at = now()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS form_responses_consume_le_coupon ON public.form_responses;
CREATE TRIGGER form_responses_consume_le_coupon
  BEFORE INSERT ON public.form_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_consume_le_coupon_on_apply();

-- 신청 취소(삭제) 시 사용 쿠폰 복구
CREATE OR REPLACE FUNCTION public.trg_refund_le_coupon_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used_coupon boolean;
BEGIN
  used_coupon := COALESCE((OLD.answers->>'_le_free_coupon')::boolean, false)
    OR COALESCE(OLD.answers->>'_payment_method', '') IN ('무료쿠폰', '무료쿠폰(10스탬프)');

  IF used_coupon AND OLD.user_id IS NOT NULL THEN
    UPDATE public.users
    SET le_reward_coupons = le_reward_coupons + 1, updated_at = now()
    WHERE id = OLD.user_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS form_responses_refund_le_coupon ON public.form_responses;
CREATE TRIGGER form_responses_refund_le_coupon
  BEFORE DELETE ON public.form_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refund_le_coupon_on_cancel();
