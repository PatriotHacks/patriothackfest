-- Organizer-defined paragraph questions on project submissions.
create table public.project_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position integer not null,
  label text not null check (length(btrim(label)) between 1 and 300),
  help_text text check (length(help_text) <= 1000),
  required boolean not null default false,
  max_length integer not null default 5000 check (max_length between 1 and 10000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id)
);
create index project_questions_event_position_idx on public.project_questions (event_id, position);

revoke all on table public.project_questions from public, anon, authenticated;
alter table public.project_questions enable row level security;

create trigger project_questions_freeze before insert or update or delete on public.project_questions
for each row execute function public.prevent_judging_content_changes();
create trigger project_questions_updated before update on public.project_questions
for each row execute function public.set_updated_at();

alter table public.event_competition_settings add column judges_see_answers boolean not null default false;
alter table public.projects add column answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object');

-- Same order as settings saves and Start judging: event, then settings.
create function public.lock_project_questions(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_started_at timestamptz;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  select judging_started_at into v_started_at from public.event_competition_settings
  where event_id = p_event_id for update;
  if v_started_at is not null then raise exception 'Questions are locked because judging has started'; end if;
end;
$$;

create function public.admin_project_questions(p_event_id uuid)
returns setof public.project_questions language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query select * from public.project_questions
  where event_id = p_event_id and archived_at is null order by position, id;
end;
$$;

create function public.admin_save_project_question(
  p_event_id uuid, p_label text, p_help_text text, p_required boolean,
  p_max_length integer, p_question_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.lock_project_questions(p_event_id);
  if p_question_id is null then
    insert into public.project_questions (event_id, position, label, help_text, required, max_length)
    values (p_event_id,
      coalesce((select max(position) from public.project_questions where event_id = p_event_id), 0) + 1,
      btrim(p_label), nullif(btrim(p_help_text), ''), p_required, p_max_length)
    returning id into v_id;
  else
    update public.project_questions set label = btrim(p_label), help_text = nullif(btrim(p_help_text), ''),
      required = p_required, max_length = p_max_length
    where id = p_question_id and event_id = p_event_id and archived_at is null returning id into v_id;
    if not found then raise exception 'Question not found for this event'; end if;
  end if;
  return v_id;
end;
$$;

create function public.admin_archive_project_question(p_event_id uuid, p_question_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_project_questions(p_event_id);
  update public.project_questions set archived_at = clock_timestamp()
  where id = p_question_id and event_id = p_event_id and archived_at is null;
  if not found then raise exception 'Question not found for this event'; end if;
end;
$$;

create function public.admin_reorder_project_questions(p_event_id uuid, p_question_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_project_questions(p_event_id);
  if p_question_ids is null
    or cardinality(p_question_ids) <> (select count(distinct id) from unnest(p_question_ids) id)
    or (select coalesce(array_agg(q.id order by q.id), '{}') from public.project_questions q
        where q.event_id = p_event_id and q.archived_at is null)
      <> (select coalesce(array_agg(id order by id), '{}') from unnest(p_question_ids) id) then
    raise exception 'Question order must list every active question exactly once';
  end if;
  update public.project_questions q set position = o.ordinality
  from unnest(p_question_ids) with ordinality o (id, ordinality)
  where q.id = o.id and q.position <> o.ordinality;
end;
$$;

-- Visibility may change at any time, including after judging starts.
create function public.admin_set_judges_see_answers(p_event_id uuid, p_value boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_value is null then raise exception 'Choose whether judges see answers' using errcode = '22023'; end if;
  update public.event_competition_settings set judges_see_answers = p_value where event_id = p_event_id;
  if not found then raise exception 'Configure competition settings first'; end if;
end;
$$;

create function public.project_answer_errors(p_event_id uuid, p_answers jsonb, p_complete boolean)
returns jsonb language plpgsql stable set search_path = '' as $$
declare v_errors jsonb := '{}'; v_question public.project_questions; v_value text;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return '{"form":"Invalid question answers"}'::jsonb;
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_answers) k
    where not exists (
      select 1 from public.project_questions q
      where q.id::text = k and q.event_id = p_event_id and q.archived_at is null
    )
  ) then
    return '{"form":"The project questions changed. Reload the page before saving."}'::jsonb;
  end if;
  for v_question in select * from public.project_questions
    where event_id = p_event_id and archived_at is null order by position, id loop
    if p_answers ? v_question.id::text and jsonb_typeof(p_answers -> v_question.id::text) not in ('string', 'null') then
      v_errors := v_errors || jsonb_build_object('answers.' || v_question.id, 'Enter text');
      continue;
    end if;
    v_value := btrim(coalesce(p_answers ->> v_question.id::text, ''));
    if length(v_value) > v_question.max_length then
      v_errors := v_errors || jsonb_build_object('answers.' || v_question.id, format('Use %s characters or fewer', v_question.max_length));
    elsif p_complete and v_question.required and v_value = '' then
      v_errors := v_errors || jsonb_build_object('answers.' || v_question.id, 'This question is required');
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
        'required', q.required, 'max_length', q.max_length) order by q.position, q.id)
      from public.project_questions q
      where q.event_id = p.event_id and q.archived_at is null
    ), '[]'::jsonb)
  ) from public.projects p
  where p.id = p_project_id and p.event_id = p_event_id and public.project_is_accessible(p.id);
