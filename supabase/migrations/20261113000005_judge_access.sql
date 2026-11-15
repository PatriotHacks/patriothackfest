-- These helpers are private to trusted database operations. Never trust a
-- profile email, user metadata, or a caller-provided email/user ID for binding.
create function public.current_verified_judge_email()
returns text language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id=auth.uid() and u.email_confirmed_at is not null
    and lower(u.email)=lower(auth.jwt()->>'email')
    and auth.jwt()->'amr' @> '[{"method":"otp"}]'::jsonb;
$$;

create function public.current_event_judge_id(p_event_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select j.id from public.event_judges j
  where j.event_id=p_event_id and j.active and j.user_id=auth.uid()
    and lower(j.email::text)=public.current_verified_judge_email();
$$;

create function public.judge_event_summary(p_judge_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('event_id',e.id,'slug',e.slug,'name',e.name,
    'kind',j.kind,'capacity',j.capacity,'enabled',s.enabled,
    'judging_started_at',s.judging_started_at,'judging_close_at',s.judging_close_at,
    'tracks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active) order by t.name,t.id)
      from public.judge_track_scopes scope join public.competition_tracks t on t.id=scope.track_id
      where scope.judge_id=j.id),'[]'::jsonb))
  from public.event_judges j join public.events e on e.id=j.event_id
  join public.event_competition_settings s on s.event_id=e.id where j.id=p_judge_id;
$$;

create function public.judge_events()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.judge_event_summary(j.id) order by e.slug desc),'[]'::jsonb)
  from public.event_judges j join public.events e on e.id=j.event_id
  where j.active and lower(j.email::text)=public.current_verified_judge_email()
    and (j.user_id is null or j.user_id=auth.uid())
    and not exists(select 1 from public.event_judges other
      where other.event_id=j.event_id and other.user_id=auth.uid() and other.id<>j.id);
$$;

create function public.judge_event_access(p_event_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text; v_event_id uuid; v_judge public.event_judges;
begin
  v_email:=public.current_verified_judge_email();
  if v_email is null then return null; end if;
  -- Same lock order as roster changes and future assignment generation.
  select s.event_id into v_event_id from public.event_competition_settings s
  join public.events e on e.id=s.event_id where e.slug=p_event_slug for update of s;
  if not found then return null; end if;
  select * into v_judge from public.event_judges j
  where j.event_id=v_event_id and j.active and lower(j.email::text)=v_email
    and (j.user_id is null or j.user_id=auth.uid()) for update;
  if not found then return null; end if;
  if exists(select 1 from public.event_judges other where other.event_id=v_event_id
    and other.user_id=auth.uid() and other.id<>v_judge.id) then return null; end if;
  if v_judge.user_id is null then
    update public.event_judges set user_id=auth.uid() where id=v_judge.id;
  end if;
  return public.judge_event_summary(v_judge.id);
end;
$$;

revoke all on function public.current_verified_judge_email(), public.current_event_judge_id(uuid),
  public.judge_event_summary(uuid), public.judge_events(), public.judge_event_access(text) from public,anon,authenticated;
grant execute on function public.judge_events(), public.judge_event_access(text) to authenticated;
