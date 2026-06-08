-- language_exchange_schedules: 요일별 독립 form_id (공유 form 분리)
-- 실제 데이터 마이그레이션은 scripts/split-shared-language-forms.mjs 로 실행.
-- 각 schedule.form_id 는 해당 요일 전용 forms 행 1개를 가리켜야 한다.

COMMENT ON COLUMN public.language_exchange_schedules.form_id IS
  '해당 요일 전용 신청 폼 ID (다른 요일과 공유하지 않음)';
