-- 신고 시스템: reports 테이블 생성
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  reported_response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  posting_id UUID NOT NULL REFERENCES postings(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,
  round INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('폭언/욕설', '성희롱/부적절한 언행', '노쇼/자리이탈', '허위 정보', '기타')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT reports_unique_per_round UNIQUE (reporter_response_id, reported_response_id, round)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS reports_posting_session_idx ON reports (posting_id, session_date);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status);
CREATE INDEX IF NOT EXISTS reports_reporter_user_idx ON reports (reporter_user_id);

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 로그인한 사용자는 자신이 신고자인 행만 INSERT 가능
CREATE POLICY "reports_insert_own" ON reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

-- 사용자는 자신이 접수한 신고만 조회 가능
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid());

-- 관리자 operations은 service role을 통해 API 라우트에서 처리 (RLS bypass)
