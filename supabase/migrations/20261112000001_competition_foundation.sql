-- Shared contract for submissions (Person B) and judging (Person C).
-- Only settings/tracks are usable through this migration. Other tables default
-- to no client access until their owners add the domain RPCs and RLS policies.
create table public.event_competition_settings (
  event_id uuid primary key references public.events (id),
  enabled boolean not null default false,
  project_submissions_open_at timestamptz,
  project_submissions_close_at timestamptz,
  judging_started_at timestamptz,
  judging_close_at timestamptz,
  general_reviews_per_project integer not null default 3 check (general_reviews_per_project between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or (project_submissions_open_at is not null and judging_close_at is not null)),
  check (project_submissions_close_at is null or (project_submissions_open_at is not null and project_submissions_close_at > project_submissions_open_at)),
  check (judging_close_at is null or project_submissions_open_at is null or judging_close_at > project_submissions_open_at),
  check (judging_close_at is null or project_submissions_close_at is null or judging_close_at > project_submissions_close_at)
);

create table public.competition_tracks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_competition_settings (event_id),
  name text not null check (length(btrim(name)) between 1 and 120),
  sponsor text check (length(sponsor) <= 120),
  description text check (length(description) <= 2000),
  reviews_per_project integer not null default 1 check (reviews_per_project between 1 and 20),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id)
);
create unique index competition_tracks_event_name_idx on public.competition_tracks (event_id, lower(btrim(name)));

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_competition_settings (event_id),
  owner_user_id uuid not null references public.profiles (id),
  name text not null default '' check (length(name) <= 120),
  summary text not null default '' check (length(summary) <= 300),
  description text not null default '' check (length(description) <= 10000),
  technologies text not null default '' check (length(technologies) <= 1000),
  repository_url text check (length(repository_url) <= 2048),
  demo_url text check (length(demo_url) <= 2048),
  video_url text check (length(video_url) <= 2048),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'withdrawn')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id),
  check (status <> 'submitted' or submitted_at is not null)
);
create index projects_owner_event_idx on public.projects (owner_user_id, event_id);
create index projects_event_status_idx on public.projects (event_id, status);

create table public.project_collaborators (
  project_id uuid not null,
  event_id uuid not null,
  user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (project_id, event_id) references public.projects (id, event_id)
);
create index project_collaborators_user_idx on public.project_collaborators (user_id);

create table public.project_tracks (
  project_id uuid not null,
  track_id uuid not null,
  event_id uuid not null,
  primary key (project_id, track_id),
  unique (project_id, track_id, event_id),
  foreign key (project_id, event_id) references public.projects (id, event_id),
  foreign key (track_id, event_id) references public.competition_tracks (id, event_id)
);

create table public.event_judges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_competition_settings (event_id),
  email extensions.citext not null check (length(btrim(email::text)) between 3 and 320),
  user_id uuid references public.profiles (id),
  kind text not null default 'general' check (kind in ('general', 'sponsor')),
  active boolean not null default true,
  capacity integer not null default 20 check (capacity between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id),
  unique (event_id, email),
  unique (event_id, user_id)
);

create table public.judge_track_scopes (
  judge_id uuid not null,
  track_id uuid not null,
  event_id uuid not null,
  primary key (judge_id, track_id),
  unique (judge_id, track_id, event_id),
  foreign key (judge_id, event_id) references public.event_judges (id, event_id),
  foreign key (track_id, event_id) references public.competition_tracks (id, event_id)
);

create table public.judging_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  judge_id uuid not null,
  project_id uuid not null,
  -- NULL means general judging; otherwise this is a sponsor-track scorecard.
  track_id uuid,
  creativity_score smallint check (creativity_score between 1 and 5),
  technical_score smallint check (technical_score between 1 and 5),
  impact_score smallint check (impact_score between 1 and 5),
  presentation_score smallint check (presentation_score between 1 and 5),
  total_score smallint generated always as (creativity_score + technical_score + impact_score + presentation_score) stored,
  notes text not null default '' check (length(notes) <= 5000),
  submitted_at timestamptz,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (judge_id, project_id, track_id),
  foreign key (judge_id, event_id) references public.event_judges (id, event_id),
  foreign key (project_id, event_id) references public.projects (id, event_id),
  foreign key (project_id, track_id, event_id) references public.project_tracks (project_id, track_id, event_id),
  foreign key (judge_id, track_id, event_id) references public.judge_track_scopes (judge_id, track_id, event_id),
  check (submitted_at is null or (creativity_score is not null and technical_score is not null and impact_score is not null and presentation_score is not null))
);
create index judging_assignments_event_idx on public.judging_assignments (event_id);

-- Explicitly deny all access before granting only the reads needed for settings.
revoke all on table public.event_competition_settings, public.competition_tracks,
  public.projects, public.project_collaborators, public.project_tracks,
  public.event_judges, public.judge_track_scopes, public.judging_assignments
from public, anon, authenticated;

alter table public.event_competition_settings enable row level security;
alter table public.competition_tracks enable row level security;
alter table public.projects enable row level security;
alter table public.project_collaborators enable row level security;
alter table public.project_tracks enable row level security;
alter table public.event_judges enable row level security;
alter table public.judge_track_scopes enable row level security;
alter table public.judging_assignments enable row level security;

