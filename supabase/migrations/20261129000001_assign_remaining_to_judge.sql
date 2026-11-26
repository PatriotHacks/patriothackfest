-- Why a judge may not take a project context, or null if they may. Shared by
-- assignment_candidates and assign_remaining_to_judge.
create function public.assignment_ineligibility(p_judge_id uuid,p_project_id uuid,p_track_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when not ((p_track_id is null and j.kind='general') or (p_track_id is not null and j.kind='sponsor'
      and exists(select 1 from public.project_tracks pt join public.competition_tracks t on t.id=pt.track_id
        where pt.project_id=p.id and pt.track_id=p_track_id and t.active)
      and exists(select 1 from public.judge_track_scopes s where s.judge_id=j.id and s.track_id=p_track_id)))
      then 'ineligible_track'
    when exists (
      select 1 from (
        select p.owner_user_id user_id union all
        select c.user_id from public.project_collaborators c where c.project_id=p.id
      ) member left join auth.users u on u.id=member.user_id
      where member.user_id=j.user_id or (u.email_confirmed_at is not null and lower(u.email)=lower(j.email::text))
    ) then 'conflict'
  end
  from public.event_judges j join public.projects p on p.event_id=j.event_id
  where j.id=p_judge_id and p.id=p_project_id;
$$;

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
    and public.assignment_ineligibility(j.id,p.id,p_track_id) is null
    and not exists(select 1 from public.judging_assignments a where a.judge_id=j.id
      and a.project_id=p.id and a.track_id is not distinct from p_track_id)
  order by load.n,j.id;
$$;

-- Moves untouched work held by other judges to one judge, up to their capacity,
-- starting with the projects that have the fewest submitted reviews. A cancelled
-- untouched pair the judge held before is reactivated instead of reinserted.
create function public.assign_remaining_to_judge(p_event_id uuid,p_judge_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_judge public.event_judges; v_source record; v_held public.judging_assignments; v_load integer; v_reason text;
  v_moves jsonb := '[]'::jsonb;
  v_skipped jsonb := '{"conflict":0,"ineligible_track":0,"capacity":0,"previously_held":0}'::jsonb;
begin
  select * into v_judge from public.event_judges where id=p_judge_id and event_id=p_event_id for update;
  if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
  if not v_judge.active or v_judge.guest then raise exception 'Only active, non-guest judges can receive assignments'; end if;
  select count(*) into v_load from public.judging_assignments where judge_id=p_judge_id and not cancelled;
  for v_source in
    select a.id,a.judge_id,a.project_id,a.track_id from public.judging_assignments a
    where a.event_id=p_event_id and a.judge_id<>p_judge_id and not a.cancelled and public.assignment_untouched(a.id)
    order by (select count(*) from public.judging_assignments d
      where d.project_id=a.project_id and not d.cancelled and d.submitted_at is not null),a.created_at,a.id
  loop
    v_reason := public.assignment_ineligibility(p_judge_id,v_source.project_id,v_source.track_id);
    select * into v_held from public.judging_assignments
    where judge_id=p_judge_id and project_id=v_source.project_id and track_id is not distinct from v_source.track_id;
    if v_reason is null and v_held.id is not null and not (v_held.cancelled and public.assignment_untouched(v_held.id)) then
      v_reason := 'previously_held';
    end if;
    if v_reason is null and v_load>=v_judge.capacity then v_reason := 'capacity'; end if;
    if v_reason is not null then
      v_skipped := jsonb_set(v_skipped,array[v_reason],to_jsonb((v_skipped->>v_reason)::integer+1));
      continue;
    end if;
    update public.judging_assignments set cancelled=true where id=v_source.id;
    if v_held.id is null then
      insert into public.judging_assignments(event_id,judge_id,project_id,track_id)
      values(p_event_id,p_judge_id,v_source.project_id,v_source.track_id);
    else
      update public.judging_assignments set cancelled=false where id=v_held.id;
    end if;
    v_load := v_load+1;
    v_moves := v_moves||to_jsonb(v_source.judge_id);
  end loop;
  return jsonb_build_object(
    'moved',jsonb_array_length(v_moves),
    'skipped',v_skipped,
    'sources',coalesce((
      select jsonb_agg(jsonb_build_object('judge_id',j.id,'email',j.email::text,'count',m.n) order by m.n desc,j.email)
      from (select (move#>>'{}')::uuid judge_id,count(*)::integer n from jsonb_array_elements(v_moves) move group by 1) m
      join public.event_judges j on j.id=m.judge_id
    ),'[]'::jsonb));
end;
$$;

-- Runs the real move in a subtransaction and rolls it back, so the preview
-- always matches what apply would do from the same state.
create function public.admin_assign_remaining_to_judge_preview(p_event_id uuid,p_judge_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_plan jsonb;
begin
  perform public.lock_assignment_event(p_event_id);
  begin
    v_plan := public.assign_remaining_to_judge(p_event_id,p_judge_id);
    raise exception 'assign remaining preview' using errcode='PR000';
  exception when sqlstate 'PR000' then null;
  end;
  return v_plan;
end;
$$;

create function public.admin_assign_remaining_to_judge(p_event_id uuid,p_judge_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_assignment_event(p_event_id);
  return public.assign_remaining_to_judge(p_event_id,p_judge_id);
end;
$$;

revoke all on function public.assignment_ineligibility(uuid,uuid,uuid),public.assign_remaining_to_judge(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.admin_assign_remaining_to_judge_preview(uuid,uuid),public.admin_assign_remaining_to_judge(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.admin_assign_remaining_to_judge_preview(uuid,uuid),public.admin_assign_remaining_to_judge(uuid,uuid)
  to authenticated;
