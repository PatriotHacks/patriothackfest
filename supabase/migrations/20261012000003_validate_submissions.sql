create function public.validated_application_answers(p_application_id uuid, p_schema jsonb, p_answers jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_answers jsonb := public.prune_application_answers(p_schema, p_answers);
  v_errors jsonb := public.application_answer_errors(p_application_id, p_schema, v_answers);
begin
  if v_errors <> '{}' then
    raise exception 'Invalid answers' using errcode = 'PT422', detail = v_errors::text;
  end if;
  return v_answers;
end;
$$;

revoke execute on function public.validated_application_answers(uuid, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.save_application_answers(p_application_id uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
  v_form public.forms;
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
  where id = p_application_id;
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

  update public.applications
  set answers = public.validated_application_answers(p_application_id, v_form.published_schema, v_application.answers),
      status = 'submitted',
      submitted_at = now()
  where id = p_application_id;
end;
$$;
