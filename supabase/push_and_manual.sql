-- ============================================================
-- Quit Buddy - Manual allowance + push notification storage
-- Run this in SQL Editor, after everything you've already run.
-- ============================================================

-- Let someone set/override today's allowance by hand.
create or replace function public.set_manual_allowance(p_value int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_day date := public.get_smoking_day();
begin
  if p_value < 0 then
    raise exception 'Allowance cannot be negative';
  end if;

  insert into public.daily_entries (user_id, entry_date, dice_total)
  values (auth.uid(), v_day, p_value)
  on conflict (user_id, entry_date)
  do update set dice_total = p_value;
end;
$$;
grant execute on function public.set_manual_allowance(int) to authenticated;


-- Stores each device's push notification subscription.
-- Private to each user (unlike the other tables, nobody else can read these).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now() not null,
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "users manage their own push subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
