-- 반복 언어교환/스터디: 동일 user + form + 회차(_event_date) 중복 삽입 방지
-- 운영자가 응답 삭제 시 행이 제거되어 재신청 가능

CREATE UNIQUE INDEX IF NOT EXISTS form_responses_user_id_form_id_event_date_key
ON public.form_responses (user_id, form_id, ((answers->>'_event_date')))
WHERE user_id IS NOT NULL
  AND length(trim(coalesce(answers->>'_event_date', ''))) >= 10;

COMMENT ON INDEX public.form_responses_user_id_form_id_event_date_key IS
  'Uniq (user_id, form_id, answers._event_date) for recurring session signup; partial when _event_date is YYYY-MM-DD.';
