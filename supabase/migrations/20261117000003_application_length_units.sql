-- Text fields may limit answers by words. Snapshots published before this
-- have no length_unit and keep counting characters.
alter table public.form_fields add constraint form_fields_text_length_unit_check check (
  case
    when not coalesce(validation ? 'length_unit', false) then true
    when type not in ('short_text', 'long_text')
      or jsonb_typeof(validation -> 'length_unit') <> 'string'
      or validation ->> 'length_unit' not in ('characters', 'words') then false
    when validation ->> 'length_unit' = 'characters' then true
    else
      case when jsonb_typeof(validation -> 'min_length') = 'number'
        then (validation ->> 'min_length')::numeric <= 1500 else not validation ? 'min_length' end
      and case when jsonb_typeof(validation -> 'max_length') = 'number'
        then (validation ->> 'max_length')::numeric <= 1500 else not validation ? 'max_length' end
  end
);

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
  v_unit text;
  v_length integer;
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
        else
          v_unit := coalesce(v_rules ->> 'length_unit', 'characters');
          v_length := case v_unit when 'words' then public.word_count(v_text)
            else char_length(public.js_trim(v_text)) end;
          if v_length < (v_rules ->> 'min_length')::integer then
            v_error := format('Enter at least %s %s', v_rules -> 'min_length', v_unit);
          elsif v_length > (v_rules ->> 'max_length')::integer then
            v_error := format('Enter at most %s %s', v_rules -> 'max_length', v_unit);
          end if;
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
