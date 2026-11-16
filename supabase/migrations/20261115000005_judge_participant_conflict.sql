-- A person cannot judge an event they submitted a participant application to.
create or replace function public.admin_save_event_judge(
  p_event_id uuid,p_email text,p_kind text,p_active boolean,p_capacity integer,
  p_track_ids uuid[] default '{}',p_judge_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_judge public.event_judges; v_id uuid; v_email text;
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  -- Future assignment generation must take this same settings lock first.
  perform 1 from public.event_competition_settings where event_id=p_event_id for update;
  if not found then raise exception 'Save competition settings before adding judges'; end if;
  if p_judge_id is not null then
    select * into v_judge from public.event_judges where id=p_judge_id and event_id=p_event_id for update;
    if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
  end if;
  v_email := lower(btrim(coalesce(p_email,'')));
  if length(v_email)>320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid judge email';
  end if;
  if p_kind is null or p_kind not in ('general','sponsor') then raise exception 'Choose general or sponsor judge'; end if;
  if p_active is null then raise exception 'Choose an active status'; end if;
  if p_capacity is null or p_capacity not between 1 and 1000 then raise exception 'Capacity must be between 1 and 1000'; end if;
  if p_track_ids is null or array_position(p_track_ids,null) is not null then raise exception 'Choose valid sponsor tracks'; end if;
  if p_kind='general' and cardinality(p_track_ids)>0 then raise exception 'General judges cannot have sponsor tracks'; end if;
  if p_kind='sponsor' and cardinality(p_track_ids)=0 then raise exception 'Select at least one sponsor track'; end if;
  if exists (
    select 1 from unnest(p_track_ids) selected(id)
    left join public.competition_tracks t on t.id=selected.id and t.event_id=p_event_id
    where t.id is null or (not t.active and not exists (
      select 1 from public.judge_track_scopes s where s.judge_id=p_judge_id and s.track_id=t.id
    ))
  ) then raise exception 'New sponsor scopes must be active tracks for this event'; end if;

  if exists(
    select 1 from public.applications a join auth.users u on u.id=a.user_id
    where a.event_id=p_event_id and a.role='participant' and a.status='submitted'
      and (u.id=v_judge.user_id or (u.email_confirmed_at is not null and lower(btrim(u.email))=v_email))
  ) then
    raise exception 'This email has a participant application for this event and cannot be a judge';
  end if;

  if v_judge.id is not null then
    if v_email is distinct from lower(btrim(v_judge.email::text)) then
      if v_judge.user_id is not null then
        if not exists(select 1 from auth.users u where u.id=v_judge.user_id
          and u.email_confirmed_at is not null and lower(u.email)=v_email) then
          raise exception 'Email must match the verified account already bound to this judge. Deactivate this judge to replace them.';
        end if;
      elsif exists(select 1 from public.judging_assignments a where a.judge_id=v_judge.id) then
        raise exception 'Cannot change an unbound judge email after assignments exist';
      end if;
    end if;
    if p_kind is distinct from v_judge.kind and exists(select 1 from public.judging_assignments a where a.judge_id=v_judge.id) then
      raise exception 'Cannot change judge type after assignments exist';
    end if;
    if exists(select 1 from public.judging_assignments a where a.judge_id=v_judge.id
      and a.track_id is not null and not (a.track_id=any(p_track_ids))) then
      raise exception 'Cannot remove a sponsor track referenced by an assignment';
    end if;
    update public.event_judges set email=v_email,kind=p_kind,active=p_active,capacity=p_capacity
    where id=v_judge.id returning id into v_id;
  else
    insert into public.event_judges(event_id,email,kind,active,capacity)
    values(p_event_id,v_email,p_kind,p_active,p_capacity) returning id into v_id;
  end if;
  -- Preserve retained rows: even cancelled/historical assignments reference them.
  delete from public.judge_track_scopes where judge_id=v_id and not (track_id=any(p_track_ids));
  insert into public.judge_track_scopes(judge_id,track_id,event_id)
  select v_id,id,p_event_id from (select distinct unnest(p_track_ids) id) selected
  on conflict (judge_id,track_id) do nothing;
  return v_id;
exception when unique_violation then
  raise exception 'This email or account is already on the event judge roster';
end;
$$;

revoke all on function public.admin_save_event_judge(uuid,text,text,boolean,integer,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.admin_save_event_judge(uuid,text,text,boolean,integer,uuid[],uuid) to authenticated;
