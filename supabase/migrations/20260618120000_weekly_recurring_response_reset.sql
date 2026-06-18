-- 언어교환·스터디 연결 폼: 매주 일요일 0시(Asia/Seoul) 응답·자리배치 자동 초기화
-- response_reset_settings 없이 전역 1회 실행 (폼/질문/스케줄은 유지)

CREATE TABLE IF NOT EXISTS public.weekly_response_reset_state (
  id text PRIMARY KEY DEFAULT 'global',
  last_reset_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.weekly_response_reset_state (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.weekly_response_reset_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_response_reset_state_select ON public.weekly_response_reset_state;
CREATE POLICY weekly_response_reset_state_select
  ON public.weekly_response_reset_state
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.recurring_schedule_form_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT fid),
    ARRAY[]::uuid[]
  )
  FROM (
    SELECT form_id AS fid
    FROM public.language_exchange_schedules
    WHERE form_id IS NOT NULL
    UNION
    SELECT form_id AS fid
    FROM public.study_schedules
    WHERE form_id IS NOT NULL
  ) s;
$$;

COMMENT ON FUNCTION public.recurring_schedule_form_ids() IS
  'language_exchange_schedules·study_schedules에 연결된 form_id 목록(중복 제거).';

REVOKE ALL ON FUNCTION public.recurring_schedule_form_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recurring_schedule_form_ids() TO service_role;

CREATE OR REPLACE FUNCTION public.run_scheduled_form_response_resets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts_seoul_local timestamp;
  sunday_local timestamp;
  sunday_timestamptz timestamptz;
  last_reset timestamptz;
  target_form_ids uuid[];
BEGIN
  ts_seoul_local := (now() AT TIME ZONE 'Asia/Seoul');

  SELECT MAX(cal.day::timestamp)
  INTO sunday_local
  FROM (
    SELECT (ts_seoul_local::date - i) AS day
    FROM generate_series(0, 6) AS i
  ) cal
  WHERE EXTRACT(DOW FROM cal.day) = 0
    AND cal.day <= ts_seoul_local::date;

  IF sunday_local IS NULL THEN
    RETURN;
  END IF;

  sunday_timestamptz := sunday_local AT TIME ZONE 'Asia/Seoul';

  SELECT w.last_reset_at
  INTO last_reset
  FROM public.weekly_response_reset_state w
  WHERE w.id = 'global';

  -- 최초 1회: 과거 응답 일괄 삭제 방지 — 기준 시각만 기록
  IF last_reset IS NULL THEN
    UPDATE public.weekly_response_reset_state
    SET last_reset_at = sunday_timestamptz,
        updated_at = now()
    WHERE id = 'global';
    RETURN;
  END IF;

  IF last_reset >= sunday_timestamptz THEN
    RETURN;
  END IF;

  target_form_ids := public.recurring_schedule_form_ids();

  IF array_length(target_form_ids, 1) IS NULL OR array_length(target_form_ids, 1) = 0 THEN
    UPDATE public.weekly_response_reset_state
    SET last_reset_at = now(),
        updated_at = now()
    WHERE id = 'global';
    RETURN;
  END IF;

  PERFORM set_config('app.refund_le_coupon', 'false', true);

  DELETE FROM public.seating_assignments
  WHERE participant_id IN (
    SELECT fr.id
    FROM public.form_responses fr
    WHERE fr.form_id = ANY (target_form_ids)
  );

  DELETE FROM public.form_responses
  WHERE form_id = ANY (target_form_ids);

  UPDATE public.weekly_response_reset_state
  SET last_reset_at = now(),
      updated_at = now()
  WHERE id = 'global';
END;
$$;

COMMENT ON FUNCTION public.run_scheduled_form_response_resets() IS
  'Cron: Asia/Seoul 매주 일요일 0시 이후 1회, 언어교환·스터디 스케줄 연결 form_id의 form_responses·seating_assignments만 삭제.';

REVOKE ALL ON FUNCTION public.run_scheduled_form_response_resets() FROM PUBLIC;
