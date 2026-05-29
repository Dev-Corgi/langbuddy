-- 쿠폰 복구: 관리자 명시적 삭제에서만 (cron/일괄 삭제 시 복구 안 함)

CREATE OR REPLACE FUNCTION public.trg_refund_le_coupon_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used_coupon boolean;
  should_refund boolean;
BEGIN
  should_refund := COALESCE(current_setting('app.refund_le_coupon', true), '') = 'true';
  IF NOT should_refund THEN
    RETURN OLD;
  END IF;

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

CREATE OR REPLACE FUNCTION public.admin_delete_form_response(
  p_response_id uuid,
  p_refund_coupon boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.is_superadmin = true
    ) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  IF p_refund_coupon THEN
    PERFORM set_config('app.refund_le_coupon', 'true', true);
  END IF;

  DELETE FROM public.seating_assignments
  WHERE participant_id = p_response_id;

  DELETE FROM public.form_responses
  WHERE id = p_response_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_form_response(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_form_response(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_form_response(uuid, boolean) TO service_role;

-- 주간 cron 일괄 삭제 시 쿠폰 복구 방지
CREATE OR REPLACE FUNCTION public.run_scheduled_form_response_resets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  ts_seoul_local timestamp;
  r_local timestamp;
  r_timestamptz timestamptz;
  tgt_dow int;
BEGIN
  ts_seoul_local := (now() AT TIME ZONE 'Asia/Seoul');

  FOR r IN
    SELECT id, form_id, reset_day, reset_time, is_active, last_reset_at
    FROM response_reset_settings
    WHERE is_active IS TRUE
  LOOP
    tgt_dow := CASE r.reset_day
      WHEN 'sunday' THEN 0
      WHEN 'monday' THEN 1
      WHEN 'tuesday' THEN 2
      WHEN 'wednesday' THEN 3
      WHEN 'thursday' THEN 4
      WHEN 'friday' THEN 5
      WHEN 'saturday' THEN 6
      ELSE NULL
    END;

    IF tgt_dow IS NULL THEN
      CONTINUE;
    END IF;

    SELECT MAX(cal.day + r.reset_time)
    INTO r_local
    FROM (
      SELECT (ts_seoul_local::date - i) AS day
      FROM generate_series(0, 6) AS i
    ) cal
    WHERE EXTRACT(DOW FROM cal.day) = tgt_dow
      AND (cal.day + r.reset_time) <= ts_seoul_local;

    IF r_local IS NULL THEN
      CONTINUE;
    END IF;

    r_timestamptz := r_local AT TIME ZONE 'Asia/Seoul';

    IF r.last_reset_at IS NULL THEN
      UPDATE response_reset_settings
      SET last_reset_at = r_timestamptz,
          updated_at = now()
      WHERE id = r.id;
      CONTINUE;
    END IF;

    IF r.last_reset_at >= r_timestamptz THEN
      CONTINUE;
    END IF;

    PERFORM set_config('app.refund_le_coupon', 'false', true);

    DELETE FROM seating_assignments
    WHERE participant_id IN (
      SELECT id FROM form_responses WHERE form_id = r.form_id
    );

    DELETE FROM form_responses WHERE form_id = r.form_id;

    UPDATE response_reset_settings
    SET last_reset_at = now(),
        updated_at = now()
    WHERE id = r.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.admin_delete_form_response(uuid, boolean) IS
  '관리자 신청 취소: seating_assignments + form_responses 삭제. p_refund_coupon=true면 쿠폰 1장 복구.';
