-- Organizer-defined scoring criteria. The rubric is private: no client grants,
-- reads only through organizer and active-judge RPCs.
create table public.judging_criteria (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position integer not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id)
);
create index judging_criteria_event_position_idx on public.judging_criteria (event_id, position);

revoke all on table public.judging_criteria from public, anon, authenticated;
alter table public.judging_criteria enable row level security;

create trigger judging_criteria_updated before update on public.judging_criteria
for each row execute function public.set_updated_at();

-- Same order as settings saves and Start judging: event, then settings.
create function public.lock_judging_criteria(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_started_at timestamptz;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  select judging_started_at into v_started_at from public.event_competition_settings
  where event_id = p_event_id for update;
  if v_started_at is not null then raise exception 'Criteria are locked because judging has started'; end if;
end;
$$;

create function public.event_judging_criteria(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'description', c.description)
    order by c.position, c.id), '[]'::jsonb)
  from public.judging_criteria c where c.event_id = p_event_id;
$$;

create function public.admin_judging_criteria(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  return public.event_judging_criteria(p_event_id);
end;
$$;

create function public.judge_criteria(p_event_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_event_id uuid;
begin
  select e.id into v_event_id from public.events e where e.slug = p_event_slug;
  if public.current_event_judge_id(v_event_id) is null then return null; end if;
  return public.event_judging_criteria(v_event_id);
end;
$$;

create function public.admin_save_judging_criterion(
  p_event_id uuid, p_name text, p_description text, p_criterion_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.lock_judging_criteria(p_event_id);
  if p_criterion_id is null then
    insert into public.judging_criteria (event_id, position, name, description)
    values (p_event_id,
      coalesce((select max(position) from public.judging_criteria where event_id = p_event_id), 0) + 1,
      btrim(p_name), coalesce(btrim(p_description), ''))
    returning id into v_id;
  else
    update public.judging_criteria set name = btrim(p_name), description = coalesce(btrim(p_description), '')
    where id = p_criterion_id and event_id = p_event_id returning id into v_id;
    if not found then raise exception 'Criterion not found for this event'; end if;
  end if;
  return v_id;
end;
$$;

create function public.admin_delete_judging_criterion(p_event_id uuid, p_criterion_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_judging_criteria(p_event_id);
  delete from public.judging_criteria where id = p_criterion_id and event_id = p_event_id;
  if not found then raise exception 'Criterion not found for this event'; end if;
end;
$$;

create function public.admin_reorder_judging_criteria(p_event_id uuid, p_criterion_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_judging_criteria(p_event_id);
  if p_criterion_ids is null
    or cardinality(p_criterion_ids) <> (select count(distinct id) from unnest(p_criterion_ids) id)
    or (select coalesce(array_agg(c.id order by c.id), '{}') from public.judging_criteria c
        where c.event_id = p_event_id)
      <> (select coalesce(array_agg(id order by id), '{}') from unnest(p_criterion_ids) id) then
    raise exception 'Criteria order must list every criterion exactly once';
  end if;
  update public.judging_criteria c set position = o.ordinality
  from unnest(p_criterion_ids) with ordinality o (id, ordinality)
  where c.id = o.id and c.position <> o.ordinality;
end;
$$;

-- Starting judging locks the rubric, so an empty rubric would make judging impossible.
create or replace function public.admin_start_judging(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_settings public.event_competition_settings;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.events where id = p_event_id for update;
  select * into v_settings from public.event_competition_settings where event_id = p_event_id for update;
  if not found then raise exception 'Configure competition settings first'; end if;
  if v_settings.judging_started_at is not null then return; end if;
  if not v_settings.enabled then raise exception 'Enable this competition first'; end if;
  if v_settings.project_submissions_close_at is null or v_settings.project_submissions_close_at > clock_timestamp() then
    raise exception 'Submissions must be closed before judging starts';
  end if;
  if v_settings.judging_close_at is null or v_settings.judging_close_at <= clock_timestamp() then
    raise exception 'Judging deadline must be in the future';
  end if;
  if not exists (select 1 from public.judging_criteria where event_id = p_event_id) then
    raise exception 'Add at least one judging criterion before starting judging';
  end if;
  update public.event_competition_settings set judging_started_at = clock_timestamp() where event_id = p_event_id;
end;
$$;

revoke all on function public.lock_judging_criteria(uuid), public.event_judging_criteria(uuid),
  public.admin_judging_criteria(uuid), public.judge_criteria(text),
  public.admin_save_judging_criterion(uuid, text, text, uuid),
  public.admin_delete_judging_criterion(uuid, uuid),
  public.admin_reorder_judging_criteria(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_judging_criteria(uuid), public.judge_criteria(text),
  public.admin_save_judging_criterion(uuid, text, text, uuid),
  public.admin_delete_judging_criterion(uuid, uuid),
  public.admin_reorder_judging_criteria(uuid, uuid[]) to authenticated;
