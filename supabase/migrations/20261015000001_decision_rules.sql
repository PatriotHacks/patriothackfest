create function public.enforce_decision_rules()
returns trigger
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
  where id = new.application_id
  for share;

  if v_application.status <> 'submitted' then
    raise exception 'Decisions can only be set on submitted applications';
  end if;

  select * into v_form
  from public.forms
  where id = v_application.form_id
  for share;

  if v_form.decisions_released_at is not null and not public.has_admin_level('organizer') then
    raise exception 'Decisions are released; only organizers can change them' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger application_decisions_enforce_rules
before insert or update on public.application_decisions
for each row execute function public.enforce_decision_rules();

revoke execute on function public.enforce_decision_rules() from public, anon, authenticated;
