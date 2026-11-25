-- Per-judge review completion for organizers. Counts only; no scores or notes.
create function public.admin_judge_progress(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  return (
    with counts as (
      select j.id judge_id,j.email::text email,j.active,j.guest,
        count(*) filter (where a.submitted_at is not null)::integer completed,
        count(*) filter (where a.submitted_at is null and not public.assignment_untouched(a.id))::integer in_progress,
        count(*) filter (where a.submitted_at is null and public.assignment_untouched(a.id))::integer not_started
      from public.event_judges j
      join public.judging_assignments a on a.judge_id=j.id and a.event_id=j.event_id and not a.cancelled
      where j.event_id=p_event_id
      group by j.id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'judge_id',judge_id,'email',email,'active',active,
      'completed',completed,'in_progress',in_progress,'not_started',not_started
    ) order by email,judge_id),'[]'::jsonb)
    from counts
    where (active and not guest) or (not active and in_progress+not_started>0)
  );
end;
$$;

revoke all on function public.admin_judge_progress(uuid) from public,anon,authenticated;
grant execute on function public.admin_judge_progress(uuid) to authenticated;
