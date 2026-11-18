-- Organizer project browser across every status. Answered matches project_answer_errors:
-- null, blank text, and empty arrays do not count.
create function public.project_answer_present(p_value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case jsonb_typeof(p_value)
    when 'string' then btrim(p_value #>> '{}') <> ''
    when 'array' then jsonb_array_length(p_value) > 0
    when 'null' then false
    else p_value is not null
  end;
$$;

create function public.admin_event_projects(p_event_id uuid,p_status text default null,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_page is null or p_page < 1 then raise exception 'Invalid project page' using errcode='22023'; end if;
  if p_status is not null and p_status not in ('draft','submitted','withdrawn') then
    raise exception 'Invalid project status' using errcode='22023';
  end if;
  return (
    with required as (
      select q.id::text id from public.project_questions q
      where q.event_id=p_event_id and q.required and q.archived_at is null
    ), page as (
      select p.id,p.name,p.status,p.owner_user_id,p.submitted_at,p.updated_at,p.answers,
        case when p.status='submitted' then p.submitted_at else p.updated_at end activity_at
      from public.projects p
      where p.event_id=p_event_id and (p_status is null or p.status=p_status)
      order by activity_at desc,p.id desc
      limit 51 offset ((p_page::bigint-1)*50)
    ), visible as (
      select * from page order by activity_at desc,id desc limit 50
    )
    select jsonb_build_object(
      'projects',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',p.id,'name',p.name,'status',p.status,
          'submitted_at',p.submitted_at,'updated_at',p.updated_at,
          'owner',jsonb_build_object('id',p.owner_user_id,'full_name',owner.full_name),
          'answered_count',(select count(*) from required r where public.project_answer_present(p.answers -> r.id))
        ) order by p.activity_at desc,p.id desc)
        from visible p join public.profiles owner on owner.id=p.owner_user_id
      ),'[]'::jsonb),
      'has_more',(select count(*)>50 from page),
      'required_count',(select count(*) from required),
      'counts',(
        select jsonb_build_object(
          'draft',count(*) filter (where p.status='draft'),
          'submitted',count(*) filter (where p.status='submitted'),
          'withdrawn',count(*) filter (where p.status='withdrawn'))
        from public.projects p where p.event_id=p_event_id
      )
    )
  );
end;
$$;

create function public.admin_project_detail(p_event_id uuid,p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return (
    select jsonb_build_object(
      'project',jsonb_build_object(
        'id',p.id,'event_id',p.event_id,'status',p.status,'name',p.name,
        'submitted_at',p.submitted_at,'updated_at',p.updated_at
      ),
      'owner',jsonb_build_object('id',p.owner_user_id,'full_name',owner.full_name),
      'collaborators',coalesce((select jsonb_agg(jsonb_build_object('id',c.user_id,'full_name',person.full_name) order by c.created_at,c.user_id)
        from public.project_collaborators c join public.profiles person on person.id=c.user_id
        where c.project_id=p.id),'[]'::jsonb),
      'tracks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active) order by t.name,t.id)
        from public.project_tracks pt join public.competition_tracks t on t.id=pt.track_id
        where pt.project_id=p.id),'[]'::jsonb),
      'answers',public.project_question_answers(p)
    )
    from public.projects p join public.profiles owner on owner.id=p.owner_user_id
    where p.event_id=p_event_id and p.id=p_project_id
  );
end;
$$;

revoke all on function public.project_answer_present(jsonb) from public,anon,authenticated;
revoke all on function public.admin_event_projects(uuid,text,integer),public.admin_project_detail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_event_projects(uuid,text,integer),public.admin_project_detail(uuid,uuid) to authenticated;
