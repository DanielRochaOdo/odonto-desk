-- Safe lookup for session by code without exposing full sessions listing

create or replace function public.get_session_by_code(p_code text)
returns table(id uuid, status text, expires_at timestamptz, created_by uuid)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select s.id, s.status, s.expires_at, s.created_by
  from public.sessions s
  where s.code = p_code
    and s.status = 'pending'
    and s.expires_at > now();
$$;

grant execute on function public.get_session_by_code(text) to authenticated;