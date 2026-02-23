-- Enable extensions
create extension if not exists pgcrypto;

-- Sessions
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'active', 'ended', 'denied')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_created_by_idx on public.sessions (created_by);
create index if not exists sessions_expires_at_idx on public.sessions (expires_at);

-- Participants
create table if not exists public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('client', 'agent')),
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create unique index if not exists session_participants_unique_idx on public.session_participants (session_id, user_id);
create index if not exists session_participants_user_idx on public.session_participants (user_id);

-- Requests
create table if not exists public.session_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'denied')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists session_requests_session_idx on public.session_requests (session_id);
create index if not exists session_requests_requester_idx on public.session_requests (requester_user_id);
create unique index if not exists session_requests_pending_unique_idx
  on public.session_requests (session_id, requester_user_id)
  where status = 'pending';

-- Signaling
create table if not exists public.session_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('offer', 'answer', 'ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists session_signals_session_idx on public.session_signals (session_id);
create index if not exists session_signals_to_user_idx on public.session_signals (to_user_id);

-- Chat messages
create table if not exists public.session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists session_messages_session_idx on public.session_messages (session_id);

-- Audit events
create table if not exists public.session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists session_events_session_idx on public.session_events (session_id);

-- Rate limit events
create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_user_action_idx on public.rate_limit_events (user_id, action, created_at desc);

-- RLS
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_requests enable row level security;
alter table public.session_signals enable row level security;
alter table public.session_messages enable row level security;
alter table public.session_events enable row level security;
alter table public.rate_limit_events enable row level security;

-- Sessions policies
create policy "sessions_select_participants_or_requesters"
  on public.sessions
  for select
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.session_participants sp
      where sp.session_id = sessions.id
        and sp.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.session_requests sr
      where sr.session_id = sessions.id
        and sr.requester_user_id = auth.uid()
    )
  );

create policy "sessions_insert_owner"
  on public.sessions
  for insert
  with check (created_by = auth.uid());

create policy "sessions_update_owner"
  on public.sessions
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "sessions_end_by_participant"
  on public.sessions
  for update
  using (
    exists (
      select 1
      from public.session_participants sp
      where sp.session_id = sessions.id
        and sp.user_id = auth.uid()
    )
  )
  with check (status = 'ended');

-- Participants policies
create policy "participants_select_session_members"
  on public.session_participants
  for select
  using (
    exists (
      select 1
      from public.session_participants sp
      where sp.session_id = session_participants.session_id
        and sp.user_id = auth.uid()
    )
  );

create policy "participants_insert_self"
  on public.session_participants
  for insert
  with check (user_id = auth.uid());

create policy "participants_update_self"
  on public.session_participants
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Requests policies
create policy "requests_select_owner_or_requester"
  on public.session_requests
  for select
  using (
    requester_user_id = auth.uid()
    or exists (
      select 1
      from public.sessions s
      where s.id = session_requests.session_id
        and s.created_by = auth.uid()
    )
  );

create policy "requests_insert_pending"
  on public.session_requests
  for insert
  with check (
    requester_user_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      where s.id = session_requests.session_id
        and s.status = 'pending'
        and s.expires_at > now()
        and s.created_by <> auth.uid()
    )
  );

create policy "requests_update_owner"
  on public.session_requests
  for update
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_requests.session_id
        and s.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_requests.session_id
        and s.created_by = auth.uid()
    )
  );

-- Signaling policies
create policy "signals_select_participants"
  on public.session_signals
  for select
  using (
    exists (
      select 1
      from public.session_participants sp
      where sp.session_id = session_signals.session_id
        and sp.user_id = auth.uid()
    )
  );

create policy "signals_insert_participants"
  on public.session_signals
  for insert
  with check (
    from_user_id = auth.uid()
    and exists (
      select 1
      from public.session_participants sp
      where sp.session_id = session_signals.session_id
        and sp.user_id = auth.uid()
    )
  );

-- Chat policies
create policy "messages_select_participants"
  on public.session_messages
  for select
  using (
    exists (
      select 1
      from public.session_participants sp
      where sp.session_id = session_messages.session_id
        and sp.user_id = auth.uid()
    )
  );

create policy "messages_insert_participants"
  on public.session_messages
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.session_participants sp
      where sp.session_id = session_messages.session_id
        and sp.user_id = auth.uid()
    )
  );

-- Events policies
create policy "events_select_participants"
  on public.session_events
  for select
  using (
    exists (
      select 1
      from public.session_participants sp
      where sp.session_id = session_events.session_id
        and sp.user_id = auth.uid()
    )
  );

create policy "events_insert_participants_or_requesters"
  on public.session_events
  for insert
  with check (
    actor_user_id = auth.uid()
    and (
      exists (
        select 1
        from public.session_participants sp
        where sp.session_id = session_events.session_id
          and sp.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.session_requests sr
        where sr.session_id = session_events.session_id
          and sr.requester_user_id = auth.uid()
      )
    )
  );

-- Rate limit policies
create policy "rate_limits_select_own"
  on public.rate_limit_events
  for select
  using (user_id = auth.uid());

create policy "rate_limits_insert_own"
  on public.rate_limit_events
  for insert
  with check (user_id = auth.uid());
