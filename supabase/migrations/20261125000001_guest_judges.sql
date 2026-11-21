-- Guest judges keep portal access but never receive assignments.
alter table public.event_judges add column guest boolean not null default false;

create or replace function public.assignment_candidates(p_event_id uuid,p_project_id uuid,p_track_id uuid)
returns table(judge_id uuid,email text,workload integer,capacity integer)
language sql stable security definer set search_path = '' as $$
  select j.id,j.email::text,load.n,j.capacity
  from public.event_judges j join public.projects p on p.event_id=j.event_id
  cross join lateral (
    select count(*)::integer n from public.judging_assignments a where a.judge_id=j.id and not a.cancelled
  ) load
  where j.event_id=p_event_id and p.id=p_project_id and p.status='submitted' and j.active and not j.guest
    and load.n<j.capacity
    and ((p_track_id is null and j.kind='general') or (p_track_id is not null and j.kind='sponsor'
      and exists(select 1 from public.project_tracks pt join public.competition_tracks t on t.id=pt.track_id
        where pt.project_id=p.id and pt.track_id=p_track_id and t.active)
      and exists(select 1 from public.judge_track_scopes s where s.judge_id=j.id and s.track_id=p_track_id)))
    and not exists(select 1 from public.judging_assignments a where a.judge_id=j.id
      and a.project_id=p.id and a.track_id is not distinct from p_track_id)
    and not exists (
      select 1 from (
        select p.owner_user_id user_id union all
        select c.user_id from public.project_collaborators c where c.project_id=p.id
      ) member left join auth.users u on u.id=member.user_id
      where member.user_id=j.user_id or (u.email_confirmed_at is not null and lower(u.email)=lower(j.email::text))
    )
  order by load.n,j.id;
$$;

