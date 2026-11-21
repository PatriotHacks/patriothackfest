-- Per-criterion scores replace the four fixed score columns. No scorecards
-- existed when this shipped, so the old columns are dropped without migration.
alter table public.judging_assignments drop column total_score;
alter table public.judging_assignments
  drop column creativity_score, drop column technical_score,
  drop column impact_score, drop column presentation_score;
alter table public.judging_assignments add unique (id, event_id);

create table public.judging_scores (
  assignment_id uuid not null,
  criterion_id uuid not null,
  event_id uuid not null,
  score numeric(2,1) not null check (score between 1 and 5),
  primary key (assignment_id, criterion_id),
  foreign key (assignment_id, event_id) references public.judging_assignments (id, event_id) on delete cascade,
  foreign key (criterion_id, event_id) references public.judging_criteria (id, event_id)
);
create index judging_scores_criterion_idx on public.judging_scores (criterion_id);

revoke all on table public.judging_scores from public, anon, authenticated;
alter table public.judging_scores enable row level security;

create or replace function public.assignment_untouched(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a.submitted_at is null and a.notes = ''
    and not exists(select 1 from public.judging_scores s where s.assignment_id = a.id)
  from public.judging_assignments a where a.id = p_assignment_id;
$$;

create or replace function public.judge_scorecard(p_assignment public.judging_assignments)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',p_assignment.id,'track_id',p_assignment.track_id,
    'track_name',(select t.name from public.competition_tracks t where t.id=p_assignment.track_id),
    'scores',coalesce((select jsonb_object_agg(s.criterion_id,s.score)
      from public.judging_scores s where s.assignment_id=p_assignment.id),'{}'::jsonb),
    'notes',p_assignment.notes,'submitted_at',p_assignment.submitted_at);
$$;

-- Names only, owner first, and only while judges_see_team is on.
create or replace function public.judge_assignment(p_event_slug text,p_assignment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('assignment',public.judge_scorecard(a),
    'project',jsonb_build_object('name',p.name),
    'criteria',public.event_judging_criteria(e.id),
    'answers',case when s.judges_see_answers then public.project_question_answers(p) else '[]'::jsonb end,
    'team',case when s.judges_see_team then (
      select jsonb_agg(nullif(btrim(u.full_name),'') order by m.position,m.created_at,m.user_id)
      from (
        select p.owner_user_id user_id,0 position,p.created_at
        union all
        select c.user_id,1,c.created_at from public.project_collaborators c where c.project_id=p.id
      ) m join public.profiles u on u.id=m.user_id
    ) else '[]'::jsonb end)
  from public.events e cross join lateral public.current_judge_assignments(e.id) a
  join public.projects p on p.id=a.project_id
  join public.event_competition_settings s on s.event_id=e.id
  where e.slug=p_event_slug and a.id=p_assignment_id and s.judging_started_at is not null;
$$;

-- Submitted reviews stay editable until the deadline. Once submitted, every save
-- must be complete and keeps the first submitted_at; updated_at tracks edits.
create or replace function public.judge_save_review(
  p_event_slug text,p_assignment_id uuid,p_scores jsonb,p_notes text,p_submit boolean default false
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_settings public.event_competition_settings; v_assignment public.judging_assignments;
  v_judge public.event_judges; v_judge_id uuid; v_final boolean;
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
  if not v_settings.enabled or v_settings.judging_started_at is null then
    raise exception 'Judging has not started' using errcode='PT409';
  end if;
  -- clock_timestamp(), not transaction-start now(), is essential after waiting.
  if v_settings.judging_close_at is null or clock_timestamp()>=v_settings.judging_close_at then
    raise exception 'Judging has ended. Your inputs are still here; retry after an organizer extends the deadline.' using errcode='PT410';
  end if;
  select * into v_judge from public.event_judges where id=v_judge_id;
  if v_judge.briefing_acknowledged_at is null then
    raise exception 'Read the judging briefing before scoring' using errcode='PT409';
  end if;
  if p_scores is null or jsonb_typeof(p_scores)<>'object' then
    raise exception 'Provide a score object' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(p_scores) field where not exists(
    select 1 from public.judging_criteria c where c.event_id=v_settings.event_id and c.id::text=field.key)) then
    raise exception 'Unknown judging criterion' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(p_scores) field where field.value<>'null'::jsonb and (
    jsonb_typeof(field.value)<>'number' or field.value::text::numeric not between 1 and 5
    or field.value::text::numeric<>round(field.value::text::numeric,1))) then
    raise exception 'Scores must be from 1.0 to 5.0 in steps of 0.1' using errcode='22023';
  end if;
  if p_notes is null or length(p_notes)>5000 then
    raise exception 'Notes must be 5000 characters or fewer' using errcode='22023';
  end if;
  v_final:=p_submit or v_assignment.submitted_at is not null;
  if v_final then
    if not exists(select 1 from public.judging_criteria c where c.event_id=v_settings.event_id) then
      raise exception 'This event has no judging criteria yet' using errcode='22023';
    end if;
    if exists(select 1 from public.judging_criteria c where c.event_id=v_settings.event_id
      and jsonb_typeof(p_scores->(c.id::text)) is distinct from 'number') then
      raise exception 'Score every criterion to submit' using errcode='22023';
    end if;
  end if;
  delete from public.judging_scores where assignment_id=v_assignment.id;
  insert into public.judging_scores(assignment_id,criterion_id,event_id,score)
  select v_assignment.id,field.key::uuid,v_settings.event_id,field.value::text::numeric
  from jsonb_each(p_scores) field where field.value<>'null'::jsonb;
  update public.judging_assignments set notes=p_notes,
    submitted_at=case when v_final then coalesce(submitted_at,clock_timestamp()) end
  where id=v_assignment.id returning * into v_assignment;
  return public.judge_scorecard(v_assignment);
