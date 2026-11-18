-- Draft autosave: members patch only the fields they changed, so teammates
-- editing other questions do not overwrite each other. Later patches win per
-- field. Only the patched keys are validated, and required questions wait for
-- submission. removed_paths lists replaced files no answer references anymore.
create function public.participant_patch_project(
  p_project_id uuid, p_name text default null, p_answers jsonb default '{}', p_track_ids uuid[] default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_project public.projects;
  v_answers jsonb;
  v_errors jsonb;
  v_name text;
  v_merged jsonb;
  v_updated_at timestamptz;
begin
  v_project := public.lock_participant_project(p_project_id, false);
  if v_project.status <> 'draft' then
    raise exception 'This project was submitted. Reload the page to keep editing.' using errcode = 'PT409';
  end if;
  v_answers := case when jsonb_typeof(p_answers) = 'object'
    then public.project_answers_normalized(v_project.event_id, p_answers) else p_answers end;
  v_errors := public.project_answer_errors(v_project, v_answers, false);
  if p_name is not null then
    v_errors := v_errors || public.project_content_errors(jsonb_build_object('name', p_name), false);
  end if;
  if p_track_ids is not null and exists (
    select 1 from unnest(p_track_ids) selected(id)
    left join public.competition_tracks t on t.id = selected.id and t.event_id = v_project.event_id and t.active
    where t.id is null
  ) then
    v_errors := v_errors || '{"track_ids":"Choose active tracks for this event; remove unavailable selections"}'::jsonb;
  end if;
  if v_errors <> '{}'::jsonb then
    raise exception 'Some project fields need attention' using errcode = 'PT422', detail = v_errors::text;
  end if;
  update public.projects p set
    name = coalesce(btrim(p_name), p.name),
    answers = coalesce((
      select jsonb_object_agg(e.key, e.value) from jsonb_each(p.answers || v_answers) e
      where e.value not in ('null'::jsonb, '""'::jsonb, '[]'::jsonb)
    ), '{}'::jsonb)
  where p.id = p_project_id
  returning p.name, p.answers, p.updated_at into v_name, v_merged, v_updated_at;
  if p_track_ids is not null then
    delete from public.project_tracks where project_id = p_project_id;
    insert into public.project_tracks(project_id, track_id, event_id)
    select p_project_id, id, v_project.event_id from (select distinct unnest(p_track_ids) id) selected;
  end if;
  return jsonb_build_object(
    'updated_at', v_updated_at,
    'name', v_name,
    'answers', coalesce((select jsonb_object_agg(k, v_merged -> k) from jsonb_object_keys(v_answers) k), '{}'::jsonb),
    'removed_paths', coalesce((
      select jsonb_agg(distinct prev.value ->> 'path')
      from jsonb_each(v_project.answers) prev
      where v_answers ? prev.key and jsonb_typeof(prev.value) = 'object'
        and not exists (
          select 1 from jsonb_each(v_merged) e
          where jsonb_typeof(e.value) = 'object' and e.value ->> 'path' = prev.value ->> 'path'
        )
    ), '[]'::jsonb)
  );
end;
$$;

-- Submits exactly what is stored, so a tab's stale copy of the name, tracks,
-- or answers never replaces a teammate's newer autosave. Validation, the stale
-- check, and member eligibility are participant_save_project's.
create function public.participant_submit_project(p_project_id uuid, p_expected_updated_at timestamptz)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_project public.projects;
begin
  v_project := public.lock_participant_project(p_project_id, false);
  return public.participant_save_project(
    p_project_id,
    jsonb_build_object('name', v_project.name),
    null,
    coalesce((select array_agg(track_id) from public.project_tracks where project_id = p_project_id), '{}'),
    true,
    p_expected_updated_at
  );
end;
$$;

-- Polled by open editors; they refetch the detail only when this changes.
create function public.participant_project_version(p_project_id uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select updated_at from public.projects where id = p_project_id and public.project_is_accessible(id);
$$;

revoke all on function public.participant_patch_project(uuid, text, jsonb, uuid[]),
  public.participant_submit_project(uuid, timestamptz), public.participant_project_version(uuid)
from public, anon, authenticated;
grant execute on function public.participant_patch_project(uuid, text, jsonb, uuid[]),
  public.participant_submit_project(uuid, timestamptz), public.participant_project_version(uuid)
to authenticated;
