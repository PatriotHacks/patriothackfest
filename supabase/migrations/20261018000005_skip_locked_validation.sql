create or replace function public.save_application_answers(p_application_id uuid, p_answers jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications;
  v_form public.forms;
  v_locked jsonb;
  v_errors jsonb;
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
    p_answers := public.prune_application_answers(v_form.published_schema, p_answers);
    v_locked := public.locked_answer_errors(v_form.published_schema, v_application.answers, p_answers);
    if v_locked <> '{}' then
      raise exception 'Some answers can no longer be changed' using errcode = 'PT403', detail = v_locked::text;
    end if;
    v_errors := public.application_answer_errors(p_application_id, v_form.published_schema, p_answers)
      - public.form_locked_field_ids(v_form.published_schema);
    if v_errors <> '{}' then
      raise exception 'Invalid answers' using errcode = 'PT422', detail = v_errors::text;
    end if;
  end if;

  update public.applications
  set answers = p_answers
  where id = p_application_id
  returning updated_at into v_updated_at;

  return v_updated_at;
end;
$$;
