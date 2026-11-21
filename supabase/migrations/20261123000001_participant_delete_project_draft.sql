-- Owners delete never-submitted drafts so the whole team can join other teams.
-- Returns the project's file paths; the caller removes them through the
-- Storage API, which the orphaned-file policies below allow.
create function public.participant_delete_project_draft(p_project_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare v_project public.projects; v_paths text[];
begin
  v_project := public.lock_participant_project(p_project_id, true);
  if v_project.owner_user_id <> auth.uid() then
    raise exception 'Only the project owner can delete the project' using errcode = '42501';
  end if;
  if v_project.status <> 'draft' or v_project.submitted_at is not null then
    raise exception 'Only unsubmitted drafts can be deleted';
  end if;
  select coalesce(array_agg(o.name order by o.name), '{}') into v_paths from storage.objects o
  where o.bucket_id = 'project-files' and o.name like p_project_id::text || '/%';
  delete from public.project_tracks where project_id = p_project_id;
  delete from public.project_collaborators where project_id = p_project_id;
  delete from public.projects where id = p_project_id;
  return v_paths;
end;
$$;

revoke all on function public.participant_delete_project_draft(uuid) from public, anon, authenticated;
grant execute on function public.participant_delete_project_draft(uuid) to authenticated;

-- Files of a deleted project are unreachable by every other policy.
create function public.project_file_orphaned(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.project_file_parts(p_name) m (parts)
    where m.parts is not null and not exists (select 1 from public.projects p where p.id::text = m.parts[1])
  );
$$;

revoke execute on function public.project_file_orphaned(text) from public, anon;
grant execute on function public.project_file_orphaned(text) to authenticated;

create policy "Files of deleted projects can be deleted"
on storage.objects for delete
to authenticated
using (bucket_id = 'project-files' and public.project_file_orphaned(name));

create policy "Files of deleted projects are readable only for deletes"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-files'
  and storage.operation() in ('storage.object.delete', 'storage.object.delete_many')
  and public.project_file_orphaned(name)
);
