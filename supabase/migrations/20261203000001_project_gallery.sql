-- Public project gallery: organizers publish an event, choose which question answers are public,
-- and record awards. Anonymous visitors read only through the gallery_* RPCs below.
alter table public.event_competition_settings add column gallery_published boolean not null default false;

alter table public.project_questions
  add column gallery_public boolean not null default false,
  add column gallery_summary boolean not null default false,
  add constraint project_questions_gallery_summary_check
    check (not gallery_summary or (gallery_public and type in ('short_text', 'long_text')));
create unique index project_questions_gallery_summary_idx on public.project_questions (event_id)
  where gallery_summary and archived_at is null;

-- Gallery flags stay editable after judging starts; every other question change is still frozen.
drop trigger project_questions_freeze on public.project_questions;
create trigger project_questions_freeze before insert or delete on public.project_questions
for each row execute function public.prevent_judging_content_changes();
create trigger project_questions_freeze_update before update on public.project_questions
for each row when ((to_jsonb(old) - '{gallery_public,gallery_summary}'::text[])
  is distinct from (to_jsonb(new) - '{gallery_public,gallery_summary}'::text[]))
execute function public.prevent_judging_content_changes();

-- A volatile default is evaluated per row, so existing projects each get their own value.
-- This is the permanent shared gallery order for projects without awards.
alter table public.projects add column gallery_sort_key double precision not null default random();

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_competition_settings (event_id),
  name text not null check (length(btrim(name)) between 1 and 120),
  track_id uuid,
  rank integer not null check (rank between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (id, event_id),
  foreign key (track_id, event_id) references public.competition_tracks (id, event_id)
);
create index awards_event_rank_idx on public.awards (event_id, rank);

create table public.project_awards (
  award_id uuid not null,
  project_id uuid not null,
  event_id uuid not null,
  primary key (award_id, project_id),
  foreign key (award_id, event_id) references public.awards (id, event_id) on delete cascade,
  foreign key (project_id, event_id) references public.projects (id, event_id) on delete cascade
);
create index project_awards_project_idx on public.project_awards (project_id);

revoke all on table public.awards, public.project_awards from public, anon, authenticated;
alter table public.awards enable row level security;
alter table public.project_awards enable row level security;

