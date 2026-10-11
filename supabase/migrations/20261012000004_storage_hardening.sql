update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = '{application/pdf}'
where id = 'application-files';

create function public.application_file_writable(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from regexp_match(
      p_name,
      '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    ) as m (parts)
    join public.applications a on a.id::text = m.parts[2]
    join public.forms f on f.id = a.form_id
    where m.parts[1] = auth.uid()::text
      and a.user_id = auth.uid()
      and jsonb_path_exists(
        f.published_schema,
        '$.fields[*] ? (@.id == $id && @.type == "file")',
        jsonb_build_object('id', m.parts[3])
      )
      and (
        (a.status = 'draft' and now() < f.submissions_close_at)
        or (a.status = 'submitted' and now() < f.edits_lock_at)
      )
  )
$$;

create function public.application_file_deletable(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.application_file_writable(p_name)
    and not exists (
      select 1
      from public.applications a, jsonb_each(a.answers) e
      where a.id::text = split_part(p_name, '/', 2)
        and a.status = 'submitted'
        and e.value ->> 'path' = p_name
    )
$$;

revoke execute on function
  public.application_file_writable(text),
  public.application_file_deletable(text)
from public, anon;

grant execute on function
  public.application_file_writable(text),
  public.application_file_deletable(text)
to authenticated;

drop policy "Applicants upload own application files" on storage.objects;
drop policy "Applicants delete own application files" on storage.objects;

create policy "Applicants upload files to editable applications"
on storage.objects for insert
to authenticated
with check (bucket_id = 'application-files' and public.application_file_writable(name));

create policy "Applicants delete unsubmitted files of editable applications"
on storage.objects for delete
to authenticated
using (bucket_id = 'application-files' and public.application_file_deletable(name));
