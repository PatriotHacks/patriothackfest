-- Assignments only exist after judging starts, so a judge removed before then has none.
create function public.admin_delete_event_judge(p_event_id uuid,p_judge_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_started_at timestamptz;
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select judging_started_at into v_started_at from public.event_competition_settings
  where event_id=p_event_id for update;
  if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
  if v_started_at is not null then
    raise exception 'Judging has started; deactivate this judge instead';
  end if;
  delete from public.judge_track_scopes where judge_id=p_judge_id and event_id=p_event_id;
  delete from public.event_judges where id=p_judge_id and event_id=p_event_id;
  if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
end;
$$;

revoke all on function public.admin_delete_event_judge(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_event_judge(uuid,uuid) to authenticated;