end;
$$;

-- A judge's score is the equal-weight mean of their criterion scores; a project's
-- result is the mean of those across submitted reviews. Every submitted review
-- scores every criterion (criteria lock when judging starts), so the result also
-- equals sum(scores)/count(scores). Ties compare that exact reduced fraction.
create or replace function public.admin_judging_results(
  p_event_id uuid, p_track_id uuid default null, p_page integer default 1
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_target integer;
  v_track_name text;
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_page is null or p_page < 1 then
    raise exception 'Invalid results page' using errcode = '22023';
  end if;
  if p_track_id is null then
    select s.general_reviews_per_project into v_target
    from public.event_competition_settings s where s.event_id = p_event_id;
  else
    select t.reviews_per_project, t.name into v_target, v_track_name
    from public.competition_tracks t
    where t.id = p_track_id and t.event_id = p_event_id and t.active;
    if not found then
      raise exception 'Results track unavailable for this event' using errcode = '22023';
    end if;
  end if;

  return (
    with reviews as (
      select a.project_id, avg(s.score) average, sum(s.score) score_sum, count(s.score) score_count
      from public.judging_assignments a
      join public.judging_scores s on s.assignment_id = a.id
      where a.event_id = p_event_id and a.track_id is not distinct from p_track_id
        and not a.cancelled and a.submitted_at is not null
      group by a.project_id, a.id
    ), totals as (
      select p.id project_id, p.name project_name,
        count(r.project_id)::integer completed, avg(r.average) average_score,
        (sum(r.score_sum) * 10)::bigint tenths, sum(r.score_count)::bigint score_count
      from public.projects p
      left join reviews r on r.project_id = p.id
      where p.event_id = p_event_id and p.status = 'submitted' and p.submitted_at is not null
        and (p_track_id is null or exists (
          select 1 from public.project_tracks pt
          where pt.project_id = p.id and pt.event_id = p_event_id and pt.track_id = p_track_id
        ))
      group by p.id, p.name
    ), flagged as (
      select project_id, project_name, completed, average_score,
        completed < v_target insufficient_coverage,
        average_score is not null and count(*) over (
          partition by tenths / gcd(tenths, score_count), score_count / gcd(tenths, score_count)
        ) > 1 tied
      from totals
    ), page as materialized (
      select * from flagged
      order by average_score desc nulls last, project_name, project_id
      limit 51 offset ((p_page::bigint - 1) * 50)
    )
    select jsonb_build_object(
      'track_id', p_track_id, 'track_name', v_track_name, 'target', v_target,
      'projects', coalesce((select jsonb_agg(to_jsonb(r)
        order by average_score desc nulls last, project_name, project_id)
        from (select * from page
          order by average_score desc nulls last, project_name, project_id limit 50) r), '[]'::jsonb),
      'has_more', (select count(*) > 50 from page)
    )
  );
end;
$$;
