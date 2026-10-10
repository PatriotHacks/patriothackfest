create function public.start_application(p_form_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form public.forms;
  v_application_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_form from public.forms where id = p_form_id;

  if not found or v_form.status <> 'published' then
    raise exception 'Form is not open for applications';
  end if;

  if now() >= v_form.submissions_close_at then
    raise exception 'Submissions are closed';
  end if;

  insert into public.applications (user_id, event_id, role, form_id)
  values (auth.uid(), v_form.event_id, v_form.role, v_form.id)
  returning id into v_application_id;

  return v_application_id;
end;
$$;

create function public.save_application_answers(p_application_id uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
  v_form public.forms;
begin
  select * into v_application
  from public.applications
  where id = p_application_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  select * into v_form from public.forms where id = v_application.form_id;

  if not (
    (v_application.status = 'draft' and now() < v_form.submissions_close_at)
    or (v_application.status = 'submitted' and now() < v_form.edits_lock_at)
  ) then
    raise exception 'Application can no longer be edited';
  end if;

  update public.applications
  set answers = p_answers
  where id = p_application_id;
end;
$$;

create function public.submit_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
  v_form public.forms;
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

  update public.applications
  set status = 'submitted', submitted_at = now()
  where id = p_application_id;
end;
$$;

create function public.withdraw_application(p_application_id uuid)
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

  update public.applications
  set status = 'withdrawn', withdrawn_at = now()
  where id = p_application_id;
end;
$$;

create function public.admin_change_application_role(p_application_id uuid, p_new_role public.app_role)
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

create function public.admin_release_decisions(p_form_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  update public.forms
  set decisions_released_at = now()
  where id = p_form_id and decisions_released_at is null;

  if not found then
    raise exception 'Form not found or decisions already released';
  end if;
end;
$$;

revoke execute on function
  public.start_application(uuid),
  public.save_application_answers(uuid, jsonb),
  public.submit_application(uuid),
  public.withdraw_application(uuid),
  public.admin_change_application_role(uuid, public.app_role),
  public.admin_release_decisions(uuid)
from public, anon;

grant execute on function
  public.start_application(uuid),
  public.save_application_answers(uuid, jsonb),
  public.submit_application(uuid),
  public.withdraw_application(uuid),
  public.admin_change_application_role(uuid, public.app_role),
  public.admin_release_decisions(uuid)
to authenticated;
