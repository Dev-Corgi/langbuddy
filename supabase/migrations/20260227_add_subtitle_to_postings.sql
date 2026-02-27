-- Add subtitle columns to postings table
ALTER TABLE postings ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE postings ADD COLUMN IF NOT EXISTS subtitle_en TEXT;
