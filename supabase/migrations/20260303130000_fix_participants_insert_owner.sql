-- Allow session owner to add the requester as participant after accept

create or replace function public.can_owner_add_participant(target_session_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.sessions s
    where s.id = target_session_id
      and s.created_by = auth.uid()
  )
  and exists (
    select 1
    from public.session_requests sr
    where sr.session_id = target_session_id
      and sr.requester_user_id = target_user_id
      and sr.status = 'accepted'
  );
$$;

grant execute on function public.can_owner_add_participant(uuid, uuid) to authenticated;

create policy "participants_insert_owner_for_requester"
  on public.session_participants
  for insert
  with check (
    role = 'agent'
    and public.can_owner_add_participant(session_participants.session_id, session_participants.user_id)
  );