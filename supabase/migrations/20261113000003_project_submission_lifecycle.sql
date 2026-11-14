create function public.project_http_url_valid(p_url text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_parts text[]; v_host text;
begin
  if position(chr(92) in p_url) > 0 then return false; end if;
  v_parts := regexp_match(p_url, '^https?://(\[[0-9a-f:.]+\]|[[:alnum:]_.-]+)(:([0-9]{1,5}))?([/?#][^[:space:]]*)?$', 'i');
  if v_parts is null then return false; end if;
  if v_parts[3] is not null and v_parts[3]::integer > 65535 then return false; end if;
  v_host := v_parts[1];
  if left(v_host,1) = '[' then
    return family(btrim(v_host,'[]')::inet) = 6;
  elsif v_host ~ '^[0-9.]+$' then
    return family(v_host::inet) = 4;
  end if;
  return true;
exception when invalid_text_representation then return false;
end;
$$;

create function public.project_content_errors(p_content jsonb, p_complete boolean)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare v_errors jsonb := '{}'; v_key text; v_value text; v_limit integer;
begin
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    return '{"form":"Invalid project content"}'::jsonb;
  end if;
  if p_content - array['name','summary','description','technologies','repository_url','demo_url','video_url'] <> '{}'::jsonb then
    v_errors := v_errors || '{"form":"Unexpected project fields"}'::jsonb;
  end if;
  foreach v_key in array array['name','summary','description','technologies','repository_url','demo_url','video_url'] loop
    if p_content ? v_key and jsonb_typeof(p_content->v_key) not in ('string','null') then
      v_errors := v_errors || jsonb_build_object(v_key,'Enter text');
      continue;
    end if;
    v_value := btrim(coalesce(p_content->>v_key,''));
    v_limit := case v_key when 'name' then 120 when 'summary' then 300 when 'description' then 10000 when 'technologies' then 1000 else 2048 end;
    if length(v_value) > v_limit then
      v_errors := v_errors || jsonb_build_object(v_key,format('Use %s characters or fewer',v_limit));
    end if;
    if p_complete and v_key in ('name','summary','description') and v_value = '' then
      v_errors := v_errors || jsonb_build_object(v_key,'This field is required');
    end if;
    if v_key in ('repository_url','demo_url','video_url') and v_value <> ''
      and not public.project_http_url_valid(v_value) then
      v_errors := v_errors || jsonb_build_object(v_key,'Enter an HTTP or HTTPS URL');
    end if;
  end loop;
  if p_complete and btrim(coalesce(p_content->>'repository_url','')) = ''
    and btrim(coalesce(p_content->>'demo_url','')) = '' and btrim(coalesce(p_content->>'video_url','')) = '' then
    v_errors := v_errors || '{"repository_url":"Add at least one repository, demo, or video URL"}'::jsonb;
  end if;
  return v_errors;
end;
$$;

create function public.participant_save_project(
  p_project_id uuid, p_content jsonb, p_track_ids uuid[] default '{}',
  p_submit boolean default false, p_expected_updated_at timestamptz default null
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_project public.projects; v_errors jsonb; v_complete boolean; v_updated_at timestamptz;
begin
  v_project := public.lock_participant_project(p_project_id, false);
  if p_expected_updated_at is null or p_expected_updated_at is distinct from v_project.updated_at then
    raise exception 'This project changed. Reload before saving again.' using errcode='PT409';
  end if;
  if p_submit is null then raise exception 'Invalid submission request'; end if;
  v_complete := p_submit or v_project.status = 'submitted';
  v_errors := public.project_content_errors(p_content, v_complete);
  if p_track_ids is null or exists (
    select 1 from unnest(p_track_ids) selected(id)
    left join public.competition_tracks t on t.id=selected.id and t.event_id=v_project.event_id and t.active
    where t.id is null
  ) then
    v_errors := v_errors || '{"track_ids":"Choose active tracks for this event; remove unavailable selections"}'::jsonb;
  end if;
  if v_errors <> '{}'::jsonb then
    raise exception 'Some project fields need attention' using errcode='PT422',detail=v_errors::text;
  end if;
  if v_complete and exists (
    select 1 from public.project_collaborators c where c.project_id=p_project_id
      and not public.project_user_is_eligible(v_project.event_id,c.user_id)
  ) then
    raise exception 'A collaborator is no longer eligible for this event. Remove them before submitting or saving changes.';
  end if;
  update public.projects set
    name=btrim(coalesce(p_content->>'name','')),summary=btrim(coalesce(p_content->>'summary','')),
    description=btrim(coalesce(p_content->>'description','')),technologies=btrim(coalesce(p_content->>'technologies','')),
    repository_url=nullif(btrim(p_content->>'repository_url'),''),demo_url=nullif(btrim(p_content->>'demo_url'),''),video_url=nullif(btrim(p_content->>'video_url'),''),
    status=case when p_submit then 'submitted' else status end,
    submitted_at=case when p_submit then coalesce(submitted_at,clock_timestamp()) else submitted_at end
  where id=p_project_id returning updated_at into v_updated_at;
  delete from public.project_tracks where project_id=p_project_id;
  insert into public.project_tracks(project_id,track_id,event_id)
  select p_project_id,id,v_project.event_id from (select distinct unnest(p_track_ids) id) selected;
  return v_updated_at;
end;
$$;

create function public.participant_withdraw_project(p_project_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_participant_project(p_project_id, true);
  update public.projects set status='withdrawn' where id=p_project_id;
end;
$$;

revoke all on function public.project_http_url_valid(text), public.project_content_errors(jsonb,boolean),
  public.participant_save_project(uuid,jsonb,uuid[],boolean,timestamptz), public.participant_withdraw_project(uuid)
from public,anon,authenticated;
grant execute on function public.participant_save_project(uuid,jsonb,uuid[],boolean,timestamptz), public.participant_withdraw_project(uuid) to authenticated;
