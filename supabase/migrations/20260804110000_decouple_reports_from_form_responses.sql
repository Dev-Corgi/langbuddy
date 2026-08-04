-- 신고 기능이 매주 일요일 초기화(run_scheduled_form_response_resets)로 인해
-- 원본 form_responses가 삭제되면 통째로 막혀버리는 문제를 해결.
--
-- 이전: reports.reporter_response_id / reported_response_id 가 form_responses(id)를
--       NOT NULL + ON DELETE CASCADE 로 참조 → 세션이 주간 리셋을 한 번이라도
--       거치면 (a) 이미 접수된 신고까지 통째로 cascade 삭제되고, (b) 그 이후로는
--       신고 자체를 접수할 방법이 없었음 (참조할 살아있는 응답이 없어서).
--
-- 변경: 신고 대상/신고자 식별을 "그 순간의 form_responses.id" 대신 안정적인
--       users(id) 기준(reported_user_id/reporter_user_id)으로 전환하고, 표시용
--       이름은 신고 시점 스냅샷(reported_name)으로 저장. response_id 컬럼은
--       참고용으로 남기되 NULLABLE + ON DELETE SET NULL로 변경해 원본이 삭제돼도
--       신고 기록 자체는 살아남도록 한다.

-- 1) 신규 컬럼 추가
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reported_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reported_name text NOT NULL DEFAULT '';

-- 2) 기존 행 백필 (아직 form_responses가 살아있는 현재 행들 — CASCADE 구조상
--    원본이 지워진 신고는 이미 함께 삭제되었으므로 남아있는 행은 모두 백필 가능)
UPDATE public.reports r
SET
  reported_user_id = fr.user_id,
  reported_name = COALESCE(
    NULLIF(fr.answers->>'name', ''),
    NULLIF(fr.answers->>'_participant_name', ''),
    NULLIF(fr.answers->>'이름', ''),
    ''
  )
FROM public.form_responses fr
WHERE fr.id = r.reported_response_id
  AND r.reported_user_id IS NULL;

-- 3) response_id FK를 CASCADE → SET NULL, NOT NULL 해제
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reporter_response_id_fkey,
  DROP CONSTRAINT IF EXISTS reports_reported_response_id_fkey;

ALTER TABLE public.reports
  ALTER COLUMN reporter_response_id DROP NOT NULL,
  ALTER COLUMN reported_response_id DROP NOT NULL;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_reporter_response_id_fkey
    FOREIGN KEY (reporter_response_id) REFERENCES public.form_responses(id) ON DELETE SET NULL,
  ADD CONSTRAINT reports_reported_response_id_fkey
    FOREIGN KEY (reported_response_id) REFERENCES public.form_responses(id) ON DELETE SET NULL;

-- 4) 중복신고 방지 기준을 response_id → user_id 기반으로 전환
--    (response_id가 이제 NULL이 될 수 있어 기존 유니크 제약이 더 이상 유효하지 않음)
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_unique_per_round;

CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_per_round_by_user
  ON public.reports (reporter_user_id, reported_user_id, round, posting_id, session_date)
  WHERE reported_user_id IS NOT NULL;

COMMENT ON COLUMN public.reports.reported_user_id IS
  '신고 대상 유저 (안정적 식별자). form_responses가 주간 초기화로 삭제돼도 유지됨.';
COMMENT ON COLUMN public.reports.reported_name IS
  '신고 시점의 신고 대상 표시 이름 스냅샷. 이후 정보가 바뀌거나 삭제돼도 유지됨.';
COMMENT ON COLUMN public.reports.reporter_response_id IS
  '(참고용, nullable) 신고 시점 신고자의 form_responses.id. 원본 삭제 시 NULL로 전환됨.';
COMMENT ON COLUMN public.reports.reported_response_id IS
  '(참고용, nullable) 신고 시점 신고 대상의 form_responses.id. 원본 삭제 시 NULL로 전환됨.';

-- 5) le_participation_archive에 남기는 동석자(mates) 스냅샷에 user_id도 함께 저장
--    (신고 대상을 식별하려면 응답이 사라진 뒤에도 안정적인 user_id가 필요)
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
  'Cron: Asia/Seoul 매주 일요일 0시 이후 1회. 삭제 전 le_participation_archive에 스냅샷(동석자 user_id 포함) 보관 후, 언어교환·스터디 스케줄 연결 form_id의 form_responses·seating_assignments 삭제.';
