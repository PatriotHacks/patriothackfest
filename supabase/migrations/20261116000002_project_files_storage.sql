-- PDF answers to file questions. Paths: project_id/question_id/file_id.pdf.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-files', 'project-files', false, 10485760, '{application/pdf}');

create function public.project_file_parts(p_name text)
returns text[] language sql immutable set search_path = '' as $$
  select regexp_match(
    p_name,
    '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  );
$$;

-- Mirrors lock_participant_project: owner only, while the project can be saved.
create function public.project_file_writable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1
    from public.project_file_parts(p_name) m (parts)
    join public.projects p on p.id::text = m.parts[1]
    join public.event_competition_settings s on s.event_id = p.event_id
    join public.project_questions q on q.id::text = m.parts[2] and q.event_id = p.event_id
    where p.owner_user_id = auth.uid()
      and p.status <> 'withdrawn'
      and q.archived_at is null and q.type = 'file'
      and s.enabled and s.judging_started_at is null
      and (s.project_submissions_open_at is null or clock_timestamp() >= s.project_submissions_open_at)
      and (s.project_submissions_close_at is null or clock_timestamp() < s.project_submissions_close_at)
      and public.project_user_is_eligible(p.event_id, auth.uid())
  );
$$;

-- Files referenced by saved answers stay until a save replaces them.
create function public.project_file_deletable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.project_file_writable(p_name)
    and not exists (
      select 1 from public.projects p, jsonb_each(p.answers) e
      where p.id::text = split_part(p_name, '/', 1)
        and jsonb_typeof(e.value) = 'object' and e.value ->> 'path' = p_name
    );
$$;

-- Owner and collaborators see any file of their project; organizers see all;
-- judges only files answering active questions on their own assignments, and
-- only while judges_see_answers is on.
create function public.project_file_readable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1
    from public.project_file_parts(p_name) m (parts)
    join public.projects p on p.id::text = m.parts[1]
    where public.project_is_accessible(p.id)
      or public.has_admin_level('organizer')
      or (
        exists (select 1 from public.event_competition_settings s where s.event_id = p.event_id and s.judges_see_answers)
        and exists (select 1 from public.current_judge_assignments(p.event_id) a where a.project_id = p.id)
        and exists (
          select 1 from jsonb_each(p.answers) e
          join public.project_questions q on q.id::text = e.key and q.event_id = p.event_id
          where q.archived_at is null and q.type = 'file' and e.value ->> 'path' = p_name
        )
      )
  );
$$;

revoke execute on function public.project_file_parts(text), public.project_file_writable(text),
  public.project_file_deletable(text), public.project_file_readable(text)
from public, anon;
grant execute on function public.project_file_parts(text), public.project_file_writable(text),
  public.project_file_deletable(text), public.project_file_readable(text)
to authenticated;

create policy "Project owners upload files to editable projects"
on storage.objects for insert
to authenticated
with check (bucket_id = 'project-files' and public.project_file_writable(name));

create policy "Project owners delete unreferenced files of editable projects"
on storage.objects for delete
to authenticated
using (bucket_id = 'project-files' and public.project_file_deletable(name));

-- No downloads or listing: reads exist only to sign short-lived URLs and to
-- let the owner's deletes find their rows.
create policy "Project files are readable only for signing and owner deletes"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-files'
  and (
    (storage.operation() in ('storage.object.sign', 'storage.object.sign_many') and public.project_file_readable(name))
    or (storage.operation() in ('storage.object.delete', 'storage.object.delete_many') and public.project_file_deletable(name))
  )
);
