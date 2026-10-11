drop function public.save_application_answers(uuid, jsonb);

create function public.save_application_answers(p_application_id uuid, p_answers jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
  v_form public.forms;
  v_updated_at timestamptz;
begin
  if octet_length(p_answers::text) > 262144 then
    raise exception 'Answers are too large' using errcode = 'PT413';
  end if;

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

  if v_application.status = 'submitted' then
    p_answers := public.validated_application_answers(p_application_id, v_form.published_schema, p_answers);
  end if;

  update public.applications
  set answers = p_answers
  where id = p_application_id
  returning updated_at into v_updated_at;

  return v_updated_at;
end;
$$;

revoke execute on function public.save_application_answers(uuid, jsonb) from public, anon;
grant execute on function public.save_application_answers(uuid, jsonb) to authenticated;
