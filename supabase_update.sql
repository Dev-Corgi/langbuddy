ALTER TABLE public.postings 
ADD COLUMN IF NOT EXISTS time TEXT,
ADD COLUMN IF NOT EXISTS cost TEXT,
ADD COLUMN IF NOT EXISTS host TEXT,
ADD COLUMN IF NOT EXISTS rich_content TEXT; -- 블로그형 콘텐츠 (HTML 또는 JSON)

-- 기존 date 필드는 '일시'로 사용하고, time 필드를 별도로 추가함.
-- rich_content 필드에는 이미지가 포함된 HTML이 저장될 예정.

-- Form builder: add system_key to form_questions for stable mapping of core fields
ALTER TABLE public.form_questions
ADD COLUMN IF NOT EXISTS system_key TEXT; -- e.g. 'name', 'gender', 'nationality', 'kakao_id', 'drink', 'day', 'language'

-- 스터디 신청 폼(study_schedules.form_id) 전용: 언어교환 폼에 잘못 들어간 항목 제거 후 스터디 쪽에만 동일 질문 추가
-- (study_schedules에 연결된 form_id가 있을 때만 INSERT가 실행됩니다.)

DELETE FROM form_questions
WHERE form_id = '5365279a-852c-4dcc-ac93-1dc3c6b737c0'
AND (
  question_text LIKE '제2외국어 스터디는 일반 언어교환 세션과 별개%'
  OR question_text LIKE '모든 참가자는 스터디, 언어교환 세션에 입장%'
  OR question_text LIKE '제2외국어 스터디(Studying session%'
  OR question_text LIKE '‼️ 꼭 지켜야 할 약속%'
  OR question_text LIKE '지각 관련 안내%'
  OR question_text LIKE '‼️ 필독 %'
);

DELETE FROM form_questions
WHERE system_key = 'drink'
AND form_id IN (SELECT DISTINCT form_id FROM study_schedules WHERE form_id IS NOT NULL);

WITH study_forms AS (
  SELECT DISTINCT form_id FROM study_schedules WHERE form_id IS NOT NULL
),
base(ord, question_type, is_required, question_text, question_text_en, options, options_en) AS (
  VALUES
  (1, 'checkbox', false,
   $t1$제2외국어 스터디는 일반 언어교환 세션과 별개의 프로그램으로 신청을 따로 받고있습니다.

📘 제2외국어 스터디 (17:45~18:45)
원어민 선생님과 소규모로 교재를 활용해 공부하는 시간

💬 언어교환 세션 (19:00~21:00)
외국인 친구들과 자유롭게 영어·한국어로 대화하는 시간

제2외국어 세션을 무료로 참여하기 위해서는 반드시 언어교환 세션을 먼저 신청한 다음 스터디 신청폼을 작성하셔야 합니다.

👉 위 내용을 확인하고 제2외국어 스터디에 신청하시겠습니까?$t1$,
   '',
   '["예"]'::jsonb,
   '["Yes"]'::jsonb),
  (2, 'checkbox', false,
   $t2$모든 참가자는 스터디, 언어교환 세션에 입장하기 전에 반드시 각각 줄을 서서 체크인을 완료해야 합니다. ✅

제2외국어 스터디를 들으신 후 언어교환 세션(19:00~21:00) 에도 참여하실 경우,
반드시 언어교환 세션 전용 체크인 줄에서 다시 체크인을 해주셔야 합니다.

👉 위 내용을 확인하고 제2외국어 스터디에 신청하시겠습니까?$t2$,
   '',
   '["예"]'::jsonb,
   '["Yes"]'::jsonb),
  (3, 'radio', false,
   $t3$제2외국어 스터디(Studying session for Korean students)
L=왕초보기초
H=초중급회화

없는 수업은 신청자가 하루 전날까지 없어서 폐강된 수업입니다!
*$t3$,
   '',
   '["영어", "일본어"]'::jsonb,
   '["English", "Japanese"]'::jsonb),
  (4, 'checkbox', false,
   $t4$‼️ 꼭 지켜야 할 약속
외국인 티칭스태프가 친절하게 시간을 내서 와주었는데, 학생들이 오지 않아 시간을 낭비하는 일이 종종 있었습니다. 신청 후 무단 불참(노쇼)은 원어민 선생님과 운영진 모두에게 큰 부담이 됩니다.
당일 취소도 노쇼로 간주되며,
무단 노쇼가 3회 누적될 경우 2개월간 스터디 참여가 제한돼요.

제한 해제를 원하실 경우, 운영비 20,000원을 납부하시면 다시 참여 가능합니다.

👉 위 내용을 확인하셨나요?$t4$,
   '',
   '["예"]'::jsonb,
   '["Yes"]'::jsonb),
  (5, 'checkbox', false,
   $t5$지각 관련 안내
제2외국어 스터디는 정시(17:45)에 시작돼요.
15분 이상 지각(18시 이후 도착) 시에는 수업 흐름에 지장이 생기고,
선생님과 다른 참가자에게도 피해가 됩니다.

15분 이상 지각이 3회 누적될 경우,
1개월간 스터디 참여가 제한될 수 있습니다.

제한 해제를 원하실 경우, 운영비 10,000원을 납부하시면 다시 참여 가능합니다.

👉 위 내용을 확인하셨나요?$t5$,
   '',
   '["예"]'::jsonb,
   '["Yes"]'::jsonb),
  (6, 'radio', false,
   $t6$‼️ 필독 
언어교환 세션(19:00~21:00)에 함께 참여하시는 분들(참가비:10,000원)은 제2외국어 스터디(17:45~18:45)를 무료로 들을 수 있어요! ✨

스터디'만' 참여하실 경우에는 운영비 10,000원을 송금 부탁드리고 있습니다.

언어교환도 참여하셔서 무료로 스터디를 하시는 분들은 반드시 언어교환 구글폼을 먼저 신청완료하고 돌아와주세요!

👉 신청하신 스터디 당일, 언어교환 세션에도 함께 참여하시나요?$t6$,
   '',
   '["네! 이미 언어교환 신청을 완료해서 스터디는 무료로 참여하겠습니다!", "아니요, 저는 스터디만 참여해서 아래 항목에 송금내역을 적겠습니다."]'::jsonb,
   '["Yes! I already registered for language exchange, so I will attend the study for free!", "No, I will only attend the study and will fill in the payment details below."]'::jsonb)
),
combined AS (
  SELECT
    sf.form_id,
    b.question_type,
    b.is_required,
    b.question_text,
    b.question_text_en,
    b.options,
    b.options_en,
    (SELECT COALESCE(MAX(fq.display_order), -1) FROM form_questions fq WHERE fq.form_id = sf.form_id) + b.ord AS display_order
  FROM study_forms sf
  CROSS JOIN base b
)
INSERT INTO form_questions (form_id, question_text, question_text_en, question_type, is_required, options, options_en, display_order)
SELECT form_id, question_text, question_text_en, question_type, is_required, options, options_en, display_order
FROM combined c
WHERE NOT EXISTS (
  SELECT 1 FROM form_questions x
  WHERE x.form_id = c.form_id
    AND x.question_text LIKE '제2외국어 스터디는 일반 언어교환 세션과 별개%'
);