create function public.admin_set_gallery_published(p_event_id uuid, p_value boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_value is null then raise exception 'Choose whether the gallery is published' using errcode = '22023'; end if;
  update public.event_competition_settings set gallery_published = p_value where event_id = p_event_id;
  if not found then raise exception 'Configure competition settings first'; end if;
end;
$$;

-- Marking a summary question moves the summary off any other question of the event.
create function public.admin_set_project_question_gallery(
  p_event_id uuid, p_question_id uuid, p_public boolean, p_summary boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_question public.project_questions;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_public is null or p_summary is null then raise exception 'Choose gallery visibility' using errcode = '22023'; end if;
  perform 1 from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  select * into v_question from public.project_questions
  where id = p_question_id and event_id = p_event_id and archived_at is null for update;
  if not found then raise exception 'Question not found for this event' using errcode = 'PT404'; end if;
  if p_public and v_question.type in ('file', 'email') then
    raise exception 'File and email answers are never shown in the gallery' using errcode = '22023';
  end if;
  if p_summary and not p_public then
    raise exception 'The gallery summary must be shown in the gallery' using errcode = '22023';
  end if;
  if p_summary and v_question.type not in ('short_text', 'long_text') then
    raise exception 'Only a text question can be the gallery summary' using errcode = '22023';
  end if;
  if p_summary then
    update public.project_questions set gallery_summary = false
    where event_id = p_event_id and gallery_summary and id <> p_question_id;
  end if;
  update public.project_questions set gallery_public = p_public, gallery_summary = p_summary
  where id = p_question_id;
end;
$$;

drop function public.admin_project_questions(uuid);

create function public.admin_project_questions(p_event_id uuid)
returns table (
  id uuid, event_id uuid, "position" integer, label text, help_text text, required boolean,
  max_length integer, length_unit public.text_length_unit, type public.field_type, options jsonb, validation jsonb, archived_options jsonb,
  archived_at timestamptz, created_at timestamptz, updated_at timestamptz, answered boolean,
  gallery_public boolean, gallery_summary boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query
  select q.id, q.event_id, q.position, q.label, q.help_text, q.required, q.max_length, q.length_unit, q.type, q.options,
    q.validation, q.archived_options, q.archived_at, q.created_at, q.updated_at, public.project_question_answered(q.event_id, q.id),
    q.gallery_public, q.gallery_summary
  from public.project_questions q
  where q.event_id = p_event_id and q.archived_at is null order by q.position, q.id;
end;
$$;

-- New track scopes must be active; an award keeps an existing inactive track.
create function public.admin_save_award(
  p_event_id uuid, p_name text, p_rank integer, p_track_id uuid default null, p_award_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_current_track uuid;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.event_competition_settings where event_id = p_event_id for update;
  if not found then raise exception 'Configure competition settings first'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 120 then
    raise exception 'Award names must be 1-120 characters' using errcode = '22023';
  end if;
  if p_rank is null or p_rank not between 1 and 1000 then
    raise exception 'Rank must be between 1 and 1000' using errcode = '22023';
  end if;
  if p_award_id is not null then
    select track_id into v_current_track from public.awards where id = p_award_id and event_id = p_event_id for update;
    if not found then raise exception 'Award not found for this event' using errcode = 'PT404'; end if;
  end if;
  if p_track_id is not null and p_track_id is distinct from v_current_track and not exists (
    select 1 from public.competition_tracks t where t.id = p_track_id and t.event_id = p_event_id and t.active
  ) then raise exception 'Choose an active track for this event' using errcode = '22023'; end if;
  if p_track_id is not null and exists (
    select 1 from public.project_awards pa
    where pa.award_id = p_award_id and not exists (
      select 1 from public.project_tracks pt where pt.project_id = pa.project_id and pt.track_id = p_track_id
    )
  ) then raise exception 'Remove winners outside this track before changing the award track' using errcode = '22023'; end if;
  if p_award_id is null then
    insert into public.awards (event_id, name, track_id, rank)
    values (p_event_id, btrim(p_name), p_track_id, p_rank) returning id into v_id;
  else
    update public.awards set name = btrim(p_name), track_id = p_track_id, rank = p_rank
    where id = p_award_id returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.admin_delete_award(p_event_id uuid, p_award_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.awards where id = p_award_id and event_id = p_event_id;
  if not found then raise exception 'Award not found for this event' using errcode = 'PT404'; end if;
end;
$$;

-- A track award may only go to a submitted project entered in that track.
create function public.admin_assign_award(p_event_id uuid, p_award_id uuid, p_project_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_award public.awards;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  select * into v_award from public.awards where id = p_award_id and event_id = p_event_id for update;
  if not found then raise exception 'Award not found for this event' using errcode = 'PT404'; end if;
  if not exists (
    select 1 from public.projects p where p.id = p_project_id and p.event_id = p_event_id and p.status = 'submitted'
  ) then raise exception 'Choose a submitted project from this event' using errcode = '22023'; end if;
  if v_award.track_id is not null and not exists (
    select 1 from public.project_tracks pt where pt.project_id = p_project_id and pt.track_id = v_award.track_id
  ) then raise exception 'This project is not entered in the award track' using errcode = '22023'; end if;
  insert into public.project_awards (award_id, project_id, event_id)
  values (p_award_id, p_project_id, p_event_id) on conflict do nothing;
end;
$$;

create function public.admin_unassign_award(p_event_id uuid, p_award_id uuid, p_project_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.project_awards
  where award_id = p_award_id and project_id = p_project_id and event_id = p_event_id;
  if not found then raise exception 'This project does not have this award' using errcode = 'PT404'; end if;
end;
$$;

-- Awards with winners, plus every submitted project that can be chosen as a winner.
create function public.admin_awards(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'awards', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'rank', a.rank, 'track_id', a.track_id,
        'projects', coalesce((
          select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'status', p.status) order by p.name, p.id)
          from public.project_awards pa join public.projects p on p.id = pa.project_id
          where pa.award_id = a.id
        ), '[]'::jsonb)) order by a.rank, a.name, a.id)
      from public.awards a where a.event_id = p_event_id
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name,
        'track_ids', coalesce((select jsonb_agg(pt.track_id order by pt.track_id)
          from public.project_tracks pt where pt.project_id = p.id), '[]'::jsonb)) order by p.name, p.id)
      from public.projects p where p.event_id = p_event_id and p.status = 'submitted'
    ), '[]'::jsonb)
  );
end;
$$;

create function public.gallery_project_tracks(p_project_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name, t.id), '[]'::jsonb)
  from public.project_tracks pt join public.competition_tracks t on t.id = pt.track_id
  where pt.project_id = p_project_id and t.active;
