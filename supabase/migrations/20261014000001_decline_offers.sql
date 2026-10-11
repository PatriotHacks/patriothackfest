alter table public.applications
  add column declined_at timestamptz,
  add constraint applications_declined_submitted check (declined_at is null or status = 'submitted');

create function public.prevent_declined_decision_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.applications a
    where a.id = new.application_id
      and a.declined_at is not null
    for share
  ) then
    raise exception 'The applicant declined; this decision is final';
  end if;
  return new;
end;
$$;

create trigger application_decisions_prevent_declined_changes
before insert or update on public.application_decisions
for each row execute function public.prevent_declined_decision_changes();

create function public.decline_application_offer(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
begin
  select * into v_application
  from public.applications
  where id = p_application_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_application.declined_at is not null then
    raise exception 'Application is already declined';
  end if;

  if v_application.status <> 'submitted' then
    raise exception 'Only submitted applications can be declined';
  end if;

  if not public.form_decisions_released(p_application_id) then
    raise exception 'Decisions have not been released yet';
  end if;

  if not exists (
    select 1
    from public.application_decisions d
    where d.application_id = p_application_id
      and d.decision in ('accepted', 'waitlisted')
  ) then
    raise exception 'Only accepted or waitlisted applications can be declined';
  end if;

  update public.applications
  set declined_at = now()
  where id = p_application_id;
end;
$$;

create or replace function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
begin
  select * into v_application
  from public.applications
  where id = p_application_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_application.status = 'withdrawn' then
    raise exception 'Application is already withdrawn';
  end if;

  if v_application.declined_at is not null then
    raise exception 'Application is already declined';
  end if;

  if public.form_decisions_released(p_application_id) then
    raise exception 'Applications cannot be withdrawn after decisions are released';
  end if;

  update public.applications
  set status = 'withdrawn', withdrawn_at = now()
  where id = p_application_id;
end;
$$;

create or replace function public.admin_change_application_role(p_application_id uuid, p_new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
  v_target_form_id uuid;
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

  if v_application.status = 'withdrawn' then
    raise exception 'Withdrawn applications cannot change role';
  end if;

  if v_application.declined_at is not null then
    raise exception 'Declined applications cannot change role';
  end if;

  if v_application.role = p_new_role then
    raise exception 'Application already has this role';
  end if;

  select id into v_target_form_id
  from public.forms
  where event_id = v_application.event_id and role = p_new_role;

  if not found then
    raise exception 'No form exists for this role in this event';
  end if;

  insert into public.application_archives (application_id, user_id, event_id, from_role, to_role, answers, changed_by)
  values (
    v_application.id,
    v_application.user_id,
    v_application.event_id,
    v_application.role,
    p_new_role,
    v_application.answers,
    auth.uid()
  );

  delete from public.application_decisions where application_id = p_application_id;

  update public.applications
  set role = p_new_role,
      form_id = v_target_form_id,
      answers = '{}',
      status = 'draft',
      submitted_at = null
  where id = p_application_id;
end;
$$;

revoke execute on function public.prevent_declined_decision_changes() from public, anon, authenticated;
revoke execute on function public.decline_application_offer(uuid) from public, anon;
grant execute on function public.decline_application_offer(uuid) to authenticated;
