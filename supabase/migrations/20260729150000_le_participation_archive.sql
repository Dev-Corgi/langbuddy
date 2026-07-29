-- 마이페이지 "언어교환 참여 기록"이 실제로는 seating_assignments 기반인데,
-- 매주 일요일 0시(Asia/Seoul) run_scheduled_form_response_resets()가 언어교환·스터디
-- form_responses/seating_assignments를 통째로 삭제해버려서, 지난 주 이전 참여 기록이
-- 마이페이지에서 통째로 사라지는 문제를 해결.
--
-- 해결책: 삭제 직전에 "내가 참여한 라운드" 스냅샷을 le_participation_archive에 보관.
-- 마이페이지는 이제 seating_assignments(최근) + le_participation_archive(과거, 최대 2개월)를
-- 함께 조회해서 진짜 "참여 기록"을 보여준다.

CREATE TABLE IF NOT EXISTS public.le_participation_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id uuid NOT NULL,
  posting_id uuid,
  session_date text,
  round integer NOT NULL,
  table_label text NOT NULL,
  day_label text NOT NULL DEFAULT '',
  self_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  mates jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_in_at timestamptz,
  applied_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_le_participation_archive_unique
  ON public.le_participation_archive (response_id, round);

CREATE INDEX IF NOT EXISTS idx_le_participation_archive_user
  ON public.le_participation_archive (user_id, session_date DESC);

ALTER TABLE public.le_participation_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS le_participation_archive_select_own ON public.le_participation_archive;
CREATE POLICY le_participation_archive_select_own
  ON public.le_participation_archive
  FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE public.le_participation_archive IS
  '주간 응답 초기화(run_scheduled_form_response_resets)로 form_responses/seating_assignments가 삭제되기 전 스냅샷. 마이페이지 참여 기록(최대 2개월) 표시용.';

-- 삭제 직전 아카이빙을 포함하도록 재정의
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

  -- 로그인 사용자 + 실제 자리배치가 있었던 참여 건만 스냅샷으로 보관.
  -- (미배정/미체크인 신청만 있는 경우는 마이페이지 참여 기록에 애초에 안 뜨므로 보관 불필요)
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
  'Cron: Asia/Seoul 매주 일요일 0시 이후 1회. 삭제 전 le_participation_archive에 스냅샷 보관 후, 언어교환·스터디 스케줄 연결 form_id의 form_responses·seating_assignments 삭제.';

REVOKE ALL ON FUNCTION public.run_scheduled_form_response_resets() FROM PUBLIC;

-- 아카이브도 2개월 지나면 정리 (마이페이지 "최근 2개월" 문구와 실제 보관 기간을 일치시킴)
CREATE OR REPLACE FUNCTION public.purge_old_le_participation_archive()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.le_participation_archive
  WHERE archived_at < now() - interval '2 months';
$$;

COMMENT ON FUNCTION public.purge_old_le_participation_archive() IS
  'Cron: 매일 1회, 2개월 지난 le_participation_archive 행 삭제.';

REVOKE ALL ON FUNCTION public.purge_old_le_participation_archive() FROM PUBLIC;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid
  FROM cron.job
  WHERE jobname = 'le_participation_archive_purge_daily'
  LIMIT 1;

  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'le_participation_archive_purge_daily',
  '30 3 * * *',
  $$SELECT public.purge_old_le_participation_archive();$$
);
