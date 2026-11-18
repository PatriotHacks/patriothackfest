-- Projects keep only a built-in name; everything else is an organizer-defined question.
create or replace function public.project_content_errors(p_content jsonb, p_complete boolean)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare v_errors jsonb := '{}'; v_value text;
begin
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    return '{"form":"Invalid project content"}'::jsonb;
  end if;
  if p_content - 'name' <> '{}'::jsonb then
    v_errors := v_errors || '{"form":"Unexpected project fields"}'::jsonb;
  end if;
  if p_content ? 'name' and jsonb_typeof(p_content->'name') not in ('string','null') then
    return v_errors || '{"name":"Enter text"}'::jsonb;
  end if;
  v_value := btrim(coalesce(p_content->>'name',''));
  if length(v_value) > 120 then
    v_errors := v_errors || '{"name":"Use 120 characters or fewer"}'::jsonb;
  end if;
  if p_complete and v_value = '' then
    v_errors := v_errors || '{"name":"This field is required"}'::jsonb;
  end if;
  return v_errors;
end;
$$;

-- The caller may be a collaborator, so every member, owner included, is rechecked.
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
    select 1 from (
      select v_project.owner_user_id user_id
      union all
      select c.user_id from public.project_collaborators c where c.project_id=p_project_id
    ) m where not public.project_user_is_eligible(v_project.event_id,m.user_id)
  ) then
    raise exception 'A team member is no longer eligible for this event. The owner must remove them before submitting or saving changes.';
  end if;
  update public.projects set
    name=btrim(coalesce(p_content->>'name','')),
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

-- Names only, owner first, and only while judges_see_team is on.
create or replace function public.judge_assignment(p_event_slug text,p_assignment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('assignment',public.judge_scorecard(a),
    'project',jsonb_build_object('name',p.name),
    'answers',case when s.judges_see_answers then public.project_question_answers(p) else '[]'::jsonb end,
    'team',case when s.judges_see_team then (
      select jsonb_agg(nullif(btrim(u.full_name),'') order by m.position,m.created_at,m.user_id)
      from (
        select p.owner_user_id user_id,0 position,p.created_at
        union all
        select c.user_id,1,c.created_at from public.project_collaborators c where c.project_id=p.id
      ) m join public.profiles u on u.id=m.user_id
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
        'id',p.id,'event_id',p.event_id,'status',p.status,'name',p.name,
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

alter table public.projects
  drop column summary,
  drop column description,
  drop column technologies,
  drop column repository_url,
  drop column demo_url,
  drop column video_url;
