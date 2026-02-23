-- Allow fixed per-user codes while keeping uniqueness for active sessions
alter table public.sessions drop constraint if exists sessions_code_key;
drop index if exists sessions_code_key;

create unique index if not exists sessions_code_active_idx
  on public.sessions (code)
  where status in ('pending', 'active');

create table if not exists public.user_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[0-9]{8}$'),
  created_at timestamptz not null default now()
);

alter table public.user_codes enable row level security;

create policy "user_codes_select_own"
  on public.user_codes
  for select
  using (user_id = auth.uid());

create policy "user_codes_insert_own"
  on public.user_codes
  for insert
  with check (user_id = auth.uid());
