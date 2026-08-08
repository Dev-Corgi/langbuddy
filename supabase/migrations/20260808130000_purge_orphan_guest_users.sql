-- 아카이브 purge(2개월) 이후, 더 이상 참조되지 않는 guest users 정리.
-- - form_responses / archive(user_id·mates.userId) 미참조
-- - pending 신고 없음
-- - 신고 없음 → 즉시 후보 / 신고 있음 → 전부 reviewed·dismissed + session 2개월 경과

CREATE OR REPLACE FUNCTION public.purge_orphan_guest_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  guest_row RECORD;
  deleted_count integer := 0;
  last_session date;
  cutoff date := (current_date - interval '2 months')::date;
BEGIN
  FOR guest_row IN
    SELECT u.id
    FROM public.users u
    WHERE u.is_guest = true
  LOOP
    -- live 신청/현장 응답 연결
    IF EXISTS (
      SELECT 1 FROM public.form_responses fr
      WHERE fr.user_id = guest_row.id
    ) THEN
      CONTINUE;
    END IF;

    -- 아카이브 본인 참여 또는 동석자 mates.userId
    IF EXISTS (
      SELECT 1 FROM public.le_participation_archive a
      WHERE a.user_id = guest_row.id
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.le_participation_archive a
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a.mates, '[]'::jsonb)) AS m(elem)
      WHERE NULLIF(elem->>'userId', '') = guest_row.id::text
    ) THEN
      CONTINUE;
    END IF;

    -- 미처리 신고
    IF EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.reported_user_id = guest_row.id
        AND r.status = 'pending'
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.reported_user_id = guest_row.id
    ) THEN
      -- 처리 완료(reviewed/dismissed)만 허용
      IF EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.reported_user_id = guest_row.id
          AND r.status NOT IN ('reviewed', 'dismissed')
      ) THEN
        CONTINUE;
      END IF;

      SELECT MAX(
        CASE
          WHEN r.session_date ~ '^\d{4}-\d{2}-\d{2}' THEN r.session_date::date
          ELSE r.created_at::date
        END
      )
      INTO last_session
      FROM public.reports r
      WHERE r.reported_user_id = guest_row.id;

      IF last_session IS NULL OR last_session > cutoff THEN
        CONTINUE;
      END IF;
    END IF;

    DELETE FROM auth.users WHERE id = guest_row.id;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.purge_orphan_guest_users() IS
  'Cron: 아카이브 purge 직후. is_guest=true 이면서 form/archive/reports 조건을 만족하는 placeholder auth·users 삭제. reports.reported_user_id는 SET NULL, reported_name 스냅샷 유지.';

REVOKE ALL ON FUNCTION public.purge_orphan_guest_users() FROM PUBLIC;

-- 매일 아카이브 purge 후 guest 정리 (기존 cron job 갱신)
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
  $$SELECT public.purge_old_le_participation_archive(); SELECT public.purge_orphan_guest_users();$$
);