$$;

create function public.gallery_project_awards(p_project_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'rank', a.rank) order by a.rank, a.name, a.id), '[]'::jsonb)
  from public.project_awards pa join public.awards a on a.id = pa.award_id
  where pa.project_id = p_project_id;
$$;

create function public.gallery_events()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', e.slug, 'name', e.name, 'starts_at', e.starts_at)
    order by e.starts_at desc nulls last, e.created_at desc, e.slug), '[]'::jsonb)
  from public.events e join public.event_competition_settings s on s.event_id = e.id
  where s.gallery_published;
$$;

-- Winners first by their best award rank, then everyone by the shared random order.
create function public.gallery_projects(p_event_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'event', jsonb_build_object('slug', e.slug, 'name', e.name),
    'tracks', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'sponsor', t.sponsor) order by t.name, t.id)
      from public.competition_tracks t where t.event_id = e.id and t.active
    ), '[]'::jsonb),
    'awards', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'rank', a.rank, 'track_id', a.track_id)
        order by a.rank, a.name, a.id)
      from public.awards a where a.event_id = e.id
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name,
        'summary', p.answers ->> (
          select q.id::text from public.project_questions q
          where q.event_id = e.id and q.gallery_summary and q.gallery_public and q.archived_at is null
            and q.type in ('short_text', 'long_text')
        ),
        'tracks', public.gallery_project_tracks(p.id),
        'awards', public.gallery_project_awards(p.id))
        order by (select min(a.rank) from public.project_awards pa join public.awards a on a.id = pa.award_id
          where pa.project_id = p.id) asc nulls last, p.gallery_sort_key, p.id)
      from public.projects p where p.event_id = e.id and p.status = 'submitted'
    ), '[]'::jsonb))
  from public.events e join public.event_competition_settings s on s.event_id = e.id
  where e.slug = p_event_slug and s.gallery_published;
$$;

-- Answers and team match judge_project_view. File and email answers never leave the database.
create function public.gallery_project(p_event_slug text, p_project_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'event', jsonb_build_object('slug', e.slug, 'name', e.name),
    'project', jsonb_build_object('id', p.id, 'name', p.name),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object('question_id', q.id, 'label', q.label, 'type', q.type,
        'options', q.options, 'answer', p.answers -> q.id::text) order by q.position, q.id)
      from public.project_questions q
      where q.event_id = e.id and q.archived_at is null and q.gallery_public and q.type not in ('file', 'email')
    ), '[]'::jsonb),
    'team', (
      select jsonb_agg(nullif(btrim(u.full_name), '') order by m.position, m.created_at, m.user_id)
      from (
        select p.owner_user_id user_id, 0 position, p.created_at
        union all
        select c.user_id, 1, c.created_at from public.project_collaborators c where c.project_id = p.id
      ) m join public.profiles u on u.id = m.user_id
    ),
    'tracks', public.gallery_project_tracks(p.id),
    'awards', public.gallery_project_awards(p.id))
  from public.events e join public.event_competition_settings s on s.event_id = e.id
  join public.projects p on p.event_id = e.id
  where e.slug = p_event_slug and s.gallery_published and p.id = p_project_id and p.status = 'submitted';
$$;

revoke all on function public.admin_set_gallery_published(uuid, boolean),
  public.admin_set_project_question_gallery(uuid, uuid, boolean, boolean),
  public.admin_project_questions(uuid),
  public.admin_save_award(uuid, text, integer, uuid, uuid), public.admin_delete_award(uuid, uuid),
  public.admin_assign_award(uuid, uuid, uuid), public.admin_unassign_award(uuid, uuid, uuid),
  public.admin_awards(uuid), public.gallery_project_tracks(uuid), public.gallery_project_awards(uuid),
  public.gallery_events(), public.gallery_projects(text), public.gallery_project(text, uuid)
from public, anon, authenticated;
grant execute on function public.admin_set_gallery_published(uuid, boolean),
  public.admin_set_project_question_gallery(uuid, uuid, boolean, boolean),
  public.admin_project_questions(uuid),
  public.admin_save_award(uuid, text, integer, uuid, uuid), public.admin_delete_award(uuid, uuid),
  public.admin_assign_award(uuid, uuid, uuid), public.admin_unassign_award(uuid, uuid, uuid),
  public.admin_awards(uuid)
to authenticated;
grant execute on function public.gallery_events(), public.gallery_projects(text), public.gallery_project(text, uuid)
to anon, authenticated;
