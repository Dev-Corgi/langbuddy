-- Hanabi clean-room baseline for a fresh Supabase project.
-- This migration intentionally contains no LangBuddy production data.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  gender text,
  nationality text,
  kakao_id text,
  kakao_uuid text,
  kakao_access_token text,
  kakao_refresh_token text,
  kakao_token_expires_at timestamptz,
  onboarding_completed boolean not null default false,
  privacy_accepted_at timestamptz,
  privacy_policy_version text,
  is_guest boolean not null default false,
  le_stamp_progress integer not null default 0,
  le_reward_coupons integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  name_en text,
  is_superadmin boolean not null default false,
  is_admin boolean not null default false,
  is_staff boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_staff_or_admin(check_user uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = public, auth as $$
  select exists (
    select 1 from public.profiles
    where id = check_user and (is_staff or is_admin or is_superadmin)
  );
$$;
revoke all on function public.is_staff_or_admin(uuid) from public;
grant execute on function public.is_staff_or_admin(uuid) to authenticated, service_role;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer
set search_path = public, auth as $$
declare
  display_name text;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(new.email, 'User'), '@', 1)
  );
  insert into public.users (id, name)
  values (new.id, display_name)
  on conflict (id) do nothing;
  insert into public.profiles (id, name, name_en)
  values (new.id, display_name, display_name)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_auth_user();

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_en text,
  description text,
  description_en text,
  webhook_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  question_text text not null,
  question_text_en text,
  question_type text not null check (question_type in ('text','textarea','radio','checkbox','select')),
  is_required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  options_en jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  system_key text,
  show_in_qr boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index form_questions_form_order_idx on public.form_questions(form_id, display_order);

