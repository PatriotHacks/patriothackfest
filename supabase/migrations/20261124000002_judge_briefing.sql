alter table public.event_judges add column briefing_acknowledged_at timestamptz;

create or replace function public.judge_event_summary(p_judge_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('event_id',e.id,'slug',e.slug,'name',e.name,
    'kind',j.kind,'capacity',j.capacity,'enabled',s.enabled,
    'judging_started_at',s.judging_started_at,'judging_close_at',s.judging_close_at,
    'briefing_acknowledged_at',j.briefing_acknowledged_at,
    'tracks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active) order by t.name,t.id)
      from public.judge_track_scopes scope join public.competition_tracks t on t.id=scope.track_id
      where scope.judge_id=j.id),'[]'::jsonb))
  from public.event_judges j join public.events e on e.id=j.event_id
  join public.event_competition_settings s on s.event_id=e.id where j.id=p_judge_id;
$$;

-- Idempotent: the first acknowledgement time is kept.
create function public.judge_acknowledge_briefing(p_event_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_event_id uuid; v_judge_id uuid;
begin
  -- Same lock order as roster changes and review saves.
  select s.event_id into v_event_id from public.event_competition_settings s
  join public.events e on e.id=s.event_id where e.slug=p_event_slug for update of s;
  v_judge_id:=public.current_event_judge_id(v_event_id);
  if v_judge_id is null then raise exception 'Judge access unavailable' using errcode='42501'; end if;
  update public.event_judges set briefing_acknowledged_at=clock_timestamp()
  where id=v_judge_id and briefing_acknowledged_at is null;
  return public.judge_event_summary(v_judge_id);
end;
$$;

create or replace function public.admin_judge_roster(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',j.id,'event_id',j.event_id,'email',j.email::text,'kind',j.kind,
      'active',j.active,'capacity',j.capacity,'bound',j.user_id is not null,
      'briefing_acknowledged_at',j.briefing_acknowledged_at,
      'has_assignments',exists(select 1 from public.judging_assignments a where a.judge_id=j.id),
      'workload',(select count(*) from public.judging_assignments a where a.judge_id=j.id and not a.cancelled),
      'scopes',coalesce((
        select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active,
          'referenced',exists(select 1 from public.judging_assignments a where a.judge_id=j.id and a.track_id=t.id)) order by t.name,t.id)
        from public.judge_track_scopes s join public.competition_tracks t on t.id=s.track_id
        where s.judge_id=j.id
      ),'[]'::jsonb)
    ) order by j.created_at,j.id)
    from public.event_judges j where j.event_id=p_event_id
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.judge_acknowledge_briefing(text) from public,anon,authenticated;
grant execute on function public.judge_acknowledge_briefing(text) to authenticated;