$$;

drop function public.participant_save_project(uuid, jsonb, uuid[], boolean, timestamptz);

create function public.participant_save_project(
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
  if p_expected_updated_at is null or p_expected_updated_at is distinct from v_project.updated_at then
    raise exception 'This project changed. Reload before saving again.' using errcode='PT409';
  end if;
  if p_submit is null then raise exception 'Invalid submission request'; end if;
  v_complete := p_submit or v_project.status = 'submitted';
  v_errors := public.project_content_errors(p_content, v_complete)
    || public.project_answer_errors(v_project.event_id, v_answers, v_complete);
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
      select jsonb_object_agg(a.key,btrim(a.value)) from jsonb_each_text(v_answers) a
      where btrim(coalesce(a.value,''))<>''
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

create function public.project_question_answers(p_project public.projects)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('question_id', q.id, 'label', q.label,
    'answer', coalesce(p_project.answers ->> q.id::text, '')) order by q.position, q.id), '[]'::jsonb)
  from public.project_questions q
  where q.event_id = p_project.event_id and q.archived_at is null;
$$;

-- Answers are filtered here so hidden answers never reach the judge client.
create or replace function public.judge_assignment(p_event_slug text,p_assignment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('assignment',public.judge_scorecard(a),
    'project',jsonb_build_object('name',p.name,'summary',p.summary,'description',p.description,
      'technologies',p.technologies,'repository_url',p.repository_url,'demo_url',p.demo_url,'video_url',p.video_url),
    'answers',case when s.judges_see_answers then (
      select coalesce(jsonb_agg(x-'question_id' order by n),'[]'::jsonb)
      from jsonb_array_elements(public.project_question_answers(p)) with ordinality qa(x,n)
    ) else '[]'::jsonb end)
  from public.events e cross join lateral public.current_judge_assignments(e.id) a
  join public.projects p on p.id=a.project_id
  join public.event_competition_settings s on s.event_id=e.id
  where e.slug=p_event_slug and a.id=p_assignment_id;
$$;

create or replace function public.admin_submitted_project_detail(p_event_id uuid,p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return (
    select jsonb_build_object(
      'project',jsonb_build_object(
        'id',p.id,'event_id',p.event_id,'status',p.status,'name',p.name,'summary',p.summary,
        'description',p.description,'technologies',p.technologies,
        'repository_url',p.repository_url,'demo_url',p.demo_url,'video_url',p.video_url,
        'submitted_at',p.submitted_at,'updated_at',p.updated_at
      ),
      'owner',jsonb_build_object('id',p.owner_user_id,'full_name',owner.full_name),
      'collaborators',coalesce((select jsonb_agg(jsonb_build_object('id',c.user_id,'full_name',person.full_name) order by c.created_at,c.user_id)
        from public.project_collaborators c join public.profiles person on person.id=c.user_id
        where c.project_id=p.id),'[]'::jsonb),
      'tracks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active) order by t.name,t.id)
        from public.project_tracks pt join public.competition_tracks t on t.id=pt.track_id
        where pt.project_id=p.id),'[]'::jsonb),
      'answers',public.project_question_answers(p)
    )
    from public.projects p join public.profiles owner on owner.id=p.owner_user_id
    where p.event_id=p_event_id and p.id=p_project_id and p.status='submitted'
  );
end;
$$;

revoke all on function public.lock_project_questions(uuid), public.admin_project_questions(uuid),
  public.admin_save_project_question(uuid, text, text, boolean, integer, uuid),
  public.admin_archive_project_question(uuid, uuid), public.admin_reorder_project_questions(uuid, uuid[]),
  public.admin_set_judges_see_answers(uuid, boolean), public.project_answer_errors(uuid, jsonb, boolean),
  public.participant_save_project(uuid, jsonb, jsonb, uuid[], boolean, timestamptz),
  public.project_question_answers(public.projects)
from public, anon, authenticated;
grant execute on function public.admin_project_questions(uuid),
  public.admin_save_project_question(uuid, text, text, boolean, integer, uuid),
  public.admin_archive_project_question(uuid, uuid), public.admin_reorder_project_questions(uuid, uuid[]),
  public.admin_set_judges_see_answers(uuid, boolean),
  public.participant_save_project(uuid, jsonb, jsonb, uuid[], boolean, timestamptz)
to authenticated;
