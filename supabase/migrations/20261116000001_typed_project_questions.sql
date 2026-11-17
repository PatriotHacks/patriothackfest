-- Typed project questions. Existing rows become long_text and keep max_length.
create function public.project_question_config_error(
  p_type public.field_type, p_max_length integer, p_options jsonb, p_validation jsonb
)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if p_type is null or p_type not in ('short_text', 'long_text', 'url', 'single_choice', 'multiple_choice', 'file') then
    return 'Choose a supported question type';
  end if;
  if (p_type in ('short_text', 'long_text')) <> (p_max_length is not null) then
    return 'Only text questions have a maximum length';
  end if;
  if p_type in ('single_choice', 'multiple_choice') then
    if p_options is null or jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) = 0 then
      return 'Add at least one option';
    end if;
    if jsonb_array_length(p_options) > 50 then
      return 'Use 50 options or fewer';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_options) o
      where jsonb_typeof(o) <> 'object' or o - array['id', 'label'] <> '{}'::jsonb
        or jsonb_typeof(o -> 'id') is distinct from 'string'
        or o ->> 'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(o -> 'label') is distinct from 'string'
    ) then
      return 'Invalid options';
    end if;
    if exists (select 1 from jsonb_array_elements(p_options) o where length(btrim(o ->> 'label')) not between 1 and 200) then
      return 'Option labels must be 1-200 characters';
    end if;
    if (select count(distinct o ->> 'id') <> count(*) from jsonb_array_elements(p_options) o) then
      return 'Option ids must be unique';
    end if;
    if (select count(distinct lower(btrim(o ->> 'label'))) <> count(*) from jsonb_array_elements(p_options) o) then
      return 'Option labels must be unique';
    end if;
  elsif p_options is not null then
    return 'Only choice questions have options';
  end if;
  if p_validation is not null then
    if p_type <> 'file' or jsonb_typeof(p_validation) <> 'object' or p_validation - 'max_size_mb' <> '{}'::jsonb
      or jsonb_typeof(p_validation -> 'max_size_mb') is distinct from 'number'
      or (p_validation ->> 'max_size_mb')::numeric <= 0 or (p_validation ->> 'max_size_mb')::numeric > 10 then
      return 'Maximum file size must be greater than 0 and at most 10 MB';
    end if;
  end if;
  return null;
end;
$$;

alter table public.project_questions
  add column type public.field_type not null default 'long_text',
  add column options jsonb,
  add column validation jsonb,
  add column archived_options jsonb,
  alter column max_length drop not null,
  alter column max_length drop default,
  add constraint project_questions_config_check
    check (public.project_question_config_error(type, max_length, options, validation) is null),
  add constraint project_questions_archived_options_check
    check (archived_options is null
      or (type in ('single_choice', 'multiple_choice') and jsonb_typeof(archived_options) = 'array'));

comment on column public.project_questions.archived_options is
  'Options removed from a choice question, kept only so re-adding a label restores its id. Never shown to participants or judges.';

create function public.project_question_answered(p_event_id uuid, p_question_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.event_id = p_event_id and p.answers ? p_question_id::text
      and p.answers -> p_question_id::text <> 'null'::jsonb
  );
$$;

create function public.prevent_answered_question_type_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.type is distinct from old.type and public.project_question_answered(old.event_id, old.id) then
    raise exception 'This question already has answers, so its type cannot change. Archive it and add a new question instead.';
  end if;
  return new;
end;
$$;

create trigger project_questions_type_lock before update of type on public.project_questions
for each row execute function public.prevent_answered_question_type_change();

drop function public.admin_project_questions(uuid);