-- Cancels every unsubmitted assignment of the judge (discarding drafts) and gives
-- each still-needed context to the least-loaded eligible judge. Submitted reviews stay.
create function public.transfer_judge_assignments(p_event_id uuid,p_judge_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_assignment public.judging_assignments; v_judge_id uuid;
  v_moved integer := 0; v_dropped integer := 0; v_missing integer := 0;
begin
  perform 1 from public.event_competition_settings where event_id=p_event_id for update;
  for v_assignment in
    select * from public.judging_assignments a
    where a.event_id=p_event_id and a.judge_id=p_judge_id and not a.cancelled and a.submitted_at is null
    order by a.created_at,a.id for update
  loop
    if not public.assignment_untouched(v_assignment.id) then
      v_dropped := v_dropped+1;
      delete from public.judging_scores where assignment_id=v_assignment.id;
    end if;
    update public.judging_assignments set cancelled=true,notes='' where id=v_assignment.id;
    if exists(select 1 from public.assignment_targets(p_event_id)t where t.project_id=v_assignment.project_id
      and t.track_id is not distinct from v_assignment.track_id and t.missing>0) then
      v_judge_id := null;
      select c.judge_id into v_judge_id
      from public.assignment_candidates(p_event_id,v_assignment.project_id,v_assignment.track_id)c
      order by c.workload,c.judge_id limit 1;
      if v_judge_id is null then
        v_missing := v_missing+1;
      else
        insert into public.judging_assignments(event_id,judge_id,project_id,track_id)
        values(p_event_id,v_judge_id,v_assignment.project_id,v_assignment.track_id);
        v_moved := v_moved+1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('moved',v_moved,'dropped_drafts',v_dropped,'missing',v_missing);
end;
$$;

create function public.admin_judge_transfer_preview(p_event_id uuid,p_judge_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  return (
    select jsonb_build_object('unsubmitted',count(*),
      'drafts',count(*) filter (where not public.assignment_untouched(a.id)))
    from public.judging_assignments a
    where a.event_id=p_event_id and a.judge_id=p_judge_id and not a.cancelled and a.submitted_at is null
  );
end;
$$;

create function public.admin_set_event_judge_guest(p_event_id uuid,p_judge_id uuid,p_guest boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_guest is null then raise exception 'Choose whether the judge is a guest' using errcode='22023'; end if;
  perform 1 from public.event_competition_settings where event_id=p_event_id for update;
  if not found then raise exception 'Configure competition settings first'; end if;
  update public.event_judges set guest=p_guest where id=p_judge_id and event_id=p_event_id;
  if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
  if not p_guest then return jsonb_build_object('moved',0,'dropped_drafts',0,'missing',0); end if;
  return public.transfer_judge_assignments(p_event_id,p_judge_id);
end;
$$;

-- Return type changes from uuid to {id, transfer}; transfer is set when the judge is saved inactive.
drop function public.admin_save_event_judge(uuid,text,text,boolean,integer,uuid[],uuid);
create function public.admin_save_event_judge(
  p_event_id uuid,p_email text,p_kind text,p_active boolean,p_capacity integer,
  p_track_ids uuid[] default '{}',p_judge_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_judge public.event_judges; v_id uuid; v_email text; v_transfer jsonb;
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  perform 1 from public.event_competition_settings where event_id=p_event_id for update;
  if not found then raise exception 'Save competition settings before adding judges'; end if;
  if p_judge_id is not null then
    select * into v_judge from public.event_judges where id=p_judge_id and event_id=p_event_id for update;
    if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
  end if;
  v_email := lower(btrim(coalesce(p_email,'')));
  if length(v_email)>320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid judge email';
  end if;
  if p_kind is null or p_kind not in ('general','sponsor') then raise exception 'Choose general or sponsor judge'; end if;
  if p_active is null then raise exception 'Choose an active status'; end if;
  if p_capacity is null or p_capacity not between 1 and 1000 then raise exception 'Capacity must be between 1 and 1000'; end if;
  if p_track_ids is null or array_position(p_track_ids,null) is not null then raise exception 'Choose valid sponsor tracks'; end if;
  if p_kind='general' and cardinality(p_track_ids)>0 then raise exception 'General judges cannot have sponsor tracks'; end if;
  if p_kind='sponsor' and cardinality(p_track_ids)=0 then raise exception 'Select at least one sponsor track'; end if;
  if exists (
    select 1 from unnest(p_track_ids) selected(id)
    left join public.competition_tracks t on t.id=selected.id and t.event_id=p_event_id
    where t.id is null or (not t.active and not exists (
      select 1 from public.judge_track_scopes s where s.judge_id=p_judge_id and s.track_id=t.id
    ))
  ) then raise exception 'New sponsor scopes must be active tracks for this event'; end if;

  if exists(
    select 1 from public.applications a join auth.users u on u.id=a.user_id
    where a.event_id=p_event_id and a.role='participant' and a.status='submitted'
      and (u.id=v_judge.user_id or (u.email_confirmed_at is not null and lower(btrim(u.email))=v_email))
  ) then
    raise exception 'This email has a participant application for this event and cannot be a judge';
  end if;

  if v_judge.id is not null then
    if v_email is distinct from lower(btrim(v_judge.email::text)) then
      if v_judge.user_id is not null then
        if not exists(select 1 from auth.users u where u.id=v_judge.user_id
          and u.email_confirmed_at is not null and lower(u.email)=v_email) then
          raise exception 'Email must match the verified account already bound to this judge. Deactivate this judge to replace them.';
        end if;
      elsif exists(select 1 from public.judging_assignments a where a.judge_id=v_judge.id) then
        raise exception 'Cannot change an unbound judge email after assignments exist';
      end if;
    end if;
    if p_kind is distinct from v_judge.kind and exists(select 1 from public.judging_assignments a where a.judge_id=v_judge.id) then
      raise exception 'Cannot change judge type after assignments exist';
    end if;
    if exists(select 1 from public.judging_assignments a where a.judge_id=v_judge.id
      and a.track_id is not null and not (a.track_id=any(p_track_ids))) then
      raise exception 'Cannot remove a sponsor track referenced by an assignment';
    end if;
    update public.event_judges set email=v_email,kind=p_kind,active=p_active,capacity=p_capacity
    where id=v_judge.id returning id into v_id;
  else
    insert into public.event_judges(event_id,email,kind,active,capacity)
    values(p_event_id,v_email,p_kind,p_active,p_capacity) returning id into v_id;
  end if;
  delete from public.judge_track_scopes where judge_id=v_id and not (track_id=any(p_track_ids));
  insert into public.judge_track_scopes(judge_id,track_id,event_id)
  select v_id,id,p_event_id from (select distinct unnest(p_track_ids) id) selected
  on conflict (judge_id,track_id) do nothing;
  if not p_active then v_transfer := public.transfer_judge_assignments(p_event_id,v_id); end if;
  return jsonb_build_object('id',v_id,'transfer',v_transfer);
exception when unique_violation then
  raise exception 'This email or account is already on the event judge roster';
end;
$$;

create or replace function public.admin_judge_roster(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',j.id,'event_id',j.event_id,'email',j.email::text,'kind',j.kind,
      'active',j.active,'guest',j.guest,'capacity',j.capacity,'bound',j.user_id is not null,
      'briefing_acknowledged_at',j.briefing_acknowledged_at,
      'has_assignments',exists(select 1 from public.judging_assignments a where a.judge_id=j.id),
      'workload',(select count(*) from public.judging_assignments a where a.judge_id=j.id and not a.cancelled),
      'scopes',coalesce((
        select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active,
          'referenced',exists(select 1 from public.judging_assignments a where a.judge_id=j.id and a.track_id=t.id)) order by t.name,t.id)
        from public.judge_track_scopes s join public.competition_tracks t on t.id=s.track_id
        where s.judge_id=j.id
      ),'[]'::jsonb)
    ) order by j.created_at,j.id)
    from public.event_judges j where j.event_id=p_event_id
  ),'[]'::jsonb);
