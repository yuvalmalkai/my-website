-- ============================================================
-- Quit Buddy - Database Schema v2
-- Replaces the previous schema. Run this whole file in:
-- Supabase -> SQL Editor -> New Query -> Run
-- ============================================================

-- Clean up the previous (simpler) version of this schema, if it exists.
drop function if exists public.report_exceeded() cascade;
drop function if exists public.report_cigarette() cascade;
drop function if exists public.roll_today() cascade;
drop table if exists public.daily_entries cascade;

-- ------------------------------------------------------------
-- 1. PROFILES (unchanged - skip if it already exists)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by authenticated users" on public.profiles;
create policy "profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();


-- ------------------------------------------------------------
-- 2. HELPER: what "smoking day" is it right now?
-- A smoking day runs 7am -> 7am Israel time, not midnight -> midnight.
-- ------------------------------------------------------------
create or replace function public.get_smoking_day(ts timestamptz default now())
returns date language sql stable as $$
  select case
    when (ts at time zone 'Asia/Jerusalem')::time >= time '07:00'
    then (ts at time zone 'Asia/Jerusalem')::date
    else (ts at time zone 'Asia/Jerusalem')::date - 1
  end
$$;

grant execute on function public.get_smoking_day(timestamptz) to authenticated;


-- ------------------------------------------------------------
-- 3. ROLL NIGHTS - one row per calendar evening
-- ------------------------------------------------------------
create table public.roll_nights (
  id uuid primary key default gen_random_uuid(),
  roll_date date unique not null,
  dice_count int check (dice_count between 1 and 5),
  status text not null default 'collecting' check (status in ('collecting', 'rolled')),
  rolled_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.roll_nights enable row level security;

create policy "roll nights are viewable by authenticated users"
  on public.roll_nights for select to authenticated using (true);


-- ------------------------------------------------------------
-- 4. ROLL PARTICIPANTS - who's ready, and their dice once rolled
-- ------------------------------------------------------------
create table public.roll_participants (
  id uuid primary key default gen_random_uuid(),
  roll_night_id uuid references public.roll_nights (id) on delete cascade not null,
  user_id uuid references public.profiles (id) on delete cascade not null,
  ready boolean not null default true,
  dice_results int[],
  dice_total int,
  created_at timestamptz default now() not null,
  unique (roll_night_id, user_id)
);

alter table public.roll_participants enable row level security;

create policy "roll participants are viewable by authenticated users"
  on public.roll_participants for select to authenticated using (true);


-- ------------------------------------------------------------
-- 5. DAILY ENTRIES - each member's allowance for a given smoking day
-- ------------------------------------------------------------
create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade not null,
  entry_date date not null,
  dice_total int not null,
  manually_exceeded boolean not null default false,
  roll_night_id uuid references public.roll_nights (id) on delete set null,
  created_at timestamptz default now() not null,
  unique (user_id, entry_date)
);

alter table public.daily_entries enable row level security;

create policy "daily entries are viewable by authenticated users"
  on public.daily_entries for select to authenticated using (true);


-- ------------------------------------------------------------
-- 6. CIGARETTE LOGS - one row per cigarette (so "undo" is exact)
-- ------------------------------------------------------------
create table public.cigarette_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade not null,
  entry_date date not null,
  created_at timestamptz default now() not null
);

alter table public.cigarette_logs enable row level security;

create policy "cigarette logs are viewable by authenticated users"
  on public.cigarette_logs for select to authenticated using (true);

