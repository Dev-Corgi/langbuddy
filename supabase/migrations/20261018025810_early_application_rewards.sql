-- Early-application loyalty rewards for recurring language exchange sessions.
-- A qualifying application becomes one stamp only after its first check-in.

create table if not exists public.le_reward_accounts (
  user_id uuid primary key references public.users(id) on delete cascade,
  stamp_count smallint not null default 0 check (stamp_count between 0 and 9),
  coupon_count integer not null default 0 check (coupon_count >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.le_reward_accounts is
  '언어교환 조기 신청 리워드 잔액. 도장 10개마다 무료 참가권 1장을 발급한다.';

create table if not exists public.le_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('early_stamp', 'coupon_used', 'coupon_refunded', 'legacy_migration')),
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

comment on table public.le_reward_ledger is
  '언어교환 조기 신청 도장과 무료 참가권의 변경 원장. 신청 응답이 주간 삭제되어도 유지된다.';

create index if not exists le_reward_ledger_user_created_idx
  on public.le_reward_ledger (user_id, created_at desc);

alter table public.le_reward_accounts enable row level security;
alter table public.le_reward_ledger enable row level security;

revoke all on public.le_reward_accounts from anon;
revoke all on public.le_reward_ledger from anon;
revoke insert, update, delete on public.le_reward_accounts from authenticated;
revoke insert, update, delete on public.le_reward_ledger from authenticated;
grant select on public.le_reward_accounts to authenticated;
grant select on public.le_reward_ledger to authenticated;
grant all on public.le_reward_accounts to service_role;
grant all on public.le_reward_ledger to service_role;

drop policy if exists "Users can view own reward account" on public.le_reward_accounts;
create policy "Users can view own reward account"
  on public.le_reward_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own reward ledger" on public.le_reward_ledger;
create policy "Users can view own reward ledger"
  on public.le_reward_ledger
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.form_responses
  add column if not exists early_reward_eligible boolean not null default false,
  add column if not exists early_reward_event_at timestamptz,
  add column if not exists early_reward_credited_at timestamptz;

comment on column public.form_responses.early_reward_eligible is
  '모임 시작 24시간 전까지 신청해 체크인 시 조기 신청 도장을 받을 수 있는지 여부';
comment on column public.form_responses.early_reward_event_at is
  '신청 당시 요일별 일정으로 계산한 모임 시작 시각(Asia/Seoul)';
comment on column public.form_responses.early_reward_credited_at is
  '조기 신청 도장이 최초 적립된 시각. 체크인 해제 후에도 유지해 중복 적립을 막는다.';

create or replace function public.le_prepare_application_reward()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  schedule_row public.language_exchange_schedules%rowtype;
  event_date_text text;
  event_time time;
  event_at timestamptz;
  payment_method text;
  wants_coupon boolean;
  account_row public.le_reward_accounts%rowtype;
  jwt_role text;
begin
  select les.*
  into schedule_row
  from public.language_exchange_schedules les
  where les.form_id = new.form_id
    and coalesce(les.is_active, true)
  limit 1;

  if not found then
    new.early_reward_eligible := false;
    new.early_reward_event_at := null;
    return new;
  end if;

  event_date_text := nullif(new.answers->>'_event_date', '');
  if event_date_text is not null
     and event_date_text ~ '^\d{4}-\d{2}-\d{2}$'
     and schedule_row.time ~ '^\d{1,2}:\d{2}(:\d{2})?$' then
    begin
      event_time := schedule_row.time::time;
      event_at := (event_date_text::date + event_time) at time zone 'Asia/Seoul';
    exception when others then
      event_at := null;
    end;
  end if;

  payment_method := coalesce(new.answers->>'_payment_method', '');
  wants_coupon := lower(coalesce(new.answers->>'_le_free_coupon', '')) in ('true', '1', 'yes')
    or payment_method in ('쿠폰사용', '무료쿠폰', '무료쿠폰(10스탬프)');

  new.early_reward_event_at := event_at;
  new.early_reward_eligible := new.user_id is not null
    and event_at is not null
    and now() <= event_at - interval '24 hours'
    and payment_method not in ('스탭무료', '쿠폰사용', '무료쿠폰', '무료쿠폰(10스탬프)');

  if not wants_coupon then
    return new;
  end if;

  if new.user_id is null then
    raise exception 'coupon_requires_login' using errcode = 'check_violation';
  end if;

  if event_at is null or event_at <= now() then
    raise exception 'invalid_coupon_session' using errcode = 'check_violation';
  end if;

  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role <> 'service_role' and (select auth.uid()) is distinct from new.user_id then
    raise exception 'coupon_user_mismatch' using errcode = 'insufficient_privilege';
  end if;

  insert into public.le_reward_accounts (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;

  select a.* into account_row
  from public.le_reward_accounts a
  where a.user_id = new.user_id
  for update;

  if account_row.coupon_count <= 0 then
    raise exception 'no_coupon_available' using errcode = 'check_violation';
  end if;

  update public.le_reward_accounts
  set coupon_count = coupon_count - 1,
      updated_at = now()
  where user_id = new.user_id
  returning * into account_row;

  new.answers := jsonb_set(
    jsonb_set(new.answers, '{_payment_method}', to_jsonb('쿠폰사용'::text), true),
    '{_le_free_coupon}', 'true'::jsonb, true
  );
  new.payment_status := 'confirmed';
  new.payment_receipt_url := null;
  new.early_reward_eligible := false;

  insert into public.le_reward_ledger (
    user_id, entry_type, coupon_delta, stamp_balance, coupon_balance,
    response_id, session_date, idempotency_key, metadata
  ) values (
    new.user_id, 'coupon_used', -1, account_row.stamp_count, account_row.coupon_count,
    new.id,
    case when event_date_text ~ '^\d{4}-\d{2}-\d{2}$' then event_date_text::date else null end,
    'coupon_used:' || new.id::text,
    jsonb_build_object('form_id', new.form_id)
  );

  return new;
end;
$$;

create or replace function public.le_credit_early_application_stamp()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  account_row public.le_reward_accounts%rowtype;
  next_stamp smallint;
  coupon_gain integer;
begin
  if new.checked_in_at is null
     or old.checked_in_at is not null
     or not new.early_reward_eligible
     or new.early_reward_credited_at is not null
     or new.user_id is null then
    return new;
  end if;

  if exists (
    select 1 from public.le_reward_ledger l
    where l.idempotency_key = 'early_stamp:' || new.id::text
  ) then
    select l.created_at into new.early_reward_credited_at
    from public.le_reward_ledger l
    where l.idempotency_key = 'early_stamp:' || new.id::text;
    return new;
  end if;

  insert into public.le_reward_accounts (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;

  select a.* into account_row
  from public.le_reward_accounts a
  where a.user_id = new.user_id
  for update;

  coupon_gain := case when account_row.stamp_count >= 9 then 1 else 0 end;
  next_stamp := ((account_row.stamp_count + 1) % 10)::smallint;

  update public.le_reward_accounts
  set stamp_count = next_stamp,
      coupon_count = coupon_count + coupon_gain,
      updated_at = now()
  where user_id = new.user_id
  returning * into account_row;

  new.early_reward_credited_at := now();

  insert into public.le_reward_ledger (
    user_id, entry_type, stamp_delta, coupon_delta, stamp_balance, coupon_balance,
    response_id, session_date, idempotency_key, metadata, created_at
  ) values (
    new.user_id, 'early_stamp', 1, coupon_gain, account_row.stamp_count, account_row.coupon_count,
    new.id,
    case
      when coalesce(new.answers->>'_event_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      then (new.answers->>'_event_date')::date
      else null
    end,
    'early_stamp:' || new.id::text,
    jsonb_build_object('form_id', new.form_id, 'coupon_issued', coupon_gain = 1),
    new.early_reward_credited_at
  );

  return new;
end;
$$;

create or replace function public.le_refund_coupon_before_session()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  used_coupon boolean;
  account_row public.le_reward_accounts%rowtype;
begin
  used_coupon := lower(coalesce(old.answers->>'_le_free_coupon', '')) in ('true', '1', 'yes')
    or coalesce(old.answers->>'_payment_method', '') in ('쿠폰사용', '무료쿠폰', '무료쿠폰(10스탬프)');

  if not used_coupon
     or old.user_id is null
     or old.checked_in_at is not null
     or old.early_reward_event_at is null
     or old.early_reward_event_at <= now()
     or exists (
       select 1 from public.le_reward_ledger l
       where l.idempotency_key = 'coupon_refunded:' || old.id::text
     ) then
    return old;
  end if;

  insert into public.le_reward_accounts (user_id)
  values (old.user_id)
  on conflict (user_id) do nothing;

  update public.le_reward_accounts
  set coupon_count = coupon_count + 1,
      updated_at = now()
  where user_id = old.user_id
  returning * into account_row;

  insert into public.le_reward_ledger (
    user_id, entry_type, coupon_delta, stamp_balance, coupon_balance,
    response_id, session_date, idempotency_key, metadata
  ) values (
    old.user_id, 'coupon_refunded', 1, account_row.stamp_count, account_row.coupon_count,
    old.id,
    case
      when coalesce(old.answers->>'_event_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      then (old.answers->>'_event_date')::date
      else null
    end,
    'coupon_refunded:' || old.id::text,
    jsonb_build_object('form_id', old.form_id)
  );

  return old;
end;
$$;

revoke all on function public.le_prepare_application_reward() from public, anon, authenticated;
revoke all on function public.le_credit_early_application_stamp() from public, anon, authenticated;
revoke all on function public.le_refund_coupon_before_session() from public, anon, authenticated;

drop trigger if exists form_responses_prepare_early_reward on public.form_responses;
create trigger form_responses_prepare_early_reward
  before insert on public.form_responses
  for each row execute function public.le_prepare_application_reward();

drop trigger if exists form_responses_credit_early_reward on public.form_responses;
create trigger form_responses_credit_early_reward
  before update of checked_in_at on public.form_responses
  for each row execute function public.le_credit_early_application_stamp();

drop trigger if exists form_responses_refund_reward_coupon on public.form_responses;
create trigger form_responses_refund_reward_coupon
  before delete on public.form_responses
  for each row execute function public.le_refund_coupon_before_session();

-- Existing future applications join the program if they already satisfy the same rule.
with candidates as (
  select distinct on (fr.id)
    fr.id,
    ((fr.answers->>'_event_date')::date + les.time::time) at time zone 'Asia/Seoul' as event_at
  from public.form_responses fr
  join public.language_exchange_schedules les on les.form_id = fr.form_id
  where fr.checked_in_at is null
    and coalesce(les.is_active, true)
    and coalesce(fr.answers->>'_event_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
    and les.time ~ '^\d{1,2}:\d{2}(:\d{2})?$'
  order by fr.id, les.updated_at desc nulls last
)
update public.form_responses fr
set early_reward_event_at = candidates.event_at,
    early_reward_eligible = fr.user_id is not null
      and fr.created_at <= candidates.event_at - interval '24 hours'
      and coalesce(fr.answers->>'_payment_method', '') not in
        ('스탭무료', '쿠폰사용', '무료쿠폰', '무료쿠폰(10스탬프)')
from candidates
where candidates.id = fr.id
  and candidates.event_at > now();

-- Carry the old scalar balances forward once, preserving existing customer progress.
insert into public.le_reward_accounts (user_id, stamp_count, coupon_count)
select
  u.id,
  least(greatest(coalesce(u.le_stamp_progress, 0), 0), 9)::smallint,
  greatest(coalesce(u.le_reward_coupons, 0), 0)
from public.users u
where coalesce(u.le_stamp_progress, 0) > 0
   or coalesce(u.le_reward_coupons, 0) > 0
on conflict (user_id) do nothing;

insert into public.le_reward_ledger (
  user_id, entry_type, stamp_delta, coupon_delta, stamp_balance, coupon_balance,
  idempotency_key, metadata
)
select
  a.user_id,
  'legacy_migration',
  a.stamp_count,
  a.coupon_count,
  a.stamp_count,
  a.coupon_count,
  'legacy_migration:' || a.user_id::text,
  jsonb_build_object('source', 'users.le_stamp_progress/le_reward_coupons')
from public.le_reward_accounts a
where a.stamp_count > 0 or a.coupon_count > 0
on conflict (idempotency_key) do nothing;

-- The former scalar fields remain untouched for historical reference.
comment on column public.users.le_stamp_progress is
  'DEPRECATED: 2026-10-18부터 le_reward_accounts/le_reward_ledger를 사용한다.';
comment on column public.users.le_reward_coupons is
  'DEPRECATED: 2026-10-18부터 le_reward_accounts/le_reward_ledger를 사용한다.';
