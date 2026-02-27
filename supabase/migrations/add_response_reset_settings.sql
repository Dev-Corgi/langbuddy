-- Create table for response reset settings
CREATE TABLE IF NOT EXISTS response_reset_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  reset_day TEXT NOT NULL CHECK (reset_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  reset_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(form_id)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_response_reset_settings_form_id ON response_reset_settings(form_id);
CREATE INDEX IF NOT EXISTS idx_response_reset_settings_active ON response_reset_settings(is_active);

-- Add RLS policies
ALTER TABLE response_reset_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON response_reset_settings
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON response_reset_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON response_reset_settings
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON response_reset_settings
  FOR DELETE USING (true);
