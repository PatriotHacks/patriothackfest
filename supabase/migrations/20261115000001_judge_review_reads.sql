-- Narrow judge reads. Raw projects, scorecards, and roster tables stay private.
create function public.current_judge_assignments(p_event_id uuid)
returns setof public.judging_assignments
language sql stable security definer set search_path = '' as $$
  select a.* from public.judging_assignments a
  join public.event_competition_settings s on s.event_id=a.event_id
  join public.event_judges j on j.id=a.judge_id and j.event_id=a.event_id
  join public.projects p on p.id=a.project_id and p.event_id=a.event_id
  where a.event_id=p_event_id and a.judge_id=public.current_event_judge_id(p_event_id)
    and not a.cancelled and s.enabled and s.judging_started_at is not null
    and p.status='submitted' and p.submitted_at is not null
    and p.owner_user_id<>auth.uid()
    and not exists(select 1 from public.project_collaborators c where c.project_id=p.id and c.user_id=auth.uid())
    and ((a.track_id is null and j.kind='general') or (a.track_id is not null and j.kind='sponsor'
      and exists(select 1 from public.judge_track_scopes scope
        join public.competition_tracks t on t.id=scope.track_id and t.event_id=scope.event_id
        join public.project_tracks pt on pt.track_id=t.id and pt.event_id=t.event_id
        where scope.judge_id=j.id and scope.event_id=a.event_id and t.id=a.track_id and t.active and pt.project_id=p.id)));
$$;

create function public.judge_scorecard(p_assignment public.judging_assignments)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',p_assignment.id,'track_id',p_assignment.track_id,
    'track_name',(select t.name from public.competition_tracks t where t.id=p_assignment.track_id),
    'creativity_score',p_assignment.creativity_score,'technical_score',p_assignment.technical_score,
    'impact_score',p_assignment.impact_score,'presentation_score',p_assignment.presentation_score,
    'notes',p_assignment.notes,'total_score',p_assignment.total_score,'submitted_at',p_assignment.submitted_at);
$$;

create function public.judge_queue(p_event_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_event_id uuid;
begin
  select e.id into v_event_id from public.events e where e.slug=p_event_slug;
  if public.current_event_judge_id(v_event_id) is null then return null; end if;
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

create function public.judge_assignment(p_event_slug text,p_assignment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('assignment',public.judge_scorecard(a),
    'project',jsonb_build_object('name',p.name,'summary',p.summary,'description',p.description,
      'technologies',p.technologies,'repository_url',p.repository_url,'demo_url',p.demo_url,'video_url',p.video_url))
  from public.events e cross join lateral public.current_judge_assignments(e.id) a
  join public.projects p on p.id=a.project_id
  where e.slug=p_event_slug and a.id=p_assignment_id;
$$;

revoke all on function public.current_judge_assignments(uuid),public.judge_scorecard(public.judging_assignments),
  public.judge_queue(text),public.judge_assignment(text,uuid) from public,anon,authenticated;
grant execute on function public.judge_queue(text),public.judge_assignment(text,uuid) to authenticated;
