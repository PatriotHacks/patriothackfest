create function public.status_rank(p_application public.applications)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case p_application.status
    when 'submitted' then 0
    when 'draft' then 1
    else 2
  end::smallint
$$;

revoke execute on function public.status_rank(public.applications) from public, anon, authenticated;
grant execute on function public.status_rank(public.applications) to authenticated;
