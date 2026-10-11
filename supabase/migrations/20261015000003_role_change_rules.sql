alter table public.application_archives
  add column from_form_id uuid not null references public.forms (id),
  add column schema jsonb not null;

create or replace function public.admin_change_application_role(p_application_id uuid, p_new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
  v_target public.forms;
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

  select * into v_target
  from public.forms
  where event_id = v_application.event_id and role = p_new_role
  for share;

  if not found then
    raise exception 'No form exists for this role in this event';
  end if;

  if v_target.status <> 'published' or v_target.published_schema is null then
    raise exception 'The form for this role is not published';
  end if;

  if now() >= v_target.submissions_close_at then
    raise exception 'The form for this role is closed';
  end if;

  insert into public.application_archives (
    application_id, user_id, event_id, from_role, to_role, from_form_id, schema, answers, changed_by
  )
  select
    v_application.id,
    v_application.user_id,
    v_application.event_id,
    v_application.role,
    p_new_role,
    f.id,
    f.published_schema,
    v_application.answers,
    auth.uid()
  from public.forms f
  where f.id = v_application.form_id;

  delete from public.application_decisions where application_id = p_application_id;

  update public.applications
  set role = p_new_role,
      form_id = v_target.id,
      answers = '{}',
      status = 'draft',
      submitted_at = null
  where id = p_application_id;
end;
$$;
