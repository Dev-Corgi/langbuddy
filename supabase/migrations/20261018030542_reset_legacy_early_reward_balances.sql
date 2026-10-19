-- Product decision: the new early-application program starts everyone at zero.
-- Abort instead of overwriting a balance if a new-program event was recorded
-- between the initial rollout and this reset.
do $$
begin
  if exists (
    select 1
    from public.le_reward_ledger legacy
    join public.le_reward_ledger current_event
      on current_event.user_id = legacy.user_id
     and current_event.entry_type <> 'legacy_migration'
    where legacy.entry_type = 'legacy_migration'
  ) then
    raise exception 'legacy_reward_reset_conflicts_with_new_activity';
  end if;
end;
$$;

update public.le_reward_accounts a
set stamp_count = 0,
    coupon_count = 0,
    updated_at = now()
where exists (
  select 1
  from public.le_reward_ledger l
  where l.user_id = a.user_id
    and l.entry_type = 'legacy_migration'
);

delete from public.le_reward_ledger
where entry_type = 'legacy_migration';

update public.users
set le_stamp_progress = 0,
    le_reward_coupons = 0
where coalesce(le_stamp_progress, 0) <> 0
   or coalesce(le_reward_coupons, 0) <> 0;
