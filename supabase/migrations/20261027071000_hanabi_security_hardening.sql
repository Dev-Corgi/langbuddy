-- Explicit function privileges: PostgreSQL grants EXECUTE to PUBLIC by default.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.is_staff_or_admin(uuid) from public, anon;
revoke all on function public.admin_assign_participant_table(uuid,text,integer,uuid,text) from public, anon;
revoke all on function public.admin_replace_round_seating(uuid,text,integer,jsonb,jsonb,jsonb,jsonb) from public, anon;
revoke all on function public.admin_delete_form_response(uuid,boolean) from public, anon;

grant execute on function public.is_staff_or_admin(uuid) to authenticated, service_role;
grant execute on function public.admin_assign_participant_table(uuid,text,integer,uuid,text) to authenticated, service_role;
grant execute on function public.admin_replace_round_seating(uuid,text,integer,jsonb,jsonb,jsonb,jsonb) to authenticated, service_role;
grant execute on function public.admin_delete_form_response(uuid,boolean) to authenticated, service_role;

create index if not exists language_exchange_schedules_form_idx on public.language_exchange_schedules(form_id);
create index if not exists postings_form_idx on public.postings(form_id);
create index if not exists postings_created_by_idx on public.postings(created_by);
create index if not exists seating_assignments_participant_idx on public.seating_assignments(participant_id);
create index if not exists reports_reported_user_idx on public.reports(reported_user_id);
create index if not exists reports_posting_idx on public.reports(posting_id);
create index if not exists praises_praised_user_idx on public.praises(praised_user_id);
create index if not exists praises_posting_idx on public.praises(posting_id);
create index if not exists facility_reports_posting_idx on public.facility_reports(posting_id);
create index if not exists le_participation_archive_form_idx on public.le_participation_archive(form_id);
create index if not exists le_participation_archive_posting_idx on public.le_participation_archive(posting_id);

notify pgrst, 'reload schema';
