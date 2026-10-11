create function public.admin_reorder_form_fields(p_form_id uuid, p_field_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  if cardinality(p_field_ids) <> (select count(distinct id) from unnest(p_field_ids) id)
    or (
      select coalesce(array_agg(f.id order by f.id), '{}')
      from public.form_fields f
      where f.form_id = p_form_id and f.archived_at is null
    ) <> (select coalesce(array_agg(id order by id), '{}') from unnest(p_field_ids) id) then
    raise exception 'Field order must list every question of the form exactly once';
  end if;

  update public.form_fields f
  set position = o.ordinality
  from unnest(p_field_ids) with ordinality o (id, ordinality)
  where f.id = o.id and f.position <> o.ordinality;
end;
$$;

create function public.form_answered_field_ids(p_form_id uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select f.id
  from public.form_fields f
  where f.form_id = p_form_id
    and exists (
      select 1
      from public.applications a
      where a.form_id = p_form_id
        and a.answers ? f.id::text
    )
$$;

revoke execute on function
  public.admin_reorder_form_fields(uuid, uuid[]),
  public.form_answered_field_ids(uuid)
from public, anon;

grant execute on function
  public.admin_reorder_form_fields(uuid, uuid[]),
  public.form_answered_field_ids(uuid)
to authenticated;
