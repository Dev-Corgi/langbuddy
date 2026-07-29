-- 자리배치 저장 구조 개선: "세션 전체(1~3라운드) 통째로 지우고 다시 쓰기" 방식이
-- 드래그 한 번마다 반복 호출되면서, 관리자가 연속으로 여러 명을 옮기거나(단일 관리자도 해당)
-- 여러 관리자가 동시에 다른 참가자를 옮길 때 서로의 변경을 덮어쓸 수 있는 구조적 위험이 있었음.
--
-- 1) admin_assign_participant_table: 드래그로 참가자 1명을 옮길 때 그 참가자의 그 라운드
--    행 1건만 upsert/delete. 다른 참가자·다른 라운드 데이터에 절대 영향 없음.
-- 2) admin_replace_round_seating: 테이블 추가/삭제/순서변경/자동배치처럼 "라운드 단위"로
--    바뀌는 구조적 변경은 세션 전체가 아니라 해당 라운드 하나만 replace.

CREATE OR REPLACE FUNCTION public.admin_assign_participant_table(
  p_posting_id uuid,
  p_session_date text,
  p_round integer,
  p_participant_id uuid,
  p_table_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_session_date IS NULL OR length(trim(p_session_date)) < 10 THEN
    RAISE EXCEPTION 'invalid_session_date';
  END IF;
  IF p_round IS NULL THEN
    RAISE EXCEPTION 'invalid_round';
  END IF;
  IF p_participant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_participant_id';
  END IF;

  IF p_table_label IS NULL OR length(trim(p_table_label)) = 0 THEN
    DELETE FROM public.seating_assignments
    WHERE posting_id = p_posting_id
      AND round = p_round
      AND participant_id = p_participant_id
      AND (session_date = p_session_date OR session_date IS NULL);
  ELSE
    DELETE FROM public.seating_assignments
    WHERE posting_id = p_posting_id
      AND round = p_round
      AND participant_id = p_participant_id
      AND session_date IS NULL;

    INSERT INTO public.seating_assignments (posting_id, session_date, round, table_label, participant_id)
    VALUES (p_posting_id, p_session_date, p_round, trim(p_table_label), p_participant_id)
    ON CONFLICT (posting_id, round, participant_id, session_date)
    DO UPDATE SET table_label = EXCLUDED.table_label;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_replace_round_seating(
  p_posting_id uuid,
  p_session_date text,
  p_round integer,
  p_table_languages jsonb,
  p_table_order jsonb DEFAULT NULL,
  p_lang_table_counts jsonb DEFAULT NULL,
  p_assignments jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
BEGIN
  IF p_session_date IS NULL OR length(trim(p_session_date)) < 10 THEN
    RAISE EXCEPTION 'invalid_session_date';
  END IF;
  IF p_round IS NULL THEN
    RAISE EXCEPTION 'invalid_round';
  END IF;

  SELECT COALESCE(seating_config, '{}'::jsonb) INTO v_config
  FROM public.postings
  WHERE id = p_posting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'posting_not_found';
  END IF;

  v_config := jsonb_set(
    v_config,
    '{tableLanguagesByRound}',
    COALESCE(v_config->'tableLanguagesByRound', '{}'::jsonb)
      || jsonb_build_object(p_round::text, COALESCE(p_table_languages, '{}'::jsonb))
  );

  IF p_table_order IS NOT NULL THEN
    v_config := jsonb_set(
      v_config,
      '{tableOrderByRound}',
      COALESCE(v_config->'tableOrderByRound', '{}'::jsonb)
        || jsonb_build_object(p_round::text, p_table_order)
    );
  END IF;

  IF p_lang_table_counts IS NOT NULL THEN
    v_config := jsonb_set(v_config, '{langTableCounts}', p_lang_table_counts);
  END IF;

  UPDATE public.postings SET seating_config = v_config WHERE id = p_posting_id;

  DELETE FROM public.seating_assignments
  WHERE posting_id = p_posting_id
    AND round = p_round
    AND (session_date = p_session_date OR session_date IS NULL);

  IF p_assignments IS NOT NULL AND jsonb_array_length(p_assignments) > 0 THEN
    INSERT INTO public.seating_assignments (posting_id, session_date, round, table_label, participant_id)
    SELECT
      p_posting_id,
      p_session_date,
      p_round,
      trim(item->>'table_label'),
      (item->>'participant_id')::uuid
    FROM jsonb_array_elements(p_assignments) AS item
    WHERE item->>'participant_id' IS NOT NULL
      AND trim(COALESCE(item->>'table_label', '')) <> '';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.admin_persist_seating_live(uuid, text, jsonb, jsonb) IS
  'DEPRECATED (2026-07-29): 세션 전체(1~3라운드)를 매번 통째로 replace하는 구버전. admin_assign_participant_table(단건) / admin_replace_round_seating(라운드 단위)로 대체됨. 롤백 대비로만 보존.';
