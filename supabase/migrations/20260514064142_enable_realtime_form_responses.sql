-- Broadcast form_responses changes to Supabase Realtime (postgres_changes).
ALTER PUBLICATION supabase_realtime ADD TABLE public.form_responses;
