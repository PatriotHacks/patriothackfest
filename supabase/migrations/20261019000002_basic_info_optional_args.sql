drop function public.update_basic_info(text, text, text, date);
drop function public.event_is_over(public.events);

create function public.event_has_ended(p_starts_at timestamptz, p_ends_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_ends_at, p_starts_at) is not null
    and now() >= (
      ((coalesce(p_ends_at, p_starts_at) at time zone 'America/New_York')::date + 1)::timestamp
      at time zone 'America/New_York'
    )
$$;

create function public.update_basic_info(
  p_full_name text,
  p_school text default null,
  p_phone text default null,
  p_date_of_birth date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.applications
    where user_id = auth.uid() and status = 'draft'
  ) then
    raise exception 'Basic information can only be changed while you have a draft application' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.applications a
    join public.events e on e.id = a.event_id
    where a.user_id = auth.uid()
      and a.status = 'submitted'
      and not public.event_has_ended(e.starts_at, e.ends_at)
  ) then
    raise exception 'Basic information is locked after you submit an application' using errcode = '42501';
  end if;

  if coalesce(btrim(p_full_name), '') = '' then
    raise exception 'Enter your name' using errcode = '22023';
  end if;

  if char_length(btrim(p_full_name)) > 100 then
    raise exception 'Use 100 characters or fewer for your name' using errcode = '22023';
  end if;

  if p_date_of_birth >= (now() at time zone 'America/New_York')::date then
    raise exception 'Enter a date of birth in the past' using errcode = '22023';
  end if;

  update public.profiles
  set full_name = btrim(p_full_name),
      school = nullif(btrim(p_school), ''),
      phone = p_phone,
      date_of_birth = p_date_of_birth
  where id = auth.uid();
end;
$$;

revoke execute on function
  public.event_has_ended(timestamptz, timestamptz),
  public.update_basic_info(text, text, text, date)
from public, anon, authenticated;

grant execute on function public.update_basic_info(text, text, text, date) to authenticated;
