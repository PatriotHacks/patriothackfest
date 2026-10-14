create function public.form_locked_field_ids(p_schema jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_field jsonb;
  v_editable boolean := false;
  v_locked text[] := '{}';
begin
  for v_field in
    select f
    from jsonb_array_elements(p_schema -> 'fields') with ordinality as e (f, n)
    order by n
  loop
    if v_field ->> 'type' = 'section' then
      v_editable := v_field -> 'editable_after_submit' = 'true'::jsonb;
    elsif not v_editable then
      v_locked := array_append(v_locked, v_field ->> 'id');
    end if;
  end loop;

  return v_locked;
end;
$$;

create or replace function public.prune_application_answers(p_schema jsonb, p_answers jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(f ->> 'id', p_answers -> (f ->> 'id')), '{}')
  from jsonb_array_elements(p_schema -> 'fields') f
  where f ->> 'type' <> 'section'
    and p_answers ? (f ->> 'id')
    and public.form_field_visible(p_schema, f ->> 'id', p_answers)
$$;

create or replace function public.application_answer_errors(p_application_id uuid, p_schema jsonb, p_answers jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_field jsonb;
  v_id text;
  v_rules jsonb;
  v_value jsonb;
  v_kind text;
  v_text text;
  v_number numeric;
  v_limit jsonb;
  v_error text;
  v_errors jsonb := '{}';
begin
  select user_id into v_user_id from public.applications where id = p_application_id;

  for v_field in select f from jsonb_array_elements(p_schema -> 'fields') f
  loop
    v_id := v_field ->> 'id';
    continue when v_field ->> 'type' = 'section';
    continue when not public.form_field_visible(p_schema, v_id, p_answers);

    v_rules := v_field -> 'validation';
    v_value := p_answers -> v_id;
    v_kind := jsonb_typeof(v_value);
    v_text := case when v_kind = 'string' then v_value #>> '{}' end;
    v_error := null;

    if v_kind is null
      or v_kind = 'null'
      or (v_kind = 'string' and public.js_trim(v_text) = '')
      or (v_kind = 'array' and jsonb_array_length(v_value) = 0)
      or (v_field ->> 'type' = 'checkbox' and v_value = 'false'::jsonb) then
      if v_field -> 'required' = 'true'::jsonb then
        v_errors := v_errors || jsonb_build_object(v_id, 'Required');
      end if;
      continue;
    end if;

    case v_field ->> 'type'
      when 'short_text', 'long_text' then
        if v_kind <> 'string' then
          v_error := 'Enter text';
        elsif char_length(public.js_trim(v_text)) < (v_rules ->> 'min_length')::integer then
          v_error := format('Enter at least %s characters', v_rules -> 'min_length');
        elsif char_length(public.js_trim(v_text)) > (v_rules ->> 'max_length')::integer then
          v_error := format('Enter at most %s characters', v_rules -> 'max_length');
        end if;
      when 'email' then
        if v_kind <> 'string'
          or v_text !~ '^(?:[A-Za-z0-9_''+-]+\.)*[A-Za-z0-9_''+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$' then
          v_error := 'Enter a valid email address';
        end if;
      when 'url' then
        if v_kind <> 'string' or v_text !~* '^https?://[^\s/?#]+(?:[/?#]\S*)?$' then
          v_error := 'Enter a valid URL starting with http:// or https://';
        end if;
      when 'number' then
        if v_kind <> 'number' then
          v_error := 'Enter a number';
        else
          v_number := v_value::numeric;
          if v_rules -> 'integer' = 'true'::jsonb and v_number <> trunc(v_number) then
            v_error := 'Enter a whole number';
          elsif v_number < (v_rules ->> 'min')::numeric then
            v_error := format('Enter %s or more', v_rules -> 'min');
          elsif v_number > (v_rules ->> 'max')::numeric then
            v_error := format('Enter %s or less', v_rules -> 'max');
          end if;
        end if;
      when 'date' then
        if v_kind <> 'string'
          or v_text !~ '^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))$' then
          v_error := 'Enter a valid date';
        elsif v_text collate "C" < v_rules ->> 'min' then
          v_error := format('Enter %s or later', v_rules ->> 'min');
        elsif v_text collate "C" > v_rules ->> 'max' then
          v_error := format('Enter %s or earlier', v_rules ->> 'max');
        end if;
      when 'single_choice' then
        if v_kind <> 'string' or not (v_field -> 'options') @> jsonb_build_array(v_value) then
          v_error := 'Choose one of the options';
        end if;
      when 'multiple_choice' then
        if v_kind <> 'array'
          or exists (
            select 1
            from jsonb_array_elements(v_value) e
            where jsonb_typeof(e) <> 'string' or not (v_field -> 'options') @> jsonb_build_array(e)
          )
          or (select count(distinct e) <> count(*) from jsonb_array_elements(v_value) e) then
          v_error := 'Choose from the options';
        end if;
      when 'checkbox' then
        if v_kind <> 'boolean' then
          v_error := 'Invalid value';
        end if;
      when 'file' then
        v_limit := coalesce(v_rules -> 'max_size_mb', '10');
        if v_kind <> 'object'
          or jsonb_typeof(v_value -> 'path') is distinct from 'string' or v_value ->> 'path' = ''
          or jsonb_typeof(v_value -> 'name') is distinct from 'string' or v_value ->> 'name' = ''
          or jsonb_typeof(v_value -> 'size') is distinct from 'number'
          or (v_value ->> 'size')::numeric < 0
          or (v_value ->> 'size')::numeric <> trunc((v_value ->> 'size')::numeric)
          or jsonb_typeof(v_value -> 'type') is distinct from 'string' then
          v_error := 'Upload a file';
        elsif not coalesce(v_rules -> 'accept', '["application/pdf"]') @> jsonb_build_array(v_value -> 'type') then
          v_error := 'This file type is not allowed';
        elsif (v_value ->> 'size')::numeric > (v_limit #>> '{}')::numeric * 1024 * 1024 then
          v_error := format('Files must be %s MB or smaller', v_limit);
        elsif not starts_with(v_value ->> 'path', format('%s/%s/%s/', v_user_id, p_application_id, v_id))
          or not exists (
            select 1
            from storage.objects o
            where o.bucket_id = 'application-files' and o.name = v_value ->> 'path'
          ) then
          v_error := 'Upload the file again';
        end if;
      else
        v_error := 'Invalid value';
    end case;

    if v_error is not null then
      v_errors := v_errors || jsonb_build_object(v_id, v_error);
    end if;
  end loop;

  return v_errors;
end;
$$;

create function public.locked_answer_errors(p_schema jsonb, p_before jsonb, p_after jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(id, 'This answer can no longer be changed'), '{}')
  from unnest(public.form_locked_field_ids(p_schema)) id
  where p_before -> id is distinct from p_after -> id
$$;

revoke execute on function
  public.form_locked_field_ids(jsonb),
  public.locked_answer_errors(jsonb, jsonb, jsonb)
from public, anon, authenticated;

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
    v_locked := public.locked_answer_errors(
      v_form.published_schema,
      v_application.answers,
      public.prune_application_answers(v_form.published_schema, p_answers)
    );
    if v_locked <> '{}' then
      raise exception 'Some answers can no longer be changed' using errcode = 'PT403', detail = v_locked::text;
    end if;
    p_answers := public.validated_application_answers(p_application_id, v_form.published_schema, p_answers);
  end if;

  update public.applications
  set answers = p_answers
  where id = p_application_id
  returning updated_at into v_updated_at;

  return v_updated_at;
end;
$$;

create or replace function public.application_file_writable(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from regexp_match(
      p_name,
      '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    ) as m (parts)
    join public.applications a on a.id::text = m.parts[2]
    join public.forms f on f.id = a.form_id
    where m.parts[1] = auth.uid()::text
      and a.user_id = auth.uid()
      and jsonb_path_exists(
        f.published_schema,
        '$.fields[*] ? (@.id == $id && @.type == "file")',
        jsonb_build_object('id', m.parts[3])
      )
      and (
        (a.status = 'draft' and now() < f.submissions_close_at)
        or (
          a.status = 'submitted'
          and now() < f.edits_lock_at
          and not m.parts[3] = any (public.form_locked_field_ids(f.published_schema))
        )
      )
  )
$$;
