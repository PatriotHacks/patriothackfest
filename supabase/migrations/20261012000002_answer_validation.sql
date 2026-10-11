create function public.form_field_visible(
  p_schema jsonb,
  p_field_id text,
  p_answers jsonb,
  p_seen text[] default '{}'
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_condition jsonb;
  v_source jsonb;
  v_value jsonb;
begin
  select f -> 'condition' into v_condition
  from jsonb_array_elements(p_schema -> 'fields') f
  where f ->> 'id' = p_field_id
  limit 1;

  if v_condition is null or jsonb_typeof(v_condition) = 'null' then
    return true;
  end if;

  if p_field_id = any (p_seen) then
    return false;
  end if;

  select f into v_source
  from jsonb_array_elements(p_schema -> 'fields') f
  where f ->> 'id' = v_condition ->> 'field_id'
  limit 1;

  if v_source is null
    or not public.form_field_visible(p_schema, v_source ->> 'id', p_answers, p_seen || p_field_id) then
    return false;
  end if;

  v_value := p_answers -> (v_source ->> 'id');

  if v_condition ->> 'operator' = 'includes' then
    return jsonb_typeof(v_value) = 'array'
      and exists (select 1 from jsonb_array_elements(v_value) e where e = v_condition -> 'value');
  end if;

  if v_source ->> 'type' = 'checkbox' then
    return (v_value is not distinct from 'true'::jsonb) = (v_condition -> 'value' = 'true'::jsonb);
  end if;

  return coalesce(v_value = v_condition -> 'value', false);
end;
$$;

create function public.prune_application_answers(p_schema jsonb, p_answers jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(f ->> 'id', p_answers -> (f ->> 'id')), '{}')
  from jsonb_array_elements(p_schema -> 'fields') f
  where p_answers ? (f ->> 'id')
    and public.form_field_visible(p_schema, f ->> 'id', p_answers)
$$;

create function public.application_answer_errors(p_application_id uuid, p_schema jsonb, p_answers jsonb)
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

revoke execute on function
  public.form_field_visible(jsonb, text, jsonb, text[]),
  public.prune_application_answers(jsonb, jsonb),
  public.application_answer_errors(uuid, jsonb, jsonb)
from public, anon, authenticated;
