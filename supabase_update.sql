-- Update Postings table with new fields
ALTER TABLE public.postings 
ADD COLUMN IF NOT EXISTS time TEXT,
ADD COLUMN IF NOT EXISTS cost TEXT,
ADD COLUMN IF NOT EXISTS host TEXT,
ADD COLUMN IF NOT EXISTS rich_content TEXT; -- 블로그형 콘텐츠 (HTML 또는 JSON)

-- 기존 date 필드는 '일시'로 사용하고, time 필드를 별도로 추가함.
-- rich_content 필드에는 이미지가 포함된 HTML이 저장될 예정.
