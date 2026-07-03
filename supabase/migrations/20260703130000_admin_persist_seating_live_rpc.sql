-- 자리배치 저장: postings.seating_config + 오늘 seating_assignments 를 단일 트랜잭션으로 갱신
-- (실패 시 DELETE만 커밋되어 DB가 비는 문제 방지)

CREATE OR REPLACE FUNCTION public.admin_persist_seating_live(
  p_posting_id uuid,
  p_session_date text,
  p_seating_config jsonb,
  p_assignments jsonb DEFAULT '[]'::jsonb
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

  UPDATE public.postings
  SET seating_config = p_seating_config
  WHERE id = p_posting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'posting_not_found';
  END IF;

  DELETE FROM public.seating_assignments
  WHERE posting_id = p_posting_id
    AND (session_date = p_session_date OR session_date IS NULL);

  IF p_assignments IS NOT NULL AND jsonb_array_length(p_assignments) > 0 THEN
    INSERT INTO public.seating_assignments (
      posting_id,
      session_date,
      round,
      table_label,
      participant_id
    )
    SELECT
      p_posting_id,
      p_session_date,
      (item->>'round')::integer,
      trim(item->>'table_label'),
      (item->>'participant_id')::uuid
    FROM jsonb_array_elements(p_assignments) AS item
    WHERE item->>'participant_id' IS NOT NULL
      AND trim(COALESCE(item->>'table_label', '')) <> '';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_persist_seating_live(uuid, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_persist_seating_live(uuid, text, jsonb, jsonb) TO service_role;

COMMENT ON FUNCTION public.admin_persist_seating_live(uuid, text, jsonb, jsonb) IS
  '관리자 자리배치: seating_config + 당일(session_date) assignments 원자적 저장';
