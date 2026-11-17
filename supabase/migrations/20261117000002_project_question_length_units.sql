-- Text project questions limit answers by characters or words. Existing
-- questions keep character limits; answers stay capped at 10,000 characters.
create type public.text_length_unit as enum ('characters', 'words');

create function public.project_question_length_unit_error(
  p_type public.field_type, p_max_length integer, p_length_unit public.text_length_unit
)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if p_length_unit is null then
    return 'Choose characters or words';
  end if;
  if p_length_unit = 'words' and p_type not in ('short_text', 'long_text') then
    return 'Only text questions have a word limit';
  end if;
  if p_length_unit = 'words' and p_max_length > 1500 then
    return 'Word limits must be at most 1500 words';
  end if;
  return null;
end;
$$;

alter table public.project_questions
  add column length_unit public.text_length_unit not null default 'characters',
  add constraint project_questions_length_unit_check
    check (public.project_question_length_unit_error(type, max_length, length_unit) is null);

drop function public.admin_project_questions(uuid);

create function public.admin_project_questions(p_event_id uuid)
returns table (
  id uuid, event_id uuid, "position" integer, label text, help_text text, required boolean,
  max_length integer, length_unit public.text_length_unit, type public.field_type, options jsonb, validation jsonb, archived_options jsonb,
  archived_at timestamptz, created_at timestamptz, updated_at timestamptz, answered boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query
  select q.id, q.event_id, q.position, q.label, q.help_text, q.required, q.max_length, q.length_unit, q.type, q.options,
    q.validation, q.archived_options, q.archived_at, q.created_at, q.updated_at, public.project_question_answered(q.event_id, q.id)
  from public.project_questions q
  where q.event_id = p_event_id and q.archived_at is null order by q.position, q.id;
end;
$$;

drop function public.admin_save_project_question(uuid, text, text, boolean, integer, uuid, public.field_type, jsonb, jsonb);

create function public.admin_save_project_question(
  p_event_id uuid, p_label text, p_help_text text, p_required boolean,
  p_max_length integer default null, p_question_id uuid default null,
  p_type public.field_type default 'long_text', p_options jsonb default null, p_validation jsonb default null,
  p_length_unit public.text_length_unit default 'characters'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_error text;
  v_options jsonb;
  v_validation jsonb := nullif(p_validation, '{}'::jsonb);
  v_known jsonb;
  v_archived jsonb;
  v_limit numeric := coalesce((nullif(p_validation, '{}'::jsonb) ->> 'max_size_mb')::numeric, 10);
begin
  perform public.lock_project_questions(p_event_id);
  v_error := coalesce(public.project_question_config_error(p_type, p_max_length, p_options, v_validation),
    public.project_question_length_unit_error(p_type, p_max_length, p_length_unit));
  if v_error is not null then raise exception '%', v_error using errcode = '22023'; end if;
  -- Every option the question has ever had, active first. A new option whose
  -- label matches one of these takes its id back, even across separate saves.
  select coalesce(jsonb_agg(known.entry order by known.tier, known.n), '[]'::jsonb) into v_known
  from public.project_questions q,
    lateral (
      select a, 0, n from jsonb_array_elements(coalesce(q.options, '[]'::jsonb)) with ordinality x(a, n)
      union all
      select a, 1, n from jsonb_array_elements(coalesce(q.archived_options, '[]'::jsonb)) with ordinality y(a, n)
    ) known(entry, tier, n)
  where q.id = p_question_id and q.event_id = p_event_id;
  if p_options is not null then
    select jsonb_agg(jsonb_build_object('id', coalesce(reused.id, o ->> 'id'), 'label', btrim(o ->> 'label')) order by n)
    into v_options
    from jsonb_array_elements(p_options) with ordinality x(o, n)
    left join lateral (
      select old_option ->> 'id' as id
      from jsonb_array_elements(v_known) with ordinality k(old_option, pos)
      where lower(btrim(old_option ->> 'label')) = lower(btrim(o ->> 'label'))
        and not exists (select 1 from jsonb_array_elements(p_options) kept where kept ->> 'id' = old_option ->> 'id')
        and not exists (select 1 from jsonb_array_elements(v_known) same where same ->> 'id' = o ->> 'id')
      order by pos
      limit 1
    ) reused on true;
  end if;
  if p_type in ('single_choice', 'multiple_choice') then
    select coalesce(jsonb_agg(old_option order by pos), '[]'::jsonb) into v_archived
    from jsonb_array_elements(v_known) with ordinality k(old_option, pos)
    where not exists (select 1 from jsonb_array_elements(v_options) kept where kept ->> 'id' = old_option ->> 'id');
  end if;
  if p_question_id is not null and p_type = 'file' and exists (
    select 1 from public.projects p
    join storage.objects o on o.bucket_id = 'project-files' and o.name = p.answers -> p_question_id::text ->> 'path'
    where p.event_id = p_event_id and (o.metadata ->> 'size')::numeric > v_limit * 1024 * 1024
  ) then
    raise exception 'Saved answers include files larger than % MB. Keep a higher limit.', v_limit using errcode = '22023';
  end if;
  if p_question_id is null then
    insert into public.project_questions (event_id, position, label, help_text, required, max_length, length_unit, type, options, validation)
    values (p_event_id,
      coalesce((select max(position) from public.project_questions where event_id = p_event_id), 0) + 1,
      btrim(p_label), nullif(btrim(p_help_text), ''), p_required, p_max_length, p_length_unit, p_type, v_options, v_validation)
    returning id into v_id;
  else
    update public.project_questions set label = btrim(p_label), help_text = nullif(btrim(p_help_text), ''),
      required = p_required, max_length = p_max_length, length_unit = p_length_unit, type = p_type, options = v_options, validation = v_validation,
      archived_options = v_archived
    where id = p_question_id and event_id = p_event_id and archived_at is null returning id into v_id;
    if not found then raise exception 'Question not found for this event'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.project_answer_errors(p_project public.projects, p_answers jsonb, p_complete boolean)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_errors jsonb := '{}';
  v_question public.project_questions;
  v_value jsonb;
  v_kind text;
  v_text text;
  v_limit numeric;
  v_object jsonb;
  v_error text;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return '{"form":"Invalid question answers"}'::jsonb;
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_answers) k
    where not exists (
      select 1 from public.project_questions q
      where q.id::text = k and q.event_id = p_project.event_id and q.archived_at is null
    )
  ) then
    return '{"form":"The project questions changed. Reload the page before saving."}'::jsonb;
  end if;
  for v_question in select * from public.project_questions
    where event_id = p_project.event_id and archived_at is null order by position, id loop
    v_value := p_answers -> v_question.id::text;
    v_kind := jsonb_typeof(v_value);
    v_text := case when v_kind = 'string' then btrim(v_value #>> '{}') end;
    v_error := null;
    if v_kind is null or v_kind = 'null' or v_text = '' or (v_kind = 'array' and jsonb_array_length(v_value) = 0) then
      if p_complete and v_question.required then v_error := 'This question is required'; end if;
    else
      case v_question.type
        when 'short_text', 'long_text' then
          if v_kind <> 'string' then
            v_error := 'Enter text';
          elsif length(v_text) > 10000 then
            v_error := 'Use 10000 characters or fewer';
          elsif (case v_question.length_unit when 'words' then public.word_count(v_text) else length(v_text) end)
              > v_question.max_length then
            v_error := format('Use %s or fewer', public.format_length(v_question.max_length, v_question.length_unit::text));
          end if;
        when 'url' then
          if v_kind <> 'string' or length(v_text) > 2048 or not public.project_http_url_valid(v_text) then
            v_error := 'Enter an HTTP or HTTPS URL';
          end if;
        when 'single_choice' then
          if v_kind <> 'string' or not exists (
            select 1 from jsonb_array_elements(v_question.options) o where o -> 'id' = v_value
          ) then
            v_error := 'Choose one of the options';
          end if;
        when 'multiple_choice' then
          if v_kind <> 'array'
            or exists (
              select 1 from jsonb_array_elements(v_value) e
              where jsonb_typeof(e) <> 'string'
                or not exists (select 1 from jsonb_array_elements(v_question.options) o where o -> 'id' = e)
            )
            or (select count(distinct e) <> count(*) from jsonb_array_elements(v_value) e) then
            v_error := 'Choose from the options';
          end if;
        when 'file' then
          v_limit := coalesce((v_question.validation ->> 'max_size_mb')::numeric, 10);
          if v_kind <> 'object' or v_value - array['path', 'name', 'size', 'type'] <> '{}'::jsonb
            or jsonb_typeof(v_value -> 'path') is distinct from 'string'
            or jsonb_typeof(v_value -> 'name') is distinct from 'string'
            or length(v_value ->> 'name') not between 1 and 255
            or jsonb_typeof(v_value -> 'size') is distinct from 'number'
            or (v_value ->> 'size')::numeric < 0
            or (v_value ->> 'size')::numeric <> trunc((v_value ->> 'size')::numeric)
            or jsonb_typeof(v_value -> 'type') is distinct from 'string' then
            v_error := 'Upload a file';
          else
            select o.metadata into v_object from storage.objects o
            where o.bucket_id = 'project-files' and o.name = v_value ->> 'path';
            if v_value ->> 'path' !~ ('^' || p_project.id || '/' || v_question.id
                || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$')
              or jsonb_typeof(v_object -> 'size') is distinct from 'number' then
              v_error := 'Upload the file again';
            elsif v_object ->> 'mimetype' is distinct from 'application/pdf' then
              v_error := 'Upload a PDF file';
            elsif (v_object ->> 'size')::numeric > v_limit * 1024 * 1024 then
              v_error := format('Files must be %s MB or smaller', v_limit);
            end if;
          end if;
        else
          v_error := 'Invalid value';
      end case;
    end if;
    if v_error is not null then
      v_errors := v_errors || jsonb_build_object('answers.' || v_question.id, v_error);
    end if;
  end loop;
  return v_errors;
end;
$$;

create or replace function public.participant_project_detail(p_project_id uuid, p_event_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'project', to_jsonb(p),
    'collaborators', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', c.user_id, 'full_name', u.full_name) order by c.created_at, c.user_id)
      from public.project_collaborators c join public.profiles u on u.id = c.user_id
      where c.project_id = p.id
    ), '[]'::jsonb),
    'selected_tracks', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'active', t.active) order by t.name, t.id)
      from public.project_tracks pt join public.competition_tracks t on t.id = pt.track_id
      where pt.project_id = p.id
    ), '[]'::jsonb),
    'available_tracks', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'description', t.description, 'sponsor', t.sponsor) order by t.name, t.id)
      from public.competition_tracks t join public.event_competition_settings s on s.event_id = t.event_id
      where t.event_id = p.event_id and t.active and s.enabled
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'label', q.label, 'help_text', q.help_text,
        'required', q.required, 'max_length', q.max_length,
        'length_unit', q.length_unit, 'type', q.type, 'options', q.options,
        'validation', q.validation) order by q.position, q.id)
      from public.project_questions q
      where q.event_id = p.event_id and q.archived_at is null
    ), '[]'::jsonb)
  ) from public.projects p
  where p.id = p_project_id and p.event_id = p_event_id and public.project_is_accessible(p.id);
$$;

revoke all on function public.project_question_length_unit_error(public.field_type, integer, public.text_length_unit),
  public.admin_project_questions(uuid),
  public.admin_save_project_question(uuid, text, text, boolean, integer, uuid, public.field_type, jsonb, jsonb, public.text_length_unit)
from public, anon, authenticated;
grant execute on function public.admin_project_questions(uuid),
  public.admin_save_project_question(uuid, text, text, boolean, integer, uuid, public.field_type, jsonb, jsonb, public.text_length_unit)
to authenticated;