create function public.admin_project_questions(p_event_id uuid)
returns table (
  id uuid, event_id uuid, "position" integer, label text, help_text text, required boolean,
  max_length integer, type public.field_type, options jsonb, validation jsonb, archived_options jsonb,
  archived_at timestamptz, created_at timestamptz, updated_at timestamptz, answered boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query
  select q.id, q.event_id, q.position, q.label, q.help_text, q.required, q.max_length, q.type, q.options,
    q.validation, q.archived_options, q.archived_at, q.created_at, q.updated_at, public.project_question_answered(q.event_id, q.id)
  from public.project_questions q
  where q.event_id = p_event_id and q.archived_at is null order by q.position, q.id;
end;
$$;

drop function public.admin_save_project_question(uuid, text, text, boolean, integer, uuid);

create function public.admin_save_project_question(
  p_event_id uuid, p_label text, p_help_text text, p_required boolean,
  p_max_length integer default null, p_question_id uuid default null,
  p_type public.field_type default 'long_text', p_options jsonb default null, p_validation jsonb default null
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
  v_error := public.project_question_config_error(p_type, p_max_length, p_options, v_validation);
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
    insert into public.project_questions (event_id, position, label, help_text, required, max_length, type, options, validation)
    values (p_event_id,
      coalesce((select max(position) from public.project_questions where event_id = p_event_id), 0) + 1,
      btrim(p_label), nullif(btrim(p_help_text), ''), p_required, p_max_length, p_type, v_options, v_validation)
    returning id into v_id;
  else
    update public.project_questions set label = btrim(p_label), help_text = nullif(btrim(p_help_text), ''),
      required = p_required, max_length = p_max_length, type = p_type, options = v_options, validation = v_validation,
      archived_options = v_archived
    where id = p_question_id and event_id = p_event_id and archived_at is null returning id into v_id;
    if not found then raise exception 'Question not found for this event'; end if;
  end if;
  return v_id;
end;
$$;

-- Trims text and drops choice ids that are no longer options, so a removed
-- option clears the answer instead of failing unrelated saves. File answers
-- take size and type from the stored object, never from the client.
create function public.project_answers_normalized(p_event_id uuid, p_answers jsonb)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(e.key, case
    when q.type = 'single_choice' and jsonb_typeof(e.value) = 'string' then
      case when exists (select 1 from jsonb_array_elements(q.options) o where o -> 'id' = e.value)
        then e.value else '""'::jsonb end
    when q.type = 'multiple_choice' and jsonb_typeof(e.value) = 'array' then coalesce((
      select jsonb_agg(v order by n) from jsonb_array_elements(e.value) with ordinality x(v, n)
      where jsonb_typeof(v) <> 'string' or exists (select 1 from jsonb_array_elements(q.options) o where o -> 'id' = v)
    ), '[]'::jsonb)
    when q.type = 'file' and jsonb_typeof(e.value) = 'object' then e.value || coalesce((
      select jsonb_build_object('size', o.metadata -> 'size', 'type', o.metadata -> 'mimetype')
      from storage.objects o
      where o.bucket_id = 'project-files' and o.name = e.value ->> 'path'
        and jsonb_typeof(o.metadata -> 'size') = 'number' and jsonb_typeof(o.metadata -> 'mimetype') = 'string'
    ), '{}'::jsonb)
    when jsonb_typeof(e.value) = 'string' then to_jsonb(btrim(e.value #>> '{}'))
    else e.value end), '{}'::jsonb)
  from jsonb_each(p_answers) e
  left join public.project_questions q on q.id::text = e.key and q.event_id = p_event_id and q.archived_at is null;
$$;

drop function public.project_answer_errors(uuid, jsonb, boolean);

create function public.project_answer_errors(p_project public.projects, p_answers jsonb, p_complete boolean)
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
          elsif length(v_text) > v_question.max_length then
            v_error := format('Use %s characters or fewer', v_question.max_length);
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

create or replace function public.participant_save_project(
  p_project_id uuid, p_content jsonb, p_answers jsonb default null, p_track_ids uuid[] default '{}',
  p_submit boolean default false, p_expected_updated_at timestamptz default null
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_project public.projects; v_errors jsonb; v_complete boolean; v_updated_at timestamptz; v_answers jsonb;
begin
  v_project := public.lock_participant_project(p_project_id, false);
  v_answers := coalesce(p_answers, (
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(v_project.answers) e
    join public.project_questions q on q.id::text = e.key and q.event_id = v_project.event_id and q.archived_at is null
  ));
  if jsonb_typeof(v_answers) = 'object' then
    v_answers := public.project_answers_normalized(v_project.event_id, v_answers);
  end if;
  if p_expected_updated_at is null or p_expected_updated_at is distinct from v_project.updated_at then
    raise exception 'This project changed. Reload before saving again.' using errcode='PT409';
  end if;
  if p_submit is null then raise exception 'Invalid submission request'; end if;
  v_complete := p_submit or v_project.status = 'submitted';
  v_errors := public.project_content_errors(p_content, v_complete)
    || public.project_answer_errors(v_project, v_answers, v_complete);
  if p_track_ids is null or exists (
    select 1 from unnest(p_track_ids) selected(id)
    left join public.competition_tracks t on t.id=selected.id and t.event_id=v_project.event_id and t.active
    where t.id is null
  ) then
    v_errors := v_errors || '{"track_ids":"Choose active tracks for this event; remove unavailable selections"}'::jsonb;
  end if;
  if v_errors <> '{}'::jsonb then
    raise exception 'Some project fields need attention' using errcode='PT422',detail=v_errors::text;
  end if;
  if v_complete and exists (
    select 1 from public.project_collaborators c where c.project_id=p_project_id
      and not public.project_user_is_eligible(v_project.event_id,c.user_id)
  ) then
    raise exception 'A collaborator is no longer eligible for this event. Remove them before submitting or saving changes.';
  end if;
  update public.projects set
    name=btrim(coalesce(p_content->>'name','')),summary=btrim(coalesce(p_content->>'summary','')),
    description=btrim(coalesce(p_content->>'description','')),technologies=btrim(coalesce(p_content->>'technologies','')),
    repository_url=nullif(btrim(p_content->>'repository_url'),''),demo_url=nullif(btrim(p_content->>'demo_url'),''),video_url=nullif(btrim(p_content->>'video_url'),''),
    answers=coalesce((
      select jsonb_object_agg(a.key,a.value) from jsonb_each(v_answers) a
      where a.value not in ('null'::jsonb,'""'::jsonb,'[]'::jsonb)
    ),'{}'::jsonb),
    status=case when p_submit then 'submitted' else status end,
    submitted_at=case when p_submit then coalesce(submitted_at,clock_timestamp()) else submitted_at end
  where id=p_project_id returning updated_at into v_updated_at;
  delete from public.project_tracks where project_id=p_project_id;
  insert into public.project_tracks(project_id,track_id,event_id)
  select p_project_id,id,v_project.event_id from (select distinct unnest(p_track_ids) id) selected;
  return v_updated_at;
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
        'required', q.required, 'max_length', q.max_length, 'type', q.type, 'options', q.options,
        'validation', q.validation) order by q.position, q.id)
      from public.project_questions q
      where q.event_id = p.event_id and q.archived_at is null
    ), '[]'::jsonb)
  ) from public.projects p
  where p.id = p_project_id and p.event_id = p_event_id and public.project_is_accessible(p.id);
