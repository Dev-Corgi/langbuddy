-- 시설 불편 신고: 세션(장소) 단위, 1인 1세션 1회
CREATE TABLE IF NOT EXISTS public.facility_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  posting_id UUID NOT NULL REFERENCES public.postings(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,
  reasons TEXT[] NOT NULL,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT facility_reports_reasons_not_empty CHECK (array_length(reasons, 1) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS facility_reports_unique_per_session
  ON public.facility_reports (reporter_user_id, posting_id, session_date);

CREATE INDEX IF NOT EXISTS facility_reports_posting_session_idx
  ON public.facility_reports (posting_id, session_date);

CREATE INDEX IF NOT EXISTS facility_reports_status_idx
  ON public.facility_reports (status);

ALTER TABLE public.facility_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_reports_insert_own" ON public.facility_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

CREATE POLICY "facility_reports_select_own" ON public.facility_reports
  FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid());

COMMENT ON TABLE public.facility_reports IS
  '모임 장소·시설 불편 신고. posting_id + session_date 기준 세션 단위.';
