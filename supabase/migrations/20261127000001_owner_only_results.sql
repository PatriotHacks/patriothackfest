-- Scores, averages, and rankings are owner-only. Coverage and assignment reads stay organizer-level.
create or replace function public.admin_judging_results(
  p_event_id uuid, p_track_id uuid default null, p_page integer default 1
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_target integer;
  v_track_name text;
begin
  if not public.has_admin_level('owner') then
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

revoke all on function public.admin_judging_results(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_judging_results(uuid, uuid, integer) to authenticated;
