-- Read-only organizer views. Do not broaden direct project/profile privileges.
create function public.admin_submitted_projects(p_event_id uuid,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_page is null or p_page < 1 then raise exception 'Invalid project page' using errcode='22023'; end if;
  return (
    with page as (
      select p.id,p.name,p.owner_user_id,p.submitted_at from public.projects p
      where p.event_id=p_event_id and p.status='submitted'
      order by p.submitted_at desc,p.id desc
      limit 51 offset ((p_page::bigint-1)*50)
    ), visible as (
      select * from page order by submitted_at desc,id desc limit 50
    )
    select jsonb_build_object(
      'projects',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',p.id,'name',p.name,'submitted_at',p.submitted_at,
          'owner',jsonb_build_object('id',p.owner_user_id,'full_name',owner.full_name),
          'tracks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active) order by t.name,t.id)
            from public.project_tracks pt join public.competition_tracks t on t.id=pt.track_id
            where pt.project_id=p.id),'[]'::jsonb)
        ) order by p.submitted_at desc,p.id desc)
        from visible p join public.profiles owner on owner.id=p.owner_user_id
      ),'[]'::jsonb),
      'has_more',(select count(*)>50 from page)
    )
  );
end;
$$;

create function public.admin_submitted_project_detail(p_event_id uuid,p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return (
    select jsonb_build_object(
      'project',jsonb_build_object(
        'id',p.id,'event_id',p.event_id,'status',p.status,'name',p.name,'summary',p.summary,
        'description',p.description,'technologies',p.technologies,
        'repository_url',p.repository_url,'demo_url',p.demo_url,'video_url',p.video_url,
        'submitted_at',p.submitted_at,'updated_at',p.updated_at
      ),
      'owner',jsonb_build_object('id',p.owner_user_id,'full_name',owner.full_name),
      'collaborators',coalesce((select jsonb_agg(jsonb_build_object('id',c.user_id,'full_name',person.full_name) order by c.created_at,c.user_id)
        from public.project_collaborators c join public.profiles person on person.id=c.user_id
        where c.project_id=p.id),'[]'::jsonb),
      'tracks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active) order by t.name,t.id)
        from public.project_tracks pt join public.competition_tracks t on t.id=pt.track_id
        where pt.project_id=p.id),'[]'::jsonb)
    )
    from public.projects p join public.profiles owner on owner.id=p.owner_user_id
    where p.event_id=p_event_id and p.id=p_project_id and p.status='submitted'
  );
end;
$$;

revoke all on function public.admin_submitted_projects(uuid,integer),public.admin_submitted_project_detail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_submitted_projects(uuid,integer),public.admin_submitted_project_detail(uuid,uuid) to authenticated;
