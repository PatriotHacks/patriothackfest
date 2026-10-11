create function public.ensure_owner_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from old_rows where level = 'owner')
    and not exists (select 1 from public.admin_allowlist where level = 'owner') then
    raise exception 'At least one owner is required';
  end if;
  return null;
end;
$$;

create trigger admin_allowlist_keep_owner_on_update
after update on public.admin_allowlist
referencing old table as old_rows
for each statement execute function public.ensure_owner_remains();

create trigger admin_allowlist_keep_owner_on_delete
after delete on public.admin_allowlist
referencing old table as old_rows
for each statement execute function public.ensure_owner_remains();
