-- Per-event team size limit (owner included; null means unlimited) and judge
-- visibility of team member names.
alter table public.event_competition_settings
  add column max_team_size integer check (max_team_size >= 1),
  add column judges_see_team boolean not null default false;

-- Settings lock serializes with roster changes, so no team can outgrow a new limit.
create function public.admin_set_max_team_size(p_event_id uuid, p_value integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_largest integer;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_value < 1 then raise exception 'Team size limit must be at least 1' using errcode = '22023'; end if;
  perform 1 from public.event_competition_settings where event_id = p_event_id for update;
  if not found then raise exception 'Configure competition settings first'; end if;
  select max(1 + (select count(*) from public.project_collaborators c where c.project_id = p.id))
  into v_largest from public.projects p
  where p.event_id = p_event_id and p.status <> 'withdrawn';
  if p_value < v_largest then
    raise exception 'A team already has % members. Choose a limit of at least %.', v_largest, v_largest;
  end if;
  update public.event_competition_settings set max_team_size = p_value where event_id = p_event_id;
end;
$$;

create function public.admin_set_judges_see_team(p_event_id uuid, p_value boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_value is null then raise exception 'Choose whether judges see team members' using errcode = '22023'; end if;
  update public.event_competition_settings set judges_see_team = p_value where event_id = p_event_id;
  if not found then raise exception 'Configure competition settings first'; end if;
end;
$$;

-- Names only, owner first, and only while judges_see_team is on.
create or replace function public.judge_assignment(p_event_slug text,p_assignment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('assignment',public.judge_scorecard(a),
    'project',jsonb_build_object('name',p.name,'summary',p.summary,'description',p.description,
      'technologies',p.technologies,'repository_url',p.repository_url,'demo_url',p.demo_url,'video_url',p.video_url),
    'answers',case when s.judges_see_answers then public.project_question_answers(p) else '[]'::jsonb end,
    'team',case when s.judges_see_team then (
      select jsonb_agg(nullif(btrim(u.full_name),'') order by m.position,m.created_at,m.user_id)
      from (
        select p.owner_user_id user_id,0 position,p.created_at
        union all
        select c.user_id,1,c.created_at from public.project_collaborators c where c.project_id=p.id
      ) m join public.profiles u on u.id=m.user_id
    ) else '[]'::jsonb end)
  from public.events e cross join lateral public.current_judge_assignments(e.id) a
  join public.projects p on p.id=a.project_id
  join public.event_competition_settings s on s.event_id=e.id
  where e.slug=p_event_slug and a.id=p_assignment_id;
$$;

revoke all on function public.admin_set_max_team_size(uuid, integer), public.admin_set_judges_see_team(uuid, boolean)
from public, anon, authenticated;
grant execute on function public.admin_set_max_team_size(uuid, integer), public.admin_set_judges_see_team(uuid, boolean)
to authenticated;
