alter table public.profiles
  add column school text check (school is null or (btrim(school) <> '' and char_length(school) <= 200)),
  add column phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  add column date_of_birth date check (date_of_birth is null or date_of_birth >= date '1900-01-01');

drop policy "Users update own profile" on public.profiles;

create policy "Users set own name once"
on public.profiles for update
to authenticated
using (id = (select auth.uid()) and coalesce(btrim(full_name), '') = '')
with check (id = (select auth.uid()));

create function public.event_is_over(p_event public.events)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_event.ends_at, p_event.starts_at) is not null
    and now() >= (
      ((coalesce(p_event.ends_at, p_event.starts_at) at time zone 'America/New_York')::date + 1)::timestamp
      at time zone 'America/New_York'
    )
$$;

create function public.update_basic_info(
  p_full_name text,
  p_school text,
  p_phone text,
  p_date_of_birth date
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
      and not public.event_is_over(e)
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

create or replace function public.submit_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
  v_form public.forms;
  v_profile public.profiles;
  v_missing jsonb;
begin
  select * into v_application
  from public.applications
  where id = p_application_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_application.status <> 'draft' then
    raise exception 'Only draft applications can be submitted';
  end if;

  select * into v_form from public.forms where id = v_application.form_id;

  if now() >= v_form.submissions_close_at then
    raise exception 'Submissions are closed';
  end if;

  if v_form.published_schema is null then
    raise exception 'Form is not open for applications';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  v_missing := jsonb_strip_nulls(jsonb_build_object(
    'full_name', case when coalesce(btrim(v_profile.full_name), '') = '' then 'Required' end,
    'school', case when v_profile.school is null then 'Required' end,
    'phone', case when v_profile.phone is null then 'Required' end,
    'date_of_birth', case when v_profile.date_of_birth is null then 'Required' end
  ));

  if v_missing <> '{}' then
    raise exception 'Basic information is incomplete' using errcode = 'PT422', detail = v_missing::text;
  end if;

  update public.applications
  set answers = public.validated_application_answers(p_application_id, v_form.published_schema, v_application.answers),
      status = 'submitted',
      submitted_at = now()
  where id = p_application_id;
end;
$$;

create function public.under_18(p_application public.applications)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p.date_of_birth is not null
    and p.school is distinct from 'George Mason University'
    and (p.date_of_birth + interval '18 years')::date > coalesce(
      (e.starts_at at time zone 'America/New_York')::date,
      (now() at time zone 'America/New_York')::date
    )
  from public.profiles p
  cross join public.events e
  where p.id = p_application.user_id
    and e.id = p_application.event_id
$$;

revoke execute on function
  public.event_is_over(public.events),
  public.update_basic_info(text, text, text, date),
  public.under_18(public.applications)
from public, anon, authenticated;

grant execute on function
  public.update_basic_info(text, text, text, date),
  public.under_18(public.applications)
to authenticated;
