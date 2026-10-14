create or replace function public.admin_publish_form(p_form_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form public.forms;
  v_field record;
  v_source public.form_fields;
  v_errors text[] := '{}';
  v_count integer := 0;
  v_questions integer := 0;
  v_sections integer := 0;
  v_first_type public.field_type;
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  select * into v_form from public.forms where id = p_form_id for update;

  if not found then
    raise exception 'Form not found';
  end if;

  if public.js_trim(v_form.title) = '' then
    v_errors := array_append(v_errors, 'Add a form title');
  end if;

  if v_form.submissions_close_at is null or v_form.edits_lock_at is null then
    v_errors := array_append(v_errors, 'Set both deadlines before publishing');
  elsif v_form.edits_lock_at < v_form.submissions_close_at then
    v_errors := array_append(v_errors, 'Edits lock must be at or after submissions close');
  end if;

  for v_field in
    select f.*
    from public.form_fields f
    where f.form_id = p_form_id and f.archived_at is null
    order by f.position, f.created_at, f.id
  loop
    v_count := v_count + 1;

    if v_count = 1 then
      v_first_type := v_field.type;
    end if;

    if v_field.type = 'section' then
      v_sections := v_sections + 1;
      if public.js_trim(v_field.label) = '' then
        v_errors := array_append(v_errors, format('Section %s needs a title', v_sections));
      end if;
      continue;
    end if;

    v_questions := v_questions + 1;

    if public.js_trim(v_field.label) = '' then
      v_errors := array_append(v_errors, format('Question %s needs a label', v_questions));
    end if;

    if v_field.type in ('single_choice', 'multiple_choice') then
      if jsonb_typeof(v_field.options) is distinct from 'array' or jsonb_array_length(v_field.options) = 0 then
        v_errors := array_append(v_errors, format('Question %s needs at least one option', v_questions));
      elsif exists (
        select 1
        from jsonb_array_elements(v_field.options) o
        where jsonb_typeof(o) <> 'string' or public.js_trim(o #>> '{}') = ''
      ) or (
        select count(distinct o) <> count(*)
        from jsonb_array_elements(v_field.options) o
      ) then
        v_errors := array_append(v_errors, format('Question %s has blank or duplicate options', v_questions));
      end if;
    end if;

    if v_field.condition is not null then
      select s.* into v_source
      from public.form_fields s
      where s.id::text = v_field.condition ->> 'field_id'
        and s.form_id = p_form_id
        and s.archived_at is null
        and s.type in ('single_choice', 'multiple_choice', 'checkbox')
        and (s.position, s.created_at, s.id) < (v_field.position, v_field.created_at, v_field.id);

      if not found then
        v_errors := array_append(
          v_errors,
          format('Question %s must depend on an earlier choice or checkbox question', v_questions)
        );
      elsif not coalesce(
        case v_source.type
          when 'single_choice' then
            v_field.condition ->> 'operator' = 'equals'
            and jsonb_typeof(v_field.condition -> 'value') = 'string'
            and v_source.options @> jsonb_build_array(v_field.condition -> 'value')
          when 'multiple_choice' then
            v_field.condition ->> 'operator' = 'includes'
            and jsonb_typeof(v_field.condition -> 'value') = 'string'
            and v_source.options @> jsonb_build_array(v_field.condition -> 'value')
          else
            v_field.condition ->> 'operator' = 'equals'
            and jsonb_typeof(v_field.condition -> 'value') = 'boolean'
        end,
        false
      ) then
        v_errors := array_append(v_errors, format('Question %s has an invalid condition', v_questions));
      end if;
    end if;
  end loop;

  if v_count > 0 and v_first_type <> 'section' then
    v_errors := array_append(v_errors, 'Start the form with a section');
  end if;

  if v_questions = 0 then
    v_errors := array_append(v_errors, 'Add at least one question');
  end if;

  if cardinality(v_errors) > 0 then
    raise exception '%', array_to_string(v_errors, E'\n');
  end if;

  update public.forms
  set published_schema = jsonb_build_object(
        'title', v_form.title,
        'description', v_form.description,
        'fields', (
          select jsonb_agg(
            jsonb_build_object(
              'id', f.id,
              'type', f.type,
              'label', f.label,
              'help_text', f.help_text,
              'required', f.required,
              'options', f.options,
              'validation', f.validation,
              'condition', f.condition
            )
            || case
              when f.type = 'section' then jsonb_build_object('editable_after_submit', f.editable_after_submit)
              else '{}'::jsonb
            end
            order by f.position, f.created_at, f.id
          )
          from public.form_fields f
          where f.form_id = p_form_id and f.archived_at is null
        )
      ),
      status = 'published',
      published_at = clock_timestamp()
  where id = p_form_id;
end;
$$;
