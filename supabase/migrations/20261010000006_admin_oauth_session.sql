create or replace function public.current_admin_level()
returns public.admin_level
language sql
stable
security definer
set search_path = ''
as $$
  select a.level
  from public.admin_allowlist a
  where a.email operator(extensions.=) lower(auth.jwt() ->> 'email')::extensions.citext
    and auth.jwt() -> 'amr' @> '[{"method": "oauth"}]'::jsonb
$$;
