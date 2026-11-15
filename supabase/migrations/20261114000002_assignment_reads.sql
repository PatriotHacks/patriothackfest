-- Private allocation primitives shared by generation and manual management.
create function public.assignment_untouched(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a.submitted_at is null and a.creativity_score is null and a.technical_score is null
    and a.impact_score is null and a.presentation_score is null and a.notes = ''
  from public.judging_assignments a where a.id = p_assignment_id;
$$;

create index judging_assignments_coverage_idx on public.judging_assignments(event_id, project_id, track_id);

create function public.assignment_targets(p_event_id uuid)
returns table(project_id uuid, project_name text, track_id uuid, track_name text, target integer, assigned integer, missing integer)
language sql stable security definer set search_path = '' as $$
  with contexts as (
    select p.id project_id, p.name project_name, null::uuid track_id, null::text track_name,
      s.general_reviews_per_project target
    from public.projects p join public.event_competition_settings s on s.event_id=p.event_id
    where p.event_id=p_event_id and p.status='submitted'
    union all
    select p.id,p.name,t.id,t.name,t.reviews_per_project
    from public.projects p join public.project_tracks pt on pt.project_id=p.id
    join public.competition_tracks t on t.id=pt.track_id
    where p.event_id=p_event_id and p.status='submitted' and t.active
  )
  select c.*, counts.n, greatest(c.target-counts.n,0)
  from contexts c cross join lateral (
    select count(*)::integer n from public.judging_assignments a
    where a.event_id=p_event_id and a.project_id=c.project_id
      and a.track_id is not distinct from c.track_id and not a.cancelled
  ) counts;
$$;

create function public.assignment_candidates(p_event_id uuid,p_project_id uuid,p_track_id uuid)
returns table(judge_id uuid,email text,workload integer,capacity integer)
language sql stable security definer set search_path = '' as $$
  select j.id,j.email::text,load.n,j.capacity
  from public.event_judges j join public.projects p on p.event_id=j.event_id
  cross join lateral (
    select count(*)::integer n from public.judging_assignments a where a.judge_id=j.id and not a.cancelled
  ) load
  where j.event_id=p_event_id and p.id=p_project_id and p.status='submitted' and j.active
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

-- One snapshot for event-wide totals plus independently bounded context/assignment pages.
create function public.admin_assignment_overview(
  p_event_id uuid,p_coverage_page integer default 1,p_assignment_page integer default 1,
  p_project_id uuid default null,p_status text default 'all'
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_coverage_page is null or p_coverage_page<1 or p_assignment_page is null or p_assignment_page<1 then
    raise exception 'Invalid assignment page' using errcode='22023';
  end if;
  if p_status is null or p_status not in ('all','untouched','in_progress','submitted','cancelled') then
    raise exception 'Invalid assignment status' using errcode='22023';
  end if;
  return (
    with targets as materialized (select * from public.assignment_targets(p_event_id)),
    coverage_page as (
      select * from targets where p_project_id is null or project_id=p_project_id
      order by project_id,track_id nulls first limit 51 offset ((p_coverage_page::bigint-1)*50)
    ), assignments as (
      select a.id,a.project_id,p.name project_name,a.judge_id,j.email::text judge_email,j.active judge_active,
        a.track_id,t.name track_name,
        case when a.cancelled then 'cancelled' when a.submitted_at is not null then 'submitted'
          when public.assignment_untouched(a.id) then 'untouched' else 'in_progress' end status
      from public.judging_assignments a join public.projects p on p.id=a.project_id
      join public.event_judges j on j.id=a.judge_id left join public.competition_tracks t on t.id=a.track_id
      where a.event_id=p_event_id and (p_project_id is null or a.project_id=p_project_id)
    ), assignment_page as (
      select * from assignments where p_status='all' or status=p_status
      order by id limit 51 offset ((p_assignment_page::bigint-1)*50)
    )
    select jsonb_build_object(
      'missing',coalesce((select sum(missing) from targets),0),
      'coverage',coalesce((select jsonb_agg(to_jsonb(c) order by project_id,track_id nulls first)
        from (select * from coverage_page order by project_id,track_id nulls first limit 50)c),'[]'::jsonb),
      'coverage_has_more',(select count(*)>50 from coverage_page),
      'assignments',coalesce((select jsonb_agg(to_jsonb(a) order by id)
        from (select * from assignment_page order by id limit 50)a),'[]'::jsonb),
      'assignments_has_more',(select count(*)>50 from assignment_page),
      'judges',coalesce((select jsonb_agg(jsonb_build_object(
        'id',j.id,'email',j.email::text,'active',j.active,'capacity',j.capacity,
        'workload',(select count(*) from public.judging_assignments a where a.judge_id=j.id and not a.cancelled),
        'unfinished',(select count(*) from public.judging_assignments a where a.judge_id=j.id and not a.cancelled and a.submitted_at is null)
      ) order by j.id) from public.event_judges j where j.event_id=p_event_id),'[]'::jsonb)
    )
  );
end;
$$;

create function public.admin_assignment_candidates(p_event_id uuid,p_project_id uuid,p_track_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by workload,judge_id)
    from public.assignment_candidates(p_event_id,p_project_id,p_track_id)c),'[]'::jsonb);
end;
$$;

revoke all on function public.assignment_untouched(uuid),public.assignment_targets(uuid),
  public.assignment_candidates(uuid,uuid,uuid),public.admin_assignment_overview(uuid,integer,integer,uuid,text),
  public.admin_assignment_candidates(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_assignment_overview(uuid,integer,integer,uuid,text),
  public.admin_assignment_candidates(uuid,uuid,uuid) to authenticated;
