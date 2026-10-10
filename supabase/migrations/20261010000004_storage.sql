insert into storage.buckets (id, name, public)
values ('application-files', 'application-files', false);

create policy "Applicants upload own application files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'application-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Applicants read own application files, reviewers read all"
on storage.objects for select
to authenticated
using (
  bucket_id = 'application-files'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.has_admin_level('reviewer'))
  )
);

create policy "Applicants delete own application files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'application-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
