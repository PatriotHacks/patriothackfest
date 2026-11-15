-- Participant reads are narrowly scoped RPCs. Project tables remain default-deny.
create function public.project_user_is_eligible(p_event_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    join public.application_decisions d on d.application_id = a.id
    where a.event_id = p_event_id and a.user_id = p_user_id
      and a.submitted_at is not null and d.decision = 'accepted'
  );
$$;

create function public.project_is_accessible(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.projects p where p.id = p_project_id
      and (p.owner_user_id = auth.uid() or exists (
        select 1 from public.project_collaborators c
        where c.project_id = p.id and c.user_id = auth.uid()
      ))
  );
$$;

-- Shared mutation guard. Lock settings before project, matching Start judging.
create function public.lock_participant_project(p_project_id uuid, p_roster_only boolean default false)
returns public.projects language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_settings public.event_competition_settings;
  v_project public.projects;
begin
  if auth.uid() is null then raise exception 'Sign in to manage a project' using errcode = '42501'; end if;
  select event_id into v_event_id from public.projects
  where id = p_project_id and owner_user_id = auth.uid();
  if not found then raise exception 'Project not found' using errcode = 'PT404'; end if;
  select * into v_settings from public.event_competition_settings where event_id = v_event_id for update;
  select * into v_project from public.projects where id = p_project_id and owner_user_id = auth.uid() for update;
  if not found then raise exception 'Project not found' using errcode = 'PT404'; end if;
  if not v_settings.enabled then raise exception 'Project submissions are disabled'; end if;
  if v_settings.judging_started_at is not null then raise exception 'Projects are locked because judging has started'; end if;
  if v_settings.project_submissions_close_at is not null and clock_timestamp() >= v_settings.project_submissions_close_at then
    raise exception 'Project submissions are closed';
  end if;
  if not p_roster_only and clock_timestamp() < v_settings.project_submissions_open_at then
    raise exception 'Project submissions have not opened yet';
  end if;
  if v_project.status = 'withdrawn' then raise exception 'This project has been withdrawn'; end if;
  if not public.project_user_is_eligible(v_event_id, auth.uid()) then
    raise exception 'A submitted and accepted application for this event is required' using errcode = '42501';
  end if;
  return v_project;
end;
$$;

create function public.participant_project_events()
returns table (
  event_id uuid, slug text, name text, enabled boolean,
  project_submissions_open_at timestamptz, project_submissions_close_at timestamptz,
  judging_started_at timestamptz, eligible boolean
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.slug, e.name, s.enabled, s.project_submissions_open_at,
    s.project_submissions_close_at, s.judging_started_at,
    public.project_user_is_eligible(e.id, auth.uid())
  from public.events e
  join public.event_competition_settings s on s.event_id = e.id
  where auth.uid() is not null and (
    (s.enabled and public.project_user_is_eligible(e.id, auth.uid()))
    or exists (select 1 from public.projects p where p.event_id = e.id and public.project_is_accessible(p.id))
  )
  order by e.slug desc;
$$;

create function public.participant_projects(p_event_id uuid)
returns setof public.projects language sql stable security definer set search_path = '' as $$
  select p.* from public.projects p
  where p.event_id = p_event_id and public.project_is_accessible(p.id)
  order by p.created_at desc, p.id;
$$;

create function public.participant_project_detail(p_project_id uuid, p_event_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'project', to_jsonb(p),
    'collaborators', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', c.user_id, 'full_name', u.full_name) order by c.created_at, c.user_id)
      from public.project_collaborators c join public.profiles u on u.id = c.user_id
      where c.project_id = p.id
    ), '[]'::jsonb),
    'selected_tracks', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'active', t.active) order by t.name, t.id)
      from public.project_tracks pt join public.competition_tracks t on t.id = pt.track_id
      where pt.project_id = p.id
    ), '[]'::jsonb),
    'available_tracks', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'description', t.description, 'sponsor', t.sponsor) order by t.name, t.id)
      from public.competition_tracks t join public.event_competition_settings s on s.event_id = t.event_id
      where t.event_id = p.event_id and t.active and s.enabled
    ), '[]'::jsonb)
  ) from public.projects p
  where p.id = p_project_id and p.event_id = p_event_id and public.project_is_accessible(p.id);
$$;

create function public.participant_create_project(p_event_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_settings public.event_competition_settings; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to create a project' using errcode = '42501'; end if;
  select * into v_settings from public.event_competition_settings where event_id = p_event_id for update;
  if not found or not v_settings.enabled then raise exception 'Project submissions are disabled'; end if;
  if v_settings.judging_started_at is not null then raise exception 'Projects are locked because judging has started'; end if;
  if v_settings.project_submissions_close_at is not null and clock_timestamp() >= v_settings.project_submissions_close_at then
    raise exception 'Project submissions are closed';
  end if;
  if not public.project_user_is_eligible(p_event_id, auth.uid()) then
    raise exception 'A submitted and accepted application for this event is required' using errcode = '42501';
  end if;
  insert into public.projects (event_id, owner_user_id) values (p_event_id, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.project_user_is_eligible(uuid, uuid), public.project_is_accessible(uuid),
  public.lock_participant_project(uuid, boolean), public.participant_project_events(),
  public.participant_projects(uuid), public.participant_project_detail(uuid, uuid), public.participant_create_project(uuid)
from public, anon, authenticated;
grant execute on function public.participant_project_events(), public.participant_projects(uuid),
  public.participant_project_detail(uuid, uuid), public.participant_create_project(uuid) to authenticated;
