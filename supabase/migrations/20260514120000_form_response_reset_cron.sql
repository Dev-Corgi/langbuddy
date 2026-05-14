-- 주간 응답 초기화: response_reset_settings(요일·시각·활성)에 맞춰 form_responses 및 관련 seating_assignments 삭제.
-- users.le_stamp_progress / le_reward_coupons 등 참여 이력은 변경하지 않음(관리용 슬레이트만 비움).
-- pg_cron으로 매분 실행; 서울 시각 기준으로 "이번 주기의 리셋 시각"이 지났고 아직 last_reset_at이 그 이전이면 1회 삭제.

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

    -- last_reset_at 이 없으면 이번 주기 기준만 기록(과거 응답 일괄 삭제 방지). 비우려면 관리자 「지금 초기화」 사용.
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

COMMENT ON FUNCTION public.run_scheduled_form_response_resets() IS
  'Cron: Asia/Seoul 기준 reset_day+reset_time마다 해당 form_id의 form_responses·seating_assignments만 삭제; users 스탬프/쿠폰 미변경.';

REVOKE ALL ON FUNCTION public.run_scheduled_form_response_resets() FROM PUBLIC;

-- 기존 동일 이름 잡이 있으면 제거 후 재등록
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid
  FROM cron.job
  WHERE jobname = 'form_response_weekly_reset'
  LIMIT 1;

  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'form_response_weekly_reset',
  '* * * * *',
  $$SELECT public.run_scheduled_form_response_resets();$$
);