-- 신청 응답과 로그인 사용자 연결 (당일 언어교환·스터디 번들 판별)
ALTER TABLE public.form_responses
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_responses_user_id ON public.form_responses(user_id);

-- 마이페이지: 언어교환 스탬프 / 무료 쿠폰
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS le_stamp_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS le_reward_coupons integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.le_stamp_progress IS '0-9, 언어교환 체크인 시 +1; 9→다음 체크인 시 쿠폰+1 후 0';
COMMENT ON COLUMN public.users.le_reward_coupons IS '10스탬프로 적립된 언어교환 무료 쿠폰 개수';

-- 자리 배치 히스토리: 회차별로 보존 (같은 posting_id라도 날짜별 스냅샷)
ALTER TABLE public.seating_assignments
  ADD COLUMN IF NOT EXISTS session_date text;

CREATE INDEX IF NOT EXISTS idx_seating_assignments_posting_session
  ON public.seating_assignments (posting_id, session_date);

ALTER TABLE public.seating_assignments
  DROP CONSTRAINT IF EXISTS seating_assignments_posting_id_round_participant_id_key;

ALTER TABLE public.seating_assignments
  DROP CONSTRAINT IF EXISTS seating_assignments_posting_round_participant_session_key;

ALTER TABLE public.seating_assignments
  ADD CONSTRAINT seating_assignments_posting_round_participant_session_key
  UNIQUE (posting_id, round, participant_id, session_date);

-- 온보딩 시 개인정보 처리방침 동의 기록
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_policy_version TEXT;

-- 언어교환 폼 응답이 최초 체크인될 때만 스탬프 적립
CREATE OR REPLACE FUNCTION public.trg_bump_le_stamp_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_p integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.checked_in_at IS NOT NULL
     AND OLD.checked_in_at IS NULL
     AND NEW.user_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.language_exchange_schedules les
       WHERE les.form_id = NEW.form_id AND COALESCE(les.is_active, true)
     )
  THEN
    SELECT u.le_stamp_progress INTO old_p
    FROM public.users u
    WHERE u.id = NEW.user_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.users u
      SET
        le_stamp_progress = (old_p + 1) % 10,
        le_reward_coupons = u.le_reward_coupons + CASE WHEN old_p >= 9 THEN 1 ELSE 0 END,
        updated_at = now()
      WHERE u.id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS form_responses_bump_le_stamp ON public.form_responses;
CREATE TRIGGER form_responses_bump_le_stamp
  AFTER UPDATE OF checked_in_at ON public.form_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bump_le_stamp_on_checkin();
