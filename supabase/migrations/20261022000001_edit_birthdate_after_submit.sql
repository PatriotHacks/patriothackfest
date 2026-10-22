create or replace function public.update_basic_info(
  p_full_name text,
  p_school text default null,
  p_phone text default null,
  p_date_of_birth date default null,
  p_keep_phone boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_has_draft boolean;
  v_has_open_submission boolean;
  v_has_locked_submission boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select
    coalesce(bool_or(a.status = 'draft'), false),
    coalesce(bool_or(a.status = 'submitted' and (now() < f.edits_lock_at) is not false), false),
    coalesce(bool_or(a.status = 'submitted' and (now() < f.edits_lock_at) is false), false)
  into v_has_draft, v_has_open_submission, v_has_locked_submission
  from public.applications a
  join public.events e on e.id = a.event_id
  join public.forms f on f.id = a.form_id
  where a.user_id = auth.uid()
    and (a.status = 'draft' or not public.event_has_ended(e.starts_at, e.ends_at));

  if not v_has_draft and not v_has_open_submission then
    raise exception 'Basic information can only be changed while you have a draft application' using errcode = '42501';
  end if;

  if v_has_locked_submission then
    raise exception 'Basic information is locked after you submit an application' using errcode = '42501';
  end if;

  if v_has_open_submission then
    select * into v_profile from public.profiles where id = auth.uid();

    if btrim(p_full_name) is distinct from v_profile.full_name
      or nullif(btrim(p_school), '') is distinct from v_profile.school
      or (not p_keep_phone and p_phone is distinct from v_profile.phone)
    then
      raise exception 'Basic information is locked after you submit an application' using errcode = '42501';
    end if;

    if p_date_of_birth is null then
      raise exception 'Enter your date of birth' using errcode = '22023';
    end if;
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
      phone = case when p_keep_phone then phone else p_phone end,
      date_of_birth = p_date_of_birth
  where id = auth.uid();
end;
$$;
