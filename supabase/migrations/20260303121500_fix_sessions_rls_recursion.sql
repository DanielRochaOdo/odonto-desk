-- Fix RLS recursion on sessions policy

create or replace function public.is_session_requester(target_session_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.session_requests sr
    where sr.session_id = target_session_id
      and sr.requester_user_id = target_user_id
  );
$$;

grant execute on function public.is_session_requester(uuid, uuid) to anon, authenticated;

drop policy if exists "sessions_select_participants_or_requesters" on public.sessions;

create policy "sessions_select_participants_or_requesters"
  on public.sessions
  for select
  using (
    created_by = auth.uid()
    or public.is_session_member(sessions.id, auth.uid())
    or public.is_session_requester(sessions.id, auth.uid())
  );