grant select on public.event_competition_settings, public.competition_tracks to authenticated;
create policy "Organizers or enabled events expose competition settings"
on public.event_competition_settings for select to authenticated
using ((select public.has_admin_level('organizer')) or enabled);
create policy "Organizers or active tracks on enabled events"
on public.competition_tracks for select to authenticated
using ((select public.has_admin_level('organizer')) or (active and exists (
  select 1 from public.event_competition_settings s where s.event_id = competition_tracks.event_id and s.enabled
)));

-- Serialize project/roster/track edits with Start judging. Domain RPCs added by
-- Person B must also check eligibility and submission opening/closing times.
create function public.prevent_judging_content_changes()
returns trigger language plpgsql set search_path = '' security definer as $$
declare
  v_event_id uuid;
  v_started_at timestamptz;
begin
  if tg_op = 'UPDATE' and new.event_id is distinct from old.event_id then
    raise exception 'Competition records cannot move between events';
  end if;
  if tg_op = 'DELETE' then v_event_id := old.event_id; else v_event_id := new.event_id; end if;
  select judging_started_at into v_started_at from public.event_competition_settings
  where event_id = v_event_id for update;
  if v_started_at is not null then
    raise exception 'Project content and tracks are locked after judging starts';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.prevent_judging_content_changes() from public, anon, authenticated;

create trigger projects_freeze before insert or update or delete on public.projects
for each row execute function public.prevent_judging_content_changes();
create trigger collaborators_freeze before insert or update or delete on public.project_collaborators
for each row execute function public.prevent_judging_content_changes();
create trigger project_tracks_freeze before insert or update or delete on public.project_tracks
for each row execute function public.prevent_judging_content_changes();
create trigger competition_tracks_freeze before insert or update or delete on public.competition_tracks
for each row execute function public.prevent_judging_content_changes();

create trigger competition_settings_updated before update on public.event_competition_settings
for each row execute function public.set_updated_at();
create trigger competition_tracks_updated before update on public.competition_tracks
for each row execute function public.set_updated_at();
create trigger projects_updated before update on public.projects
for each row execute function public.set_updated_at();
create trigger event_judges_updated before update on public.event_judges
for each row execute function public.set_updated_at();
create trigger judging_assignments_updated before update on public.judging_assignments
for each row execute function public.set_updated_at();

create function public.admin_save_competition_settings(
  p_event_id uuid, p_enabled boolean, p_open_at timestamptz default null,
  p_close_at timestamptz default null, p_judging_close_at timestamptz default null, p_general_reviews integer default 3
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_settings public.event_competition_settings;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  -- Lock the event too, so first-time creation and Start judging cannot race.
  perform 1 from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  select * into v_settings from public.event_competition_settings where event_id = p_event_id for update;
  if v_settings.judging_started_at is not null and (
    p_enabled is distinct from v_settings.enabled or
    p_open_at is distinct from v_settings.project_submissions_open_at or
    p_close_at is distinct from v_settings.project_submissions_close_at
  ) then raise exception 'Submission settings are locked after judging starts'; end if;
  insert into public.event_competition_settings (event_id, enabled, project_submissions_open_at, project_submissions_close_at, judging_close_at, general_reviews_per_project)
  values (p_event_id, p_enabled, p_open_at, p_close_at, p_judging_close_at, p_general_reviews)
  on conflict (event_id) do update set enabled = excluded.enabled,
    project_submissions_open_at = excluded.project_submissions_open_at,
    project_submissions_close_at = excluded.project_submissions_close_at,
    judging_close_at = excluded.judging_close_at,
    general_reviews_per_project = excluded.general_reviews_per_project;
end;
$$;

create function public.admin_save_competition_track(
  p_event_id uuid, p_name text, p_sponsor text, p_description text,
  p_reviews integer, p_active boolean, p_track_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_track_id is null then
    insert into public.competition_tracks (event_id, name, sponsor, description, reviews_per_project, active)
    values (p_event_id, btrim(p_name), nullif(btrim(p_sponsor), ''), nullif(btrim(p_description), ''), p_reviews, p_active)
    returning id into v_id;
  else
    update public.competition_tracks set name = btrim(p_name), sponsor = nullif(btrim(p_sponsor), ''),
      description = nullif(btrim(p_description), ''), reviews_per_project = p_reviews, active = p_active
    where id = p_track_id and event_id = p_event_id returning id into v_id;
    if not found then raise exception 'Track not found for this event'; end if;
  end if;
  return v_id;
end;
$$;

create function public.admin_start_judging(p_event_id uuid)
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
  update public.event_competition_settings set judging_started_at = clock_timestamp() where event_id = p_event_id;
end;
$$;

revoke all on function public.admin_save_competition_settings(uuid, boolean, timestamptz, timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.admin_save_competition_track(uuid, text, text, text, integer, boolean, uuid) from public, anon, authenticated;
revoke all on function public.admin_start_judging(uuid) from public, anon, authenticated;
grant execute on function public.admin_save_competition_settings(uuid, boolean, timestamptz, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.admin_save_competition_track(uuid, text, text, text, integer, boolean, uuid) to authenticated;
grant execute on function public.admin_start_judging(uuid) to authenticated;

-- Install Fall defaults without opening submissions automatically. Future events
-- remain unconfigured, and rerunning the seed does not overwrite saved dates.
insert into public.event_competition_settings (event_id, project_submissions_open_at, judging_close_at)
select id, '2026-11-15 00:00:00-05'::timestamptz, '2026-11-21 00:00:00-05'::timestamptz
from public.events where slug = 'fall-2026'
on conflict (event_id) do nothing;
