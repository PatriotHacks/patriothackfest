-- Organizer-only contextual results. Assignment coverage is deliberately separate
-- from submitted-review coverage; judge activation and deadlines do not erase scores.
create function public.admin_judging_results(
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
    with totals as (
      select p.id project_id, p.name project_name,
        count(a.id)::integer completed, sum(a.total_score) score_sum,
        avg(a.total_score) average_total
      from public.projects p
      left join public.judging_assignments a on a.project_id = p.id
        and a.event_id = p.event_id and a.track_id is not distinct from p_track_id
        and not a.cancelled and a.submitted_at is not null
      where p.event_id = p_event_id and p.status = 'submitted' and p.submitted_at is not null
        and (p_track_id is null or exists (
          select 1 from public.project_tracks pt
          where pt.project_id = p.id and pt.event_id = p_event_id and pt.track_id = p_track_id
        ))
      group by p.id, p.name
    ), flagged as (
      select project_id, project_name, completed, average_total,
        completed < v_target insufficient_coverage,
        -- Reduced fractions compare exact means, not rounded display values.
        average_total is not null and count(*) over (
          partition by score_sum / gcd(score_sum, completed::bigint),
            completed::bigint / gcd(score_sum, completed::bigint)
        ) > 1 tied
      from totals
    ), page as materialized (
      select * from flagged
      order by average_total desc nulls last, project_name, project_id
      limit 51 offset ((p_page::bigint - 1) * 50)
    )
    select jsonb_build_object(
      'track_id', p_track_id, 'track_name', v_track_name, 'target', v_target,
      'projects', coalesce((select jsonb_agg(to_jsonb(r)
        order by average_total desc nulls last, project_name, project_id)
        from (select * from page
          order by average_total desc nulls last, project_name, project_id limit 50) r), '[]'::jsonb),
      'has_more', (select count(*) > 50 from page)
    )
  );
end;
$$;

revoke all on function public.admin_judging_results(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_judging_results(uuid, uuid, integer) to authenticated;
