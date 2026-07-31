-- 스터디(Study) 기능 전체 제거.
-- 스코프: study_schedules 테이블, "정기 스터디" 포스팅과 연결된 4개 폼/질문/응답,
-- 그리고 주간 응답 초기화가 언어교환·스터디를 함께 대상으로 삼던 공유 함수를
-- 언어교환 전용으로 재정의.
--
-- 사전 확인 (2026-07-31, Supabase MCP):
--   - study_schedules 4건 전부 is_active=false, 연결 form_responses 0건, le_participation_archive 0건
--   - study 포스팅("정기 스터디") 1건, reports/seating_assignments 참조 0건
-- => 데이터 손실 없이 안전하게 삭제 가능.

-- 1) study_schedules 드롭 전에 연결된 form_id 보관 (forms FK 정리용)
CREATE TEMP TABLE tmp_study_form_ids AS
SELECT form_id FROM public.study_schedules WHERE form_id IS NOT NULL;

-- 2) study_schedules 테이블 제거 (forms.id FK 참조 해제)
DROP TABLE IF EXISTS public.study_schedules;

-- 3) 스터디 폼/질문/응답 정리 (사전 확인 결과 응답 0건)
DELETE FROM public.form_responses
WHERE form_id IN (SELECT form_id FROM tmp_study_form_ids);

DELETE FROM public.form_questions
WHERE form_id IN (SELECT form_id FROM tmp_study_form_ids);

DELETE FROM public.forms
WHERE id IN (SELECT form_id FROM tmp_study_form_ids);

-- 4) 스터디 포스팅 삭제 ("정기 스터디")
DELETE FROM public.postings WHERE category = '스터디';

DROP TABLE tmp_study_form_ids;

-- 5) 주간 응답 초기화가 참조하는 대상 form_id 목록에서 study_schedules 제외 (언어교환 전용)
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
  ) s;
$$;

COMMENT ON FUNCTION public.recurring_schedule_form_ids() IS
  'language_exchange_schedules에 연결된 form_id 목록(중복 제거). (2026-07-31: 스터디 기능 제거로 study_schedules UNION 삭제)';

REVOKE ALL ON FUNCTION public.recurring_schedule_form_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recurring_schedule_form_ids() TO service_role;

COMMENT ON FUNCTION public.run_scheduled_form_response_resets() IS
  'Cron: Asia/Seoul 매주 일요일 0시 이후 1회. 삭제 전 le_participation_archive에 스냅샷 보관 후, 언어교환 스케줄 연결 form_id의 form_responses·seating_assignments 삭제. (2026-07-31: 스터디 기능 제거로 대상에서 study_schedules 제외)';
