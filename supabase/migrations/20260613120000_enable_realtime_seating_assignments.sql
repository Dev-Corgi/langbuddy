-- Broadcast seating_assignments changes to Supabase Realtime (multi-browser arrange sync).
ALTER PUBLICATION supabase_realtime ADD TABLE public.seating_assignments;
