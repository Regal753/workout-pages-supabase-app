create extension if not exists pgcrypto;

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_date date not null,
  bodyweight_kg numeric(5,1),
  pain_shoulder smallint not null default 0 check (pain_shoulder between 0 and 10),
  session_note text not null default '',
  entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workout_logs_user_date
  on public.workout_logs(user_id, workout_date desc, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workout_logs_updated_at on public.workout_logs;
create trigger trg_workout_logs_updated_at
before update on public.workout_logs
for each row
execute function public.set_updated_at();

alter table public.workout_logs enable row level security;

drop policy if exists "workout_logs_select_own" on public.workout_logs;
create policy "workout_logs_select_own"
on public.workout_logs
for select
using (auth.uid() = user_id);

drop policy if exists "workout_logs_insert_own" on public.workout_logs;
create policy "workout_logs_insert_own"
on public.workout_logs
for insert
with check (auth.uid() = user_id);

drop policy if exists "workout_logs_update_own" on public.workout_logs;
create policy "workout_logs_update_own"
on public.workout_logs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "workout_logs_delete_own" on public.workout_logs;
create policy "workout_logs_delete_own"
on public.workout_logs
for delete
using (auth.uid() = user_id);
