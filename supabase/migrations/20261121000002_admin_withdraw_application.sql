create function public.admin_withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  select * into v_application
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_application.status <> 'submitted' then
    raise exception 'Only submitted applications can be withdrawn';
  end if;

  if v_application.declined_at is not null then
    raise exception 'Declined applications cannot be withdrawn';
  end if;

  update public.applications
  set status = 'withdrawn', withdrawn_at = now()
  where id = p_application_id;
end;
$$;

create function public.admin_restore_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  select * into v_application
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_application.status <> 'withdrawn' then
    raise exception 'Only withdrawn applications can be restored';
  end if;

  if v_application.submitted_at is null then
    raise exception 'This application was withdrawn before it was submitted';
  end if;

  if v_application.role = 'participant' then
    perform 1 from public.event_competition_settings
    where event_id = v_application.event_id
    for update;

    if exists (
      select 1
      from public.event_judges j
      join auth.users u on u.id = v_application.user_id
      where j.event_id = v_application.event_id
        and j.active
        and (j.user_id = u.id or (u.email_confirmed_at is not null and lower(btrim(u.email)) = lower(j.email::text)))
    ) then
      raise exception 'This applicant is an active judge for this event. Deactivate them as a judge before restoring.';
    end if;
  end if;

  update public.applications
  set status = 'submitted', withdrawn_at = null
  where id = p_application_id;
end;
$$;

revoke all on function public.admin_withdraw_application(uuid) from public, anon, authenticated;
grant execute on function public.admin_withdraw_application(uuid) to authenticated;
revoke all on function public.admin_restore_application(uuid) from public, anon, authenticated;
grant execute on function public.admin_restore_application(uuid) to authenticated;
