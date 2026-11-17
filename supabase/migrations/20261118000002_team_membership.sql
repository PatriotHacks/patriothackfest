-- Shared team editing and one team per event. A member is the project owner or
-- a collaborator; withdrawn projects no longer count as teams.
create function public.assert_one_team_per_event()
returns void language plpgsql set search_path = '' as $$
declare v_violations text;
begin
  select string_agg(format('event %s user %s', m.event_id, m.user_id), ', ' order by m.event_id, m.user_id)
  into v_violations
  from (
    select t.event_id, t.user_id from (
      select p.event_id, p.owner_user_id user_id from public.projects p where p.status <> 'withdrawn'
      union all
      select p.event_id, c.user_id from public.project_collaborators c
      join public.projects p on p.id = c.project_id where p.status <> 'withdrawn'
    ) t group by t.event_id, t.user_id having count(*) > 1
  ) m;
  if v_violations is not null then
    raise exception 'Users belong to more than one team in an event: %', v_violations;
  end if;
end;
$$;
revoke all on function public.assert_one_team_per_event() from public, anon, authenticated;

select public.assert_one_team_per_event();

-- Every membership change locks the event settings row first (RPCs via
-- lock_participant_project or participant_create_project), so these checks
-- serialize per event and cannot race.
create function public.enforce_project_team()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_max integer; v_size integer;
begin
  select max_team_size into v_max from public.event_competition_settings
  where event_id = new.event_id for update;
  if tg_table_name = 'projects' then
    if exists (
      select 1 from public.projects p
      cross join (
        select new.owner_user_id user_id
        union all
        select c.user_id from public.project_collaborators c where c.project_id = new.id
      ) m
      where p.event_id = new.event_id and p.id <> new.id and p.status <> 'withdrawn'
        and (p.owner_user_id = m.user_id or exists (
          select 1 from public.project_collaborators c where c.project_id = p.id and c.user_id = m.user_id
        ))
    ) then
      raise exception 'You are already on a team for this event';
    end if;
    return new;
  end if;
  if exists (
    select 1 from public.projects p
    where p.event_id = new.event_id and p.status <> 'withdrawn'
      and (p.owner_user_id = new.user_id or exists (
        select 1 from public.project_collaborators c where c.project_id = p.id and c.user_id = new.user_id
      ))
  ) then
    raise exception 'This participant is already on a team for this event';
  end if;
  select 1 + count(*) into v_size from public.project_collaborators where project_id = new.project_id;
  if v_size >= v_max then
    raise exception 'This team is full. Teams can have at most % %.', v_max,
      case when v_max = 1 then 'member' else 'members' end;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_project_team() from public, anon, authenticated;

create trigger projects_one_team before insert or update of owner_user_id, status on public.projects
for each row when (new.status <> 'withdrawn') execute function public.enforce_project_team();
create trigger collaborators_one_team before insert on public.project_collaborators
for each row execute function public.enforce_project_team();

-- Any member may edit. Membership is rechecked after the settings lock because
-- roster changes take the same lock.
create or replace function public.lock_participant_project(p_project_id uuid, p_roster_only boolean default false)
returns public.projects language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_settings public.event_competition_settings;
  v_project public.projects;
begin
  if auth.uid() is null then raise exception 'Sign in to manage a project' using errcode = '42501'; end if;
  select event_id into v_event_id from public.projects
  where id = p_project_id and public.project_is_accessible(id);
  if not found then raise exception 'Project not found' using errcode = 'PT404'; end if;
  select * into v_settings from public.event_competition_settings where event_id = v_event_id for update;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or not public.project_is_accessible(p_project_id) then
    raise exception 'Project not found' using errcode = 'PT404';
  end if;
  if not v_settings.enabled then raise exception 'Project submissions are disabled'; end if;
  if v_settings.judging_started_at is not null then raise exception 'Projects are locked because judging has started'; end if;
  if v_settings.project_submissions_close_at is not null and clock_timestamp() >= v_settings.project_submissions_close_at then
    raise exception 'Project submissions are closed';
  end if;
  if not p_roster_only and clock_timestamp() < v_settings.project_submissions_open_at then
    raise exception 'Project submissions have not opened yet';
  end if;
  if v_project.status = 'withdrawn' then raise exception 'This project has been withdrawn'; end if;
  if not public.project_user_is_eligible(v_event_id, auth.uid()) then
    raise exception 'A submitted and accepted application for this event is required' using errcode = '42501';
  end if;
  return v_project;
