-- All assignment writers and roster changes serialize on this settings row.
create function public.lock_assignment_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_settings public.event_competition_settings;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into v_settings from public.event_competition_settings where event_id=p_event_id for update;
  if not found then raise exception 'Configure competition settings first'; end if;
  if not v_settings.enabled or v_settings.judging_started_at is null then
    raise exception 'Start judging before managing assignments';
  end if;
end;
$$;

create function public.admin_generate_assignments(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_context record; v_judge_id uuid; v_slot integer; v_created integer := 0; v_missing bigint;
begin
  perform public.lock_assignment_event(p_event_id);
  -- Scarcity is measured once at generation start, including conflicts and
  -- existing capacity. Candidate loads are reevaluated after each insertion.
  for v_context in
    select t.*, (select count(*) from public.assignment_candidates(p_event_id,t.project_id,t.track_id)) pool
    from public.assignment_targets(p_event_id)t where t.missing>0
    order by (t.track_id is null),
      case when t.track_id is not null then (select count(*) from public.assignment_candidates(p_event_id,t.project_id,t.track_id)) end,
      t.track_id,t.project_id
  loop
    for v_slot in 1..v_context.missing loop
      select c.judge_id into v_judge_id from public.assignment_candidates(p_event_id,v_context.project_id,v_context.track_id)c
      order by c.workload,c.judge_id limit 1;
      if v_judge_id is null then exit; end if;
      insert into public.judging_assignments(event_id,judge_id,project_id,track_id)
      values(p_event_id,v_judge_id,v_context.project_id,v_context.track_id);
      v_created := v_created+1;
    end loop;
  end loop;
  select coalesce(sum(t.missing),0) into v_missing from public.assignment_targets(p_event_id)t;
  return jsonb_build_object('created',v_created,'missing',v_missing);
end;
$$;
revoke all on function public.lock_assignment_event(uuid),public.admin_generate_assignments(uuid) from public,anon,authenticated;
grant execute on function public.admin_generate_assignments(uuid) to authenticated;
