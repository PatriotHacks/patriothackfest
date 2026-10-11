create or replace function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
  v_released boolean;
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

  select decisions_released_at is not null into v_released
  from public.forms
  where id = v_application.form_id
  for share;

  if v_released and exists (
    select 1
    from public.application_decisions d
    where d.application_id = p_application_id and d.decision <> 'pending'
  ) then
    raise exception 'Applications cannot be withdrawn after the decision is released';
  end if;

  update public.applications
  set status = 'withdrawn', withdrawn_at = now()
  where id = p_application_id;
end;
$$;
