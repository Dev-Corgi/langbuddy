-- Seating session snapshot: epoch (reset boundary) + revision (optimistic lock).
-- Does NOT modify or delete form_responses.

ALTER TABLE public.postings
  ADD COLUMN IF NOT EXISTS seating_session_epoch bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seating_session_revision bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.postings.seating_session_epoch IS
  '자리배치 세션 세대. 주간 reset·수동 응답 초기화 시 증가. arrange 클라이언트 stale 탭 감지용.';
COMMENT ON COLUMN public.postings.seating_session_revision IS
  '자리배치 세션 revision. seating-session patch 성공마다 +1 (optimistic lock).';

-- Weekly reset: bump epoch on active language-exchange postings before form_responses delete.
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

  UPDATE public.postings
  SET seating_session_epoch = seating_session_epoch + 1,
      seating_session_revision = seating_session_revision + 1,
      updated_at = now()
  WHERE category = '언어교환'
    AND day_of_week IS NULL
    AND status = 'active';

  INSERT INTO public.le_participation_archive (
    response_id, user_id, form_id, posting_id, session_date, round, table_label,
    day_label, self_snapshot, mates, checked_in_at, applied_at
  )
  SELECT
    fr.id,
    fr.user_id,
    fr.form_id,
    sa.posting_id,
    sa.session_date,
    sa.round,
    sa.table_label,
    COALESCE(NULLIF(fr.answers->>'_selected_day', ''), ''),
    jsonb_build_object(
      'name', COALESCE(NULLIF(fr.answers->>'name', ''), NULLIF(fr.answers->>'이름', ''), NULLIF(fr.answers->>'_participant_name', ''), ''),
      'gender', COALESCE(NULLIF(fr.answers->>'gender', ''), NULLIF(fr.answers->>'성별', ''), ''),
      'nationality', COALESCE(NULLIF(fr.answers->>'nationality', ''), NULLIF(fr.answers->>'국적', ''), ''),
      'language', COALESCE(NULLIF(fr.answers->>'_selected_language', ''), NULLIF(fr.answers->>'language', ''), NULLIF(fr.answers->>'언어', ''), '')
    ),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'userId', mate_fr.user_id,
        'name', COALESCE(NULLIF(mate_fr.answers->>'name', ''), NULLIF(mate_fr.answers->>'이름', ''), NULLIF(mate_fr.answers->>'_participant_name', ''), '?'),
        'gender', COALESCE(NULLIF(mate_fr.answers->>'gender', ''), NULLIF(mate_fr.answers->>'성별', ''), ''),
        'nationality', COALESCE(NULLIF(mate_fr.answers->>'nationality', ''), NULLIF(mate_fr.answers->>'국적', ''), ''),
        'language', COALESCE(NULLIF(mate_fr.answers->>'_selected_language', ''), NULLIF(mate_fr.answers->>'language', ''), NULLIF(mate_fr.answers->>'언어', ''), '')
      ))
      FROM public.seating_assignments mate_sa
      JOIN public.form_responses mate_fr ON mate_fr.id = mate_sa.participant_id
      WHERE mate_sa.posting_id = sa.posting_id
        AND mate_sa.round = sa.round
        AND mate_sa.table_label = sa.table_label
        AND COALESCE(mate_sa.session_date, '') = COALESCE(sa.session_date, '')
        AND mate_sa.participant_id <> sa.participant_id
    ), '[]'::jsonb),
    fr.checked_in_at,
    fr.created_at
  FROM public.form_responses fr
  JOIN public.seating_assignments sa ON sa.participant_id = fr.id
  WHERE fr.form_id = ANY (target_form_ids)
    AND fr.user_id IS NOT NULL
  ON CONFLICT (response_id, round) DO NOTHING;

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
  'Cron: Asia/Seoul 매주 일요일 0시 이후 1회. epoch bump → archive → form_responses·seating_assignments 삭제.';

REVOKE ALL ON FUNCTION public.run_scheduled_form_response_resets() FROM PUBLIC;
