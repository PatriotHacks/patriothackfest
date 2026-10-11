alter table public.forms
  add column published_schema jsonb,
  add column content_updated_at timestamptz not null default now();

create function public.bump_form_content_on_form_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.title is distinct from old.title or new.description is distinct from old.description then
    new.content_updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create trigger forms_bump_content
before update on public.forms
for each row execute function public.bump_form_content_on_form_update();

create function public.bump_form_content_on_field_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.forms
  set content_updated_at = clock_timestamp()
  where id = coalesce(new.form_id, old.form_id);
  return null;
end;
$$;

create trigger form_fields_bump_form_content
after insert or update or delete on public.form_fields
for each row execute function public.bump_form_content_on_field_change();

revoke insert, update on public.forms from authenticated;
grant insert (event_id, role, title, description) on public.forms to authenticated;
grant update (title, description, submissions_close_at, edits_lock_at) on public.forms to authenticated;

drop policy "Fields of readable forms are readable" on public.form_fields;

create policy "Reviewers read fields"
on public.form_fields for select
to authenticated
using ((select public.has_admin_level('reviewer')));

create function public.admin_publish_form(p_form_id uuid)
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
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  select * into v_form from public.forms where id = p_form_id for update;

  if not found then
    raise exception 'Form not found';
  end if;

  if btrim(v_form.title) = '' then
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

    if btrim(v_field.label) = '' then
      v_errors := array_append(v_errors, format('Question %s needs a label', v_count));
    end if;

    if v_field.type in ('single_choice', 'multiple_choice') then
      if jsonb_typeof(v_field.options) is distinct from 'array' or jsonb_array_length(v_field.options) = 0 then
        v_errors := array_append(v_errors, format('Question %s needs at least one option', v_count));
      elsif exists (
        select 1
        from jsonb_array_elements(v_field.options) o
        where jsonb_typeof(o) <> 'string' or btrim(o #>> '{}') = ''
      ) or (
        select count(distinct o) <> count(*)
        from jsonb_array_elements(v_field.options) o
      ) then
        v_errors := array_append(v_errors, format('Question %s has blank or duplicate options', v_count));
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
          format('Question %s must depend on an earlier choice or checkbox question', v_count)
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
        v_errors := array_append(v_errors, format('Question %s has an invalid condition', v_count));
      end if;
    end if;
  end loop;

  if v_count = 0 then
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

revoke execute on function public.admin_publish_form(uuid) from public, anon;
grant execute on function public.admin_publish_form(uuid) to authenticated;
