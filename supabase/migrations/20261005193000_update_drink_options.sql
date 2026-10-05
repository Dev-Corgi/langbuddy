-- 언어교환 신청폼 음료 선택지를 5종으로 통일
UPDATE public.form_questions
SET
  options = '["아이스티","초코라떼(아이스만)","아아","홍차","캐모마일"]'::jsonb,
  options_en = '["Iced tea","Chocolate latte (iced only)","Iced Americano","Black tea","Chamomile"]'::jsonb
WHERE system_key = 'drink';
