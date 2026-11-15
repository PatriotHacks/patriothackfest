create function public.admin_add_assignment(p_event_id uuid,p_project_id uuid,p_judge_id uuid,p_track_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.lock_assignment_event(p_event_id);
  if not exists(select 1 from public.assignment_targets(p_event_id)t where t.project_id=p_project_id
    and t.track_id is not distinct from p_track_id and t.missing>0) then
    raise exception 'This project context has no missing assignments';
  end if;
  if not exists(select 1 from public.assignment_candidates(p_event_id,p_project_id,p_track_id)c where c.judge_id=p_judge_id) then
    raise exception 'Judge is no longer eligible for this assignment';
  end if;
  insert into public.judging_assignments(event_id,project_id,judge_id,track_id)
  values(p_event_id,p_project_id,p_judge_id,p_track_id) returning id into v_id;
  return v_id;
end;
$$;

create function public.admin_cancel_assignment(p_event_id uuid,p_assignment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_assignment public.judging_assignments;
begin
  perform public.lock_assignment_event(p_event_id);
  select * into v_assignment from public.judging_assignments where id=p_assignment_id and event_id=p_event_id for update;
  if not found then raise exception 'Assignment not found for this event' using errcode='PT404'; end if;
  if v_assignment.cancelled then return; end if;
  if not public.assignment_untouched(v_assignment.id) then raise exception 'Only untouched assignments can be cancelled or reassigned'; end if;
  update public.judging_assignments set cancelled=true where id=v_assignment.id;
end;
$$;

create function public.admin_reassign_assignment(p_event_id uuid,p_assignment_id uuid,p_judge_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_assignment public.judging_assignments; v_id uuid;
begin
  perform public.lock_assignment_event(p_event_id);
  select * into v_assignment from public.judging_assignments where id=p_assignment_id and event_id=p_event_id for update;
  if not found then raise exception 'Assignment not found for this event' using errcode='PT404'; end if;
  if v_assignment.cancelled then raise exception 'Assignment is already cancelled; refresh before continuing'; end if;
  if not public.assignment_untouched(v_assignment.id) then raise exception 'Only untouched assignments can be cancelled or reassigned'; end if;
  -- Preserve the old pair. An exception below rolls back this cancellation too.
  update public.judging_assignments set cancelled=true where id=v_assignment.id;
  if not exists(select 1 from public.assignment_candidates(p_event_id,v_assignment.project_id,v_assignment.track_id)c where c.judge_id=p_judge_id) then
    raise exception 'Judge is no longer eligible for this assignment';
  end if;
  insert into public.judging_assignments(event_id,project_id,judge_id,track_id)
  values(p_event_id,v_assignment.project_id,p_judge_id,v_assignment.track_id) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_add_assignment(uuid,uuid,uuid,uuid),public.admin_cancel_assignment(uuid,uuid),
  public.admin_reassign_assignment(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_add_assignment(uuid,uuid,uuid,uuid),public.admin_cancel_assignment(uuid,uuid),
  public.admin_reassign_assignment(uuid,uuid,uuid) to authenticated;