end;
$$;

-- Any member adds. Team and size errors come from enforce_project_team, after
-- the generic error so unknown or ineligible addresses reveal nothing.
create or replace function public.participant_add_project_collaborator(p_project_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_project public.projects; v_user_id uuid;
begin
  v_project := public.lock_participant_project(p_project_id, true);
  select u.id into v_user_id from auth.users u
  where lower(u.email) = lower(btrim(p_email));
  if v_user_id is null or v_user_id = auth.uid()
    or not public.project_user_is_eligible(v_project.event_id, v_user_id) then
    raise exception 'Cannot add this collaborator. Use the email of an eligible registered participant.';
  end if;
  insert into public.project_collaborators(project_id, event_id, user_id)
  values (p_project_id, v_project.event_id, v_user_id);
end;
$$;

create or replace function public.participant_remove_project_collaborator(p_project_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (public.lock_participant_project(p_project_id, true)).owner_user_id <> auth.uid() then
    raise exception 'Only the project owner can remove teammates' using errcode = '42501';
  end if;
  delete from public.project_collaborators where project_id = p_project_id and user_id = p_user_id;
  if not found then raise exception 'Collaborator not found'; end if;
end;
$$;

create function public.participant_leave_project(p_project_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (public.lock_participant_project(p_project_id, true)).owner_user_id = auth.uid() then
    raise exception 'The project owner cannot leave the team';
  end if;
  delete from public.project_collaborators where project_id = p_project_id and user_id = auth.uid();
end;
$$;

create or replace function public.participant_withdraw_project(p_project_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (public.lock_participant_project(p_project_id, true)).owner_user_id <> auth.uid() then
    raise exception 'Only the project owner can withdraw the project' using errcode = '42501';
  end if;
  update public.projects set status='withdrawn' where id=p_project_id;
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

-- Mirrors lock_participant_project: any member, while the project can be saved.
create or replace function public.project_file_writable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1
    from public.project_file_parts(p_name) m (parts)
    join public.projects p on p.id::text = m.parts[1]
    join public.event_competition_settings s on s.event_id = p.event_id
    join public.project_questions q on q.id::text = m.parts[2] and q.event_id = p.event_id
    where public.project_is_accessible(p.id)
      and p.status <> 'withdrawn'
      and q.archived_at is null and q.type = 'file'
      and s.enabled and s.judging_started_at is null
      and (s.project_submissions_open_at is null or clock_timestamp() >= s.project_submissions_open_at)
      and (s.project_submissions_close_at is null or clock_timestamp() < s.project_submissions_close_at)
      and public.project_user_is_eligible(p.event_id, auth.uid())
  );
$$;

create or replace function public.participant_project_detail(p_project_id uuid, p_event_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'project', to_jsonb(p),
    'owner', (
      select jsonb_build_object('user_id', u.id, 'full_name', u.full_name)
      from public.profiles u where u.id = p.owner_user_id
    ),
    'collaborators', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', c.user_id, 'full_name', u.full_name) order by c.created_at, c.user_id)
      from public.project_collaborators c join public.profiles u on u.id = c.user_id
      where c.project_id = p.id
    ), '[]'::jsonb),
    'max_team_size', (select s.max_team_size from public.event_competition_settings s where s.event_id = p.event_id),
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

revoke all on function public.participant_leave_project(uuid) from public, anon, authenticated;
grant execute on function public.participant_leave_project(uuid) to authenticated;
