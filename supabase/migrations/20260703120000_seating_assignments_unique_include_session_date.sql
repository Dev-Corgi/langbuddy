-- seating_assignments: 날짜별 스냅샷을 허용하도록 유니크 키에 session_date 포함
-- 기존: UNIQUE (posting_id, round, participant_id) → 회차당 1행만 가능, 날짜별 히스토리 불가
-- 변경: UNIQUE (posting_id, round, participant_id, session_date)

-- 혹시 모를 (posting, round, participant, session_date) 중복 제거
DELETE FROM public.seating_assignments AS a
USING public.seating_assignments AS b
WHERE a.ctid < b.ctid
  AND a.posting_id = b.posting_id
  AND a.round = b.round
  AND a.participant_id = b.participant_id
  AND COALESCE(a.session_date, '') = COALESCE(b.session_date, '');

-- session_date NULL 레거시: form_responses._event_date 로 보정
UPDATE public.seating_assignments AS sa
SET session_date = LEFT(fr.answers->>'_event_date', 10)
FROM public.form_responses AS fr
WHERE sa.participant_id = fr.id
  AND sa.session_date IS NULL
  AND fr.answers->>'_event_date' IS NOT NULL
  AND LENGTH(fr.answers->>'_event_date') >= 10;

ALTER TABLE public.seating_assignments
  DROP CONSTRAINT IF EXISTS seating_assignments_posting_id_round_participant_id_key;

ALTER TABLE public.seating_assignments
  ADD CONSTRAINT seating_assignments_posting_round_participant_session_key
  UNIQUE (posting_id, round, participant_id, session_date);

COMMENT ON CONSTRAINT seating_assignments_posting_round_participant_session_key
  ON public.seating_assignments IS
  '같은 행사·라운드·참가자도 session_date(YYYY-MM-DD)별로 별도 배치 행 허용';
