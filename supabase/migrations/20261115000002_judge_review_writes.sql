create function public.judge_save_review(
  p_event_slug text,p_assignment_id uuid,p_scores jsonb,p_notes text,p_submit boolean default false
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_settings public.event_competition_settings; v_assignment public.judging_assignments; v_judge_id uuid;
begin
  -- Shared serialization order with roster, deadline, cancellation and reassignment.
  select s.* into v_settings from public.event_competition_settings s
  join public.events e on e.id=s.event_id where e.slug=p_event_slug for update of s;
  v_judge_id:=public.current_event_judge_id(v_settings.event_id);
  if v_judge_id is null then raise exception 'Judge access unavailable' using errcode='42501'; end if;
  select * into v_assignment from public.judging_assignments a
  where a.id=p_assignment_id and a.event_id=v_settings.event_id and a.judge_id=v_judge_id for update;
  if not found or v_assignment.cancelled then
    raise exception 'Assignment unavailable' using errcode='42501';
  end if;
  -- Auth email confirmation can change outside the event-lock protocol too.
  if public.current_event_judge_id(v_settings.event_id) is distinct from v_judge_id then
    raise exception 'Judge access unavailable' using errcode='42501';
  end if;
  -- Recheck context, project state and conflicts independently from write-window gates.
  if not exists(
    select 1 from public.projects p join public.event_judges j on j.id=v_judge_id
    where p.id=v_assignment.project_id and p.event_id=v_settings.event_id
      and p.status='submitted' and p.submitted_at is not null and p.owner_user_id<>auth.uid()
      and not exists(select 1 from public.project_collaborators c where c.project_id=p.id and c.user_id=auth.uid())
      and ((v_assignment.track_id is null and j.kind='general') or (v_assignment.track_id is not null and j.kind='sponsor'
        and exists(select 1 from public.judge_track_scopes scope
          join public.competition_tracks t on t.id=scope.track_id and t.event_id=scope.event_id
          join public.project_tracks pt on pt.track_id=t.id and pt.event_id=t.event_id
          where scope.judge_id=j.id and scope.event_id=p.event_id and t.id=v_assignment.track_id and t.active and pt.project_id=p.id)))
  ) then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  if p_submit is null then raise exception 'Choose save draft or submit' using errcode='22023'; end if;
  if v_assignment.submitted_at is not null then
    if p_submit then return public.judge_scorecard(v_assignment); end if;
    raise exception 'Submitted reviews are read-only' using errcode='PT409';
  end if;
  if not v_settings.enabled or v_settings.judging_started_at is null then
    raise exception 'Judging has not started' using errcode='PT409';
  end if;
  -- clock_timestamp(), not transaction-start now(), is essential after waiting.
  if v_settings.judging_close_at is null or clock_timestamp()>=v_settings.judging_close_at then
    raise exception 'Judging has ended. Your inputs are still here; retry after an organizer extends the deadline.' using errcode='PT410';
  end if;
  if p_scores is null or jsonb_typeof(p_scores)<>'object' then
    raise exception 'Provide a score object' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(p_scores) field where field.key not in
    ('creativity_score','technical_score','impact_score','presentation_score') or
    (field.value<>'null'::jsonb and (jsonb_typeof(field.value)<>'number' or field.value::text !~ '^[1-5]$'))) then
    raise exception 'Scores must be integers from 1 to 5' using errcode='22023';
  end if;
  if p_notes is null or length(p_notes)>5000 then
    raise exception 'Notes must be 5000 characters or fewer' using errcode='22023';
  end if;
  if p_submit and exists(select 1 from unnest(array['creativity_score','technical_score','impact_score','presentation_score']) key
    where p_scores->>key is null) then
    raise exception 'All four scores are required to submit' using errcode='22023';
  end if;
  update public.judging_assignments set
    creativity_score=(p_scores->>'creativity_score')::smallint,
    technical_score=(p_scores->>'technical_score')::smallint,
    impact_score=(p_scores->>'impact_score')::smallint,
    presentation_score=(p_scores->>'presentation_score')::smallint,
    notes=p_notes,submitted_at=case when p_submit then clock_timestamp() else null end
  where id=v_assignment.id returning * into v_assignment;
  return public.judge_scorecard(v_assignment);
end;
$$;
revoke all on function public.judge_save_review(text,uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.judge_save_review(text,uuid,jsonb,text,boolean) to authenticated;
