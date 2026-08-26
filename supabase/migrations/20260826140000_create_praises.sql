-- 멤버 칭찬: reports와 동일하게 user_id 기반 안정적 식별
CREATE TABLE IF NOT EXISTS public.praises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  praiser_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  praised_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  praised_name TEXT NOT NULL DEFAULT '',
  posting_id UUID NOT NULL REFERENCES public.postings(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,
  round INTEGER NOT NULL,
  reasons TEXT[] NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT praises_reasons_not_empty CHECK (array_length(reasons, 1) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS praises_unique_per_round_by_user
  ON public.praises (praiser_user_id, praised_user_id, round, posting_id, session_date)
  WHERE praised_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS praises_posting_session_idx
  ON public.praises (posting_id, session_date);

CREATE INDEX IF NOT EXISTS praises_praiser_user_idx
  ON public.praises (praiser_user_id);

ALTER TABLE public.praises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "praises_insert_own" ON public.praises
  FOR INSERT TO authenticated
  WITH CHECK (praiser_user_id = auth.uid());

CREATE POLICY "praises_select_own" ON public.praises
  FOR SELECT TO authenticated
  USING (praiser_user_id = auth.uid());

COMMENT ON TABLE public.praises IS
  '세션 동석자 칭찬. praiser/praised user_id 기준으로 form_responses 주간 초기화 후에도 유지.';
