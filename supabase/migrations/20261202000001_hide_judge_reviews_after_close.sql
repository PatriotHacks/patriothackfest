-- Once judging closes, judges keep only their event summary and documents. Assignments, scores,
-- notes, project details, guest projects and the rubric disappear; an extension restores them.
create function public.judging_closed(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.event_competition_settings s
    where s.event_id=p_event_id and s.judging_close_at<=clock_timestamp());
$$;

revoke all on function public.judging_closed(uuid) from public,anon,authenticated;

create or replace function public.current_judge_assignments(p_event_id uuid)
returns setof public.judging_assignments
language sql stable security definer set search_path = '' as $$
  select a.* from public.judging_assignments a
  join public.event_competition_settings s on s.event_id=a.event_id
  join public.event_judges j on j.id=a.judge_id and j.event_id=a.event_id
  join public.projects p on p.id=a.project_id and p.event_id=a.event_id
  where a.event_id=p_event_id and a.judge_id=public.current_event_judge_id(p_event_id)
    and not a.cancelled and s.enabled and s.judging_started_at is not null
    and not public.judging_closed(p_event_id)
    and p.status='submitted' and p.submitted_at is not null
    and p.owner_user_id<>auth.uid()
    and not exists(select 1 from public.project_collaborators c where c.project_id=p.id and c.user_id=auth.uid())
    and ((a.track_id is null and j.kind='general') or (a.track_id is not null and j.kind='sponsor'
      and exists(select 1 from public.judge_track_scopes scope
        join public.competition_tracks t on t.id=scope.track_id and t.event_id=scope.event_id
        join public.project_tracks pt on pt.track_id=t.id and pt.event_id=t.event_id
        where scope.judge_id=j.id and scope.event_id=a.event_id and t.id=a.track_id and t.active and pt.project_id=p.id)));
$$;

create or replace function public.current_guest_projects(p_event_id uuid)
returns setof public.projects language sql stable security definer set search_path = '' as $$
  select p.* from public.projects p
  join public.event_competition_settings s on s.event_id=p.event_id
  join public.event_judges j on j.id=public.current_event_judge_id(p_event_id) and j.guest
  where p.event_id=p_event_id and p.status='submitted' and p.submitted_at is not null
    and s.project_submissions_close_at<=now()
    and not public.judging_closed(p_event_id)
    and p.owner_user_id<>auth.uid()
    and not exists(select 1 from public.project_collaborators c where c.project_id=p.id and c.user_id=auth.uid());
$$;

create or replace function public.judge_queue(p_event_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_event_id uuid;
begin
  select e.id into v_event_id from public.events e where e.slug=p_event_slug;
  if public.current_event_judge_id(v_event_id) is null or public.judging_closed(v_event_id) then return null; end if;
  return (
    with own as materialized(select * from public.current_judge_assignments(v_event_id))
    select jsonb_build_object('total',count(*),'completed',count(*) filter(where a.submitted_at is not null),
      'assignments',coalesce(jsonb_agg(jsonb_build_object(
        'id',a.id,'project_name',p.name,'track_id',a.track_id,'track_name',t.name,
        'submitted_at',a.submitted_at,'in_progress',not public.assignment_untouched(a.id))
        order by a.created_at,a.id),'[]'::jsonb))
    from own a join public.projects p on p.id=a.project_id
    left join public.competition_tracks t on t.id=a.track_id
  );
end;
$$;

create or replace function public.judge_guest_projects(p_event_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_event_id uuid;
begin
  select e.id into v_event_id from public.events e where e.slug=p_event_slug;
  if not exists(select 1 from public.event_judges j
    where j.id=public.current_event_judge_id(v_event_id) and j.guest) or public.judging_closed(v_event_id) then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id)
    from public.current_guest_projects(v_event_id) p),'[]'::jsonb);
end;
$$;

create or replace function public.judge_criteria(p_event_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_event_id uuid;
begin
  select e.id into v_event_id from public.events e
  join public.event_competition_settings s on s.event_id = e.id
  where e.slug = p_event_slug and s.judging_started_at is not null;
  if public.current_event_judge_id(v_event_id) is null or public.judging_closed(v_event_id) then return null; end if;
  return public.event_judging_criteria(v_event_id);
end;
$$;