-- Note: none of the 4 tables above have insert/update/delete policies
-- for regular users. The functions below are the ONLY way to write data -
-- they run server-side, so nobody can edit their own (or anyone else's)
-- numbers directly from the browser.


-- ------------------------------------------------------------
-- 7. FUNCTIONS
-- ------------------------------------------------------------

-- Set (or change) how many dice tonight's roll will use, 1-5.
create or replace function public.set_dice_count(p_dice_count int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_roll_date date := (now() at time zone 'Asia/Jerusalem')::date;
  v_status text;
begin
  if p_dice_count < 1 or p_dice_count > 5 then
    raise exception 'Dice count must be between 1 and 5';
  end if;

  select status into v_status from public.roll_nights where roll_date = v_roll_date;

  if v_status = 'rolled' then
    raise exception 'Tonight has already been rolled - redo it first to change the dice count';
  end if;

  insert into public.roll_nights (roll_date, dice_count)
  values (v_roll_date, p_dice_count)
  on conflict (roll_date) do update set dice_count = p_dice_count;
end;
$$;
grant execute on function public.set_dice_count(int) to authenticated;


-- Mark yourself "ready to roll" for tonight.
create or replace function public.mark_ready()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_roll_date date := (now() at time zone 'Asia/Jerusalem')::date;
  v_roll_night_id uuid;
  v_status text;
begin
  insert into public.roll_nights (roll_date) values (v_roll_date)
  on conflict (roll_date) do nothing;

  select id, status into v_roll_night_id, v_status
  from public.roll_nights where roll_date = v_roll_date;

  if v_status = 'rolled' then
    raise exception 'Tonight has already been rolled';
  end if;

  insert into public.roll_participants (roll_night_id, user_id, ready)
  values (v_roll_night_id, auth.uid(), true)
  on conflict (roll_night_id, user_id) do update set ready = true;
end;
$$;
grant execute on function public.mark_ready() to authenticated;


-- Change your mind before the roll happens.
create or replace function public.unmark_ready()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_roll_date date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  update public.roll_participants
  set ready = false
  where user_id = auth.uid()
    and roll_night_id = (select id from public.roll_nights where roll_date = v_roll_date);
end;
$$;
grant execute on function public.unmark_ready() to authenticated;


-- Roll the dice for everyone who's ready tonight (only allowed after 7pm).
create or replace function public.roll_tonight()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_roll_date date := (now() at time zone 'Asia/Jerusalem')::date;
  v_local_time time := (now() at time zone 'Asia/Jerusalem')::time;
  v_roll_night public.roll_nights;
  v_participant record;
  v_dice int[];
  v_total int;
  v_target_day date;
  i int;
begin
  if v_local_time < time '19:00' then
    raise exception 'Rolling only opens at 7pm';
  end if;

  select * into v_roll_night from public.roll_nights where roll_date = v_roll_date;

  if v_roll_night is null or v_roll_night.dice_count is null then
    raise exception 'Set tonight''s dice count before rolling';
  end if;

  if v_roll_night.status = 'rolled' then
    raise exception 'Tonight has already been rolled';
  end if;

  v_target_day := v_roll_date + 1;

  for v_participant in
    select * from public.roll_participants
    where roll_night_id = v_roll_night.id and ready = true
  loop
    v_dice := array[]::int[];
    for i in 1..v_roll_night.dice_count loop
      v_dice := v_dice || (floor(random() * 6) + 1)::int;
    end loop;
    select sum(x) into v_total from unnest(v_dice) x;

    update public.roll_participants
    set dice_results = v_dice, dice_total = v_total
    where id = v_participant.id;

    insert into public.daily_entries (user_id, entry_date, dice_total, roll_night_id)
    values (v_participant.user_id, v_target_day, v_total, v_roll_night.id)
    on conflict (user_id, entry_date)
    do update set dice_total = v_total, roll_night_id = v_roll_night.id;
  end loop;

  update public.roll_nights set status = 'rolled', rolled_at = now() where id = v_roll_night.id;
end;
$$;
grant execute on function public.roll_tonight() to authenticated;


-- Undo tonight's roll completely (blocked once tomorrow's cigarettes start being logged).
create or replace function public.redo_tonights_roll()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_roll_date date := (now() at time zone 'Asia/Jerusalem')::date;
  v_roll_night public.roll_nights;
  v_target_day date;
  v_already_logged int;
begin
  select * into v_roll_night from public.roll_nights where roll_date = v_roll_date;

  if v_roll_night is null or v_roll_night.status <> 'rolled' then
    raise exception 'Tonight has not been rolled yet - nothing to redo';
  end if;

  v_target_day := v_roll_date + 1;

  select count(*) into v_already_logged from public.cigarette_logs where entry_date = v_target_day;

  if v_already_logged > 0 then
    raise exception 'Cannot redo - cigarettes have already been logged for that day';
  end if;

  delete from public.daily_entries where roll_night_id = v_roll_night.id;

  update public.roll_participants
  set dice_results = null, dice_total = null
  where roll_night_id = v_roll_night.id;

  update public.roll_nights set status = 'collecting', rolled_at = null where id = v_roll_night.id;
end;
$$;
grant execute on function public.redo_tonights_roll() to authenticated;


-- Log one cigarette for the current smoking day.
create or replace function public.log_cigarette()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.cigarette_logs (user_id, entry_date)
  values (auth.uid(), public.get_smoking_day());
end;
$$;
grant execute on function public.log_cigarette() to authenticated;


-- Undo the most recent cigarette you logged today (exact undo, no guessing).
create or replace function public.undo_last_cigarette()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from public.cigarette_logs
  where user_id = auth.uid() and entry_date = public.get_smoking_day()
  order by created_at desc limit 1;

  if v_id is not null then
    delete from public.cigarette_logs where id = v_id;
  end if;
end;
$$;
grant execute on function public.undo_last_cigarette() to authenticated;


-- Toggle the "I went over today" flag on/off.
create or replace function public.set_exceeded_flag(p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_day date := public.get_smoking_day();
begin
  update public.daily_entries
  set manually_exceeded = p_value
  where user_id = auth.uid() and entry_date = v_day;

  if not found then
    raise exception 'No allowance set for today yet';
  end if;
end;
$$;
grant execute on function public.set_exceeded_flag(boolean) to authenticated;


-- ------------------------------------------------------------
-- 8. REALTIME - let the frontend live-update for everyone
-- ------------------------------------------------------------
alter publication supabase_realtime add table
  public.roll_nights,
  public.roll_participants,
  public.daily_entries,
  public.cigarette_logs;