end;
$$;

create or replace function public.judge_event_summary(p_judge_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('event_id',e.id,'slug',e.slug,'name',e.name,
    'kind',j.kind,'guest',j.guest,'capacity',j.capacity,'enabled',s.enabled,
    'judging_started_at',s.judging_started_at,'judging_close_at',s.judging_close_at,
    'briefing_acknowledged_at',j.briefing_acknowledged_at,
    'tracks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active) order by t.name,t.id)
      from public.judge_track_scopes scope join public.competition_tracks t on t.id=scope.track_id
      where scope.judge_id=j.id),'[]'::jsonb))
  from public.event_judges j join public.events e on e.id=j.event_id
  join public.event_competition_settings s on s.event_id=e.id where j.id=p_judge_id;
$$;

-- Names only, owner first, and only while judges_see_team is on.
create function public.judge_project_view(p_project public.projects,p_settings public.event_competition_settings)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('project',jsonb_build_object('name',p_project.name),
    'answers',case when p_settings.judges_see_answers then public.project_question_answers(p_project) else '[]'::jsonb end,
    'team',case when p_settings.judges_see_team then (
      select jsonb_agg(nullif(btrim(u.full_name),'') order by m.position,m.created_at,m.user_id)
      from (
        select p_project.owner_user_id user_id,0 position,p_project.created_at
        union all
        select c.user_id,1,c.created_at from public.project_collaborators c where c.project_id=p_project.id
      ) m join public.profiles u on u.id=m.user_id
    ) else '[]'::jsonb end);
$$;

create or replace function public.judge_assignment(p_event_slug text,p_assignment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('assignment',public.judge_scorecard(a),
    'criteria',public.event_judging_criteria(e.id)) || public.judge_project_view(p,s)
  from public.events e cross join lateral public.current_judge_assignments(e.id) a
  join public.projects p on p.id=a.project_id
  join public.event_competition_settings s on s.event_id=e.id
  where e.slug=p_event_slug and a.id=p_assignment_id and s.judging_started_at is not null;
$$;

-- Submitted projects an active guest judge of the event may read once submissions close.
create function public.current_guest_projects(p_event_id uuid)
returns setof public.projects language sql stable security definer set search_path = '' as $$
  select p.* from public.projects p
  join public.event_competition_settings s on s.event_id=p.event_id
  join public.event_judges j on j.id=public.current_event_judge_id(p_event_id) and j.guest
  where p.event_id=p_event_id and p.status='submitted' and p.submitted_at is not null
    and s.project_submissions_close_at<=now()
    and p.owner_user_id<>auth.uid()
    and not exists(select 1 from public.project_collaborators c where c.project_id=p.id and c.user_id=auth.uid());
$$;

create function public.judge_guest_projects(p_event_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_event_id uuid;
begin
  select e.id into v_event_id from public.events e where e.slug=p_event_slug;
  if not exists(select 1 from public.event_judges j
    where j.id=public.current_event_judge_id(v_event_id) and j.guest) then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id)
    from public.current_guest_projects(v_event_id) p),'[]'::jsonb);
end;
$$;

create function public.judge_guest_project(p_event_slug text,p_project_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.judge_project_view(p,s)
  from public.events e cross join lateral public.current_guest_projects(e.id) p
  join public.event_competition_settings s on s.event_id=e.id
  where e.slug=p_event_slug and p.id=p_project_id;
$$;

revoke all on function public.transfer_judge_assignments(uuid,uuid),public.judge_project_view(public.projects,public.event_competition_settings),
  public.current_guest_projects(uuid) from public,anon,authenticated;
revoke all on function public.admin_judge_transfer_preview(uuid,uuid),public.admin_set_event_judge_guest(uuid,uuid,boolean),
  public.admin_save_event_judge(uuid,text,text,boolean,integer,uuid[],uuid),
  public.judge_guest_projects(text),public.judge_guest_project(text,uuid) from public,anon,authenticated;
grant execute on function public.admin_judge_transfer_preview(uuid,uuid),public.admin_set_event_judge_guest(uuid,uuid,boolean),
  public.admin_save_event_judge(uuid,text,text,boolean,integer,uuid[],uuid),
  public.judge_guest_projects(text),public.judge_guest_project(text,uuid) to authenticated;

-- One-time: reassign unsubmitted work still held by judges deactivated before this migration.
do $$
declare v_judge record;
begin
  for v_judge in
    select j.event_id,j.id from public.event_judges j
    where not j.active and exists(select 1 from public.judging_assignments a
      where a.judge_id=j.id and not a.cancelled and a.submitted_at is null)
    order by j.event_id,j.id
  loop
    perform public.transfer_judge_assignments(v_judge.event_id,v_judge.id);
  end loop;
end;
$$;
