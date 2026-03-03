-- Fix RLS recursion on session_participants

create or replace function public.is_session_member(target_session_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.session_participants sp
    where sp.session_id = target_session_id
      and sp.user_id = target_user_id
  );
$$;

grant execute on function public.is_session_member(uuid, uuid) to anon, authenticated;

drop policy if exists "participants_select_session_members" on public.session_participants;

create policy "participants_select_session_members"
  on public.session_participants
  for select
  using (public.is_session_member(session_participants.session_id, auth.uid()));