create table public.postings (
  id uuid primary key default gen_random_uuid(),
  category text not null default '번개',
  title text not null,
  title_en text,
  subtitle text,
  subtitle_en text,
  description text,
  description_ko text,
  description_en text,
  location text,
  location_en text,
  date text,
  time text,
  start_time text,
  end_time text,
  is_date_undecided boolean not null default false,
  is_time_undecided boolean not null default false,
  is_location_undecided boolean not null default false,
  max_participants integer,
  cost text,
  cost_en text,
  host text,
  host_en text,
  bank_account text,
  image_url text,
  rich_content text,
  rich_content_en text,
  apply_type text not null default 'link',
  apply_link text,
  form_id uuid references public.forms(id) on delete set null,
  is_recurring boolean not null default false,
  recurring_days text[] not null default '{}',
  day_of_week text,
  deadline timestamptz,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  seating_config jsonb not null default '{}'::jsonb,
  seating_session_epoch integer not null default 0,
  seating_session_revision integer not null default 0,
  seating_session_date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index postings_category_status_idx on public.postings(category, status);

create table public.language_exchange_schedules (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references public.postings(id) on delete cascade,
  form_id uuid references public.forms(id) on delete set null,
  day_of_week text not null,
  time text not null default '19:00',
  location text,
  location_en text,
  location_map_url text,
  max_participants integer,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(posting_id, day_of_week)
);

create table public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  payment_status text,
  payment_receipt_url text,
  checked_in_at timestamptz,
  early_reward_eligible boolean not null default false,
  early_reward_event_at timestamptz,
  early_reward_credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index form_responses_form_created_idx on public.form_responses(form_id, created_at desc);
create index form_responses_user_idx on public.form_responses(user_id);
create unique index form_responses_user_form_event_date_key
  on public.form_responses(user_id, form_id, ((answers->>'_event_date')))
  where user_id is not null and length(trim(coalesce(answers->>'_event_date',''))) >= 10;

create table public.seating_assignments (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references public.postings(id) on delete cascade,
  participant_id uuid not null references public.form_responses(id) on delete cascade,
  session_date text not null,
  round integer not null check (round > 0),
  table_label text not null,
  created_at timestamptz not null default now(),
  unique(posting_id, round, participant_id, session_date)
);
create index seating_assignments_posting_session_idx
  on public.seating_assignments(posting_id, session_date);

create table public.instagram_settings (
  id uuid primary key default gen_random_uuid(),
  access_token text,
  username text,
  is_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.instagram_settings default values;

create table public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  post_url text not null unique,
  thumbnail_url text,
  caption text,
  badge_text text,
  author_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weekly_response_reset_state (
  id text primary key default 'global',
  last_reset_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.weekly_response_reset_state(id) values ('global') on conflict do nothing;

create table public.le_participation_archive (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null,
  user_id uuid references public.users(id) on delete set null,
  form_id uuid references public.forms(id) on delete set null,
  posting_id uuid references public.postings(id) on delete set null,
  session_date text not null,
  answers jsonb not null default '{}'::jsonb,
  checked_in_at timestamptz,
  seating_history jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now(),
  unique(response_id, session_date)
);
create index le_participation_archive_user_idx on public.le_participation_archive(user_id, session_date desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid not null references public.users(id) on delete cascade,
  reporter_name text not null default '',
  reported_name text not null default '',
  posting_id uuid not null references public.postings(id) on delete cascade,
  session_date text not null,
  round integer,
  reason text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  admin_note text,
  created_at timestamptz not null default now(),
  unique(reporter_user_id, reported_user_id, posting_id, session_date)
);

create table public.praises (
  id uuid primary key default gen_random_uuid(),
  praiser_user_id uuid not null references public.users(id) on delete cascade,
  praised_user_id uuid not null references public.users(id) on delete cascade,
  praiser_name text not null default '',
  praised_name text not null default '',
  posting_id uuid not null references public.postings(id) on delete cascade,
  session_date text not null,
  round integer,
  reasons text[] not null,
  comment text,
  created_at timestamptz not null default now(),
  unique(praiser_user_id, praised_user_id, posting_id, session_date)
);

create table public.facility_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  posting_id uuid not null references public.postings(id) on delete cascade,
  session_date text not null,
  reasons text[] not null,
  comment text,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  admin_note text,
  created_at timestamptz not null default now(),
  unique(reporter_user_id, posting_id, session_date)
);

create table public.le_reward_accounts (
  user_id uuid primary key references public.users(id) on delete cascade,
  stamp_count smallint not null default 0 check (stamp_count between 0 and 9),
  coupon_count integer not null default 0 check (coupon_count >= 0),
  updated_at timestamptz not null default now()
);
create table public.le_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('early_stamp','coupon_used','coupon_refunded','legacy_migration')),
  stamp_delta integer not null default 0,
  coupon_delta integer not null default 0,
  stamp_balance smallint not null check (stamp_balance between 0 and 9),
  coupon_balance integer not null check (coupon_balance >= 0),
  response_id uuid,
  session_date date,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index le_reward_ledger_user_created_idx on public.le_reward_ledger(user_id, created_at desc);

create or replace function public.admin_assign_participant_table(
  p_posting_id uuid, p_session_date text, p_round integer,
  p_participant_id uuid, p_table_label text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff_or_admin() and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'forbidden';
  end if;
  if length(trim(coalesce(p_session_date,''))) < 10 or p_round is null or p_participant_id is null then
    raise exception 'invalid_assignment';
  end if;
  if length(trim(coalesce(p_table_label,''))) = 0 then
    delete from public.seating_assignments
      where posting_id=p_posting_id and session_date=p_session_date
        and round=p_round and participant_id=p_participant_id;
  else
    insert into public.seating_assignments(posting_id,session_date,round,table_label,participant_id)
    values(p_posting_id,p_session_date,p_round,trim(p_table_label),p_participant_id)
    on conflict(posting_id,round,participant_id,session_date)
    do update set table_label=excluded.table_label;
  end if;
end;
$$;

create or replace function public.admin_replace_round_seating(
  p_posting_id uuid, p_session_date text, p_round integer,
  p_table_languages jsonb, p_table_order jsonb default null,
  p_lang_table_counts jsonb default null, p_assignments jsonb default '[]'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_config jsonb;
begin
  if not public.is_staff_or_admin() and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'forbidden';
  end if;
  select seating_config into v_config from public.postings where id=p_posting_id for update;
  if not found then raise exception 'posting_not_found'; end if;
  v_config := jsonb_set(coalesce(v_config,'{}'), '{tableLanguagesByRound}',
    coalesce(v_config->'tableLanguagesByRound','{}') || jsonb_build_object(p_round::text,coalesce(p_table_languages,'{}')));
  if p_table_order is not null then
    v_config := jsonb_set(v_config,'{tableOrderByRound}',
      coalesce(v_config->'tableOrderByRound','{}') || jsonb_build_object(p_round::text,p_table_order));
  end if;
  if p_lang_table_counts is not null then
    v_config := jsonb_set(v_config,'{langTableCounts}',p_lang_table_counts);
  end if;
  update public.postings set seating_config=v_config where id=p_posting_id;
  delete from public.seating_assignments
    where posting_id=p_posting_id and session_date=p_session_date and round=p_round;
  insert into public.seating_assignments(posting_id,session_date,round,table_label,participant_id)
  select p_posting_id,p_session_date,p_round,trim(x->>'table_label'),(x->>'participant_id')::uuid
  from jsonb_array_elements(coalesce(p_assignments,'[]')) x
  where length(trim(coalesce(x->>'table_label',''))) > 0 and x->>'participant_id' is not null;
end;
$$;

create or replace function public.admin_delete_form_response(
  p_response_id uuid, p_refund_coupon boolean default true
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff_or_admin() and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'forbidden';
  end if;
  delete from public.form_responses where id=p_response_id;
end;
$$;

revoke all on function public.admin_assign_participant_table(uuid,text,integer,uuid,text) from public;
revoke all on function public.admin_replace_round_seating(uuid,text,integer,jsonb,jsonb,jsonb,jsonb) from public;
revoke all on function public.admin_delete_form_response(uuid,boolean) from public;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.is_staff_or_admin(uuid) from public, anon;
revoke all on function public.admin_assign_participant_table(uuid,text,integer,uuid,text) from anon;
revoke all on function public.admin_replace_round_seating(uuid,text,integer,jsonb,jsonb,jsonb,jsonb) from anon;
revoke all on function public.admin_delete_form_response(uuid,boolean) from anon;
grant execute on function public.admin_assign_participant_table(uuid,text,integer,uuid,text) to authenticated,service_role;
grant execute on function public.admin_replace_round_seating(uuid,text,integer,jsonb,jsonb,jsonb,jsonb) to authenticated,service_role;
grant execute on function public.admin_delete_form_response(uuid,boolean) to authenticated,service_role;

-- Updated-at triggers.
do $$ declare t text; begin
  foreach t in array array['users','profiles','forms','form_questions','postings','language_exchange_schedules','form_responses','instagram_settings','instagram_posts'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

-- RLS is enabled on every public table. Service-role operations bypass these policies.
do $$ declare t text; begin
  foreach t in array array[
    'users','profiles','forms','form_questions','postings','language_exchange_schedules',
    'form_responses','seating_assignments','instagram_settings','instagram_posts',
    'weekly_response_reset_state','le_participation_archive','reports','praises',
    'facility_reports','le_reward_accounts','le_reward_ledger'
  ] loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

create policy users_select_own_or_staff on public.users for select to authenticated
  using (id=auth.uid() or public.is_staff_or_admin());
create policy users_update_own on public.users for update to authenticated
  using (id=auth.uid()) with check (id=auth.uid());
create policy users_insert_own on public.users for insert to authenticated with check (id=auth.uid());
create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id=auth.uid()) with check (id=auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id=auth.uid());

create policy forms_public_read on public.forms for select using (is_active or public.is_staff_or_admin());
create policy forms_staff_write on public.forms for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy form_questions_public_read on public.form_questions for select using (true);
create policy form_questions_staff_write on public.form_questions for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy postings_public_read on public.postings for select using (status='active' or public.is_staff_or_admin());
create policy postings_staff_write on public.postings for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy schedules_public_read on public.language_exchange_schedules for select using (true);
create policy schedules_staff_write on public.language_exchange_schedules for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

create policy responses_insert_own on public.form_responses for insert to authenticated
  with check (user_id=auth.uid());
create policy responses_select_own_or_staff on public.form_responses for select to authenticated
  using (user_id=auth.uid() or public.is_staff_or_admin());
create policy responses_update_own_or_staff on public.form_responses for update to authenticated
  using (user_id=auth.uid() or public.is_staff_or_admin())
  with check (user_id=auth.uid() or public.is_staff_or_admin());
create policy responses_staff_delete on public.form_responses for delete to authenticated using (public.is_staff_or_admin());
create policy seating_select_participant_or_staff on public.seating_assignments for select to authenticated
  using (public.is_staff_or_admin() or exists(select 1 from public.form_responses r where r.id=participant_id and r.user_id=auth.uid()));
create policy seating_staff_write on public.seating_assignments for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

create policy instagram_posts_public_read on public.instagram_posts for select using (is_active or public.is_staff_or_admin());
create policy instagram_posts_staff_write on public.instagram_posts for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy instagram_settings_staff on public.instagram_settings for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy reset_state_staff_read on public.weekly_response_reset_state for select to authenticated using (public.is_staff_or_admin());
create policy archive_own_or_staff on public.le_participation_archive for select to authenticated
  using (user_id=auth.uid() or public.is_staff_or_admin());

create policy reports_insert_own on public.reports for insert to authenticated with check (reporter_user_id=auth.uid());
create policy reports_select_own_or_staff on public.reports for select to authenticated
  using (reporter_user_id=auth.uid() or public.is_staff_or_admin());
create policy praises_insert_own on public.praises for insert to authenticated with check (praiser_user_id=auth.uid());
create policy praises_select_own_or_staff on public.praises for select to authenticated
  using (praiser_user_id=auth.uid() or public.is_staff_or_admin());
create policy facility_insert_own on public.facility_reports for insert to authenticated with check (reporter_user_id=auth.uid());
create policy facility_select_own_or_staff on public.facility_reports for select to authenticated
  using (reporter_user_id=auth.uid() or public.is_staff_or_admin());
create policy reward_account_own on public.le_reward_accounts for select to authenticated using (user_id=auth.uid());
create policy reward_ledger_own on public.le_reward_ledger for select to authenticated using (user_id=auth.uid());

-- Public assets used by the current UI. Upload/delete remains authenticated.
insert into storage.buckets(id,name,public) values ('postings','postings',true) on conflict(id) do update set public=true;
insert into storage.buckets(id,name,public) values ('payment-receipts','payment-receipts',true) on conflict(id) do update set public=true;
create policy hanabi_storage_public_read on storage.objects for select using (bucket_id in ('postings','payment-receipts'));
create policy hanabi_storage_authenticated_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('postings','payment-receipts'));
create policy hanabi_storage_authenticated_update on storage.objects for update to authenticated
  using (bucket_id in ('postings','payment-receipts'));
create policy hanabi_storage_authenticated_delete on storage.objects for delete to authenticated
  using (bucket_id in ('postings','payment-receipts'));

alter publication supabase_realtime add table public.form_responses;
alter publication supabase_realtime add table public.seating_assignments;

create index language_exchange_schedules_form_idx on public.language_exchange_schedules(form_id);
create index postings_form_idx on public.postings(form_id);
create index postings_created_by_idx on public.postings(created_by);
create index seating_assignments_participant_idx on public.seating_assignments(participant_id);
create index reports_reported_user_idx on public.reports(reported_user_id);
create index reports_posting_idx on public.reports(posting_id);
create index praises_praised_user_idx on public.praises(praised_user_id);
create index praises_posting_idx on public.praises(posting_id);
create index facility_reports_posting_idx on public.facility_reports(posting_id);
create index le_participation_archive_form_idx on public.le_participation_archive(form_id);
create index le_participation_archive_posting_idx on public.le_participation_archive(posting_id);

notify pgrst, 'reload schema';