$$;

create or replace function public.project_question_answers(p_project public.projects)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('question_id', q.id, 'label', q.label, 'type', q.type,
    'options', q.options, 'answer', p_project.answers -> q.id::text) order by q.position, q.id), '[]'::jsonb)
  from public.project_questions q
  where q.event_id = p_project.event_id and q.archived_at is null;
$$;

-- Answers are filtered here so hidden answers never reach the judge client.
create or replace function public.judge_assignment(p_event_slug text,p_assignment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('assignment',public.judge_scorecard(a),
    'project',jsonb_build_object('name',p.name,'summary',p.summary,'description',p.description,
      'technologies',p.technologies,'repository_url',p.repository_url,'demo_url',p.demo_url,'video_url',p.video_url),
    'answers',case when s.judges_see_answers then public.project_question_answers(p) else '[]'::jsonb end)
  from public.events e cross join lateral public.current_judge_assignments(e.id) a
  join public.projects p on p.id=a.project_id
  join public.event_competition_settings s on s.event_id=e.id
  where e.slug=p_event_slug and a.id=p_assignment_id;
$$;

revoke all on function public.project_question_config_error(public.field_type, integer, jsonb, jsonb),
  public.project_question_answered(uuid, uuid), public.prevent_answered_question_type_change(),
  public.admin_project_questions(uuid),
  public.admin_save_project_question(uuid, text, text, boolean, integer, uuid, public.field_type, jsonb, jsonb),
  public.project_answers_normalized(uuid, jsonb), public.project_answer_errors(public.projects, jsonb, boolean)
from public, anon, authenticated;
grant execute on function public.admin_project_questions(uuid),
  public.admin_save_project_question(uuid, text, text, boolean, integer, uuid, public.field_type, jsonb, jsonb)
to authenticated;
