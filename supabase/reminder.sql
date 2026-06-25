-- ============================================================
-- Quit Buddy - Daily roll reminder tracking
-- Run this in SQL Editor.
-- ============================================================

create table public.roll_reminders_sent (
  reminder_date date primary key
);

alter table public.roll_reminders_sent enable row level security;
-- No policies needed - only the Edge Function (using the service role key,
-- which bypasses RLS) ever touches this table.


create table public.midnight_congrats_sent (
  sent_date date primary key
);

alter table public.midnight_congrats_sent enable row level security;
