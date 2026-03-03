-- Allow session_requests insert without RLS recursion

create or replace function public.can_request_join(target_session_id uuid, target_user_id uuid)
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
      and s.status = 'pending'
      and s.expires_at > now()
      and s.created_by <> target_user_id
  );
$$;

grant execute on function public.can_request_join(uuid, uuid) to authenticated;

drop policy if exists "requests_insert_pending" on public.session_requests;

create policy "requests_insert_pending"
  on public.session_requests
  for insert
  with check (
    requester_user_id = auth.uid()
    and public.can_request_join(session_requests.session_id, auth.uid())
  );