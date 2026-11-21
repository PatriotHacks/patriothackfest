-- Greedily moves untouched work from the most-loaded active, non-guest judges to the
-- least-loaded eligible ones until no move narrows the gap. Load counts every
-- non-cancelled assignment. Moves cancel and reinsert like reassignment, so the
-- old pair is preserved and never handed back.
create function public.rebalance_judge_assignments(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_giver record; v_assignment_id uuid; v_project_id uuid; v_track_id uuid; v_to uuid;
  v_moves jsonb := '[]'::jsonb;
begin
  loop
    v_to := null;
    for v_giver in
      select j.id,load.n from public.event_judges j
      cross join lateral (
        select count(*)::integer n from public.judging_assignments a where a.judge_id=j.id and not a.cancelled
      ) load
      where j.event_id=p_event_id and j.active and not j.guest
      order by load.n desc,j.id
    loop
      select a.id,a.project_id,a.track_id,c.judge_id into v_assignment_id,v_project_id,v_track_id,v_to
      from public.judging_assignments a
      cross join lateral public.assignment_candidates(p_event_id,a.project_id,a.track_id) c
      where a.event_id=p_event_id and a.judge_id=v_giver.id and not a.cancelled and a.submitted_at is null
        and public.assignment_untouched(a.id) and c.workload<=v_giver.n-2
      order by c.workload,c.judge_id,a.created_at desc,a.id limit 1;
      if v_to is not null then
        update public.judging_assignments set cancelled=true where id=v_assignment_id;
        insert into public.judging_assignments(event_id,judge_id,project_id,track_id)
        values(p_event_id,v_to,v_project_id,v_track_id);
        v_moves := v_moves||jsonb_build_object('from',v_giver.id,'to',v_to);
        exit;
      end if;
    end loop;
    exit when v_to is null;
  end loop;
  return jsonb_build_object(
    'moved',jsonb_array_length(v_moves),
    'transfers',coalesce((
      select jsonb_agg(jsonb_build_object('from_judge_id',f.id,'from_email',f.email::text,
        'to_judge_id',t.id,'to_email',t.email::text,'count',m.n) order by m.n desc,f.email,t.email)
      from (
        select (move->>'from')::uuid from_id,(move->>'to')::uuid to_id,count(*)::integer n
        from jsonb_array_elements(v_moves) move group by 1,2
      ) m join public.event_judges f on f.id=m.from_id join public.event_judges t on t.id=m.to_id
    ),'[]'::jsonb),
    'spread',coalesce((
      select max(load.n)-min(load.n) from public.event_judges j
      cross join lateral (
        select count(*)::integer n from public.judging_assignments a where a.judge_id=j.id and not a.cancelled
      ) load
      where j.event_id=p_event_id and j.active and not j.guest
    ),0));
end;
$$;

-- Runs the real rebalance in a subtransaction and rolls it back, so the preview
-- always matches what apply would do from the same state.
create function public.admin_rebalance_assignments_preview(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_plan jsonb;
begin
  perform public.lock_assignment_event(p_event_id);
  begin
    v_plan := public.rebalance_judge_assignments(p_event_id);
    raise exception 'rebalance preview' using errcode='PR000';
  exception when sqlstate 'PR000' then null;
  end;
  return v_plan;
end;
$$;

create function public.admin_rebalance_assignments(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_assignment_event(p_event_id);
  return public.rebalance_judge_assignments(p_event_id);
end;
$$;

revoke all on function public.rebalance_judge_assignments(uuid) from public,anon,authenticated;
revoke all on function public.admin_rebalance_assignments_preview(uuid),public.admin_rebalance_assignments(uuid)
  from public,anon,authenticated;
grant execute on function public.admin_rebalance_assignments_preview(uuid),public.admin_rebalance_assignments(uuid)
  to authenticated;
