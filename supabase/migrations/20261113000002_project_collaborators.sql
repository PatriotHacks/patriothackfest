create function public.participant_add_project_collaborator(p_project_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_project public.projects; v_user_id uuid;
begin
  v_project := public.lock_participant_project(p_project_id, true);
  -- Exact address only; no standalone user search or eligibility endpoint.
  select u.id into v_user_id from auth.users u
  where lower(u.email) = lower(btrim(p_email));
  if v_user_id is null or v_user_id = v_project.owner_user_id
    or not public.project_user_is_eligible(v_project.event_id, v_user_id) then
    raise exception 'Cannot add this collaborator. Use the email of an eligible registered participant.';
  end if;
  if exists (select 1 from public.project_collaborators where project_id = p_project_id and user_id = v_user_id) then
    raise exception 'This participant is already a collaborator';
  end if;
  insert into public.project_collaborators(project_id, event_id, user_id)
  values (p_project_id, v_project.event_id, v_user_id);
end;
$$;

create function public.participant_remove_project_collaborator(p_project_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_participant_project(p_project_id, true);
  delete from public.project_collaborators where project_id = p_project_id and user_id = p_user_id;
  if not found then raise exception 'Collaborator not found'; end if;
end;
$$;

revoke all on function public.participant_add_project_collaborator(uuid, text), public.participant_remove_project_collaborator(uuid, uuid) from public, anon, authenticated;
grant execute on function public.participant_add_project_collaborator(uuid, text), public.participant_remove_project_collaborator(uuid, uuid) to authenticated;
