-- Post-judging documents. Each upload gets a fresh file id; the current file is
-- recorded on the row, so replacing never overwrites an object.
alter table public.event_judges
  add column receives_invitation boolean not null default false,
  add column certificate_path text;
alter table public.event_competition_settings add column invitation_letter_path text;

-- PDFs only. Paths: event_id/certificates/event_judge_id/file_id.pdf and
-- event_id/invitation-letter/file_id.pdf.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('judge-documents', 'judge-documents', false, 10485760, '{application/pdf}');

-- parts[1] is the event id; parts[2] is the judge id, null for the invitation letter.
create function public.judge_document_parts(p_name text)
returns text[] language sql immutable set search_path = '' as $$
  select regexp_match(
    p_name,
    '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/(?:certificates/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|invitation-letter)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  );
$$;

-- Organizers only, into an event with settings and, for certificates, a judge of that event.
create function public.judge_document_writable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.has_admin_level('organizer') and exists (
    select 1
    from public.judge_document_parts(p_name) m (parts)
    join public.event_competition_settings s on s.event_id::text = m.parts[1]
    where m.parts[2] is null
      or exists (select 1 from public.event_judges j where j.id::text = m.parts[2] and j.event_id = s.event_id)
  );
$$;

-- Organizers delete any file that is not recorded, including those of deleted judges.
create function public.judge_document_deletable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.has_admin_level('organizer')
    and exists (
      select 1 from public.judge_document_parts(p_name) m (parts)
      join public.event_competition_settings s on s.event_id::text = m.parts[1]
    )
    and not exists (select 1 from public.event_judges j where j.certificate_path = p_name)
    and not exists (select 1 from public.event_competition_settings s where s.invitation_letter_path = p_name);
$$;

-- Organizers see every file. Once judging has started and closed, a judge sees their own recorded
-- certificate and, if chosen for one, the event's recorded invitation letter.
create function public.judge_document_readable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1
    from public.judge_document_parts(p_name) m (parts)
    join public.event_competition_settings s on s.event_id::text = m.parts[1]
    where public.has_admin_level('organizer')
      or (
        s.judging_started_at is not null and s.judging_close_at <= clock_timestamp()
        and exists (
          select 1 from public.event_judges j
          where j.id = public.current_event_judge_id(s.event_id)
            and (j.certificate_path = p_name or (j.receives_invitation and s.invitation_letter_path = p_name))
        )
      )
  );
$$;

revoke execute on function public.judge_document_parts(text), public.judge_document_writable(text),
  public.judge_document_deletable(text), public.judge_document_readable(text)
from public, anon;
grant execute on function public.judge_document_parts(text), public.judge_document_writable(text),
  public.judge_document_deletable(text), public.judge_document_readable(text)
to authenticated;

create policy "Organizers upload judge documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'judge-documents' and public.judge_document_writable(name));

create policy "Organizers delete unrecorded judge documents"
on storage.objects for delete
to authenticated
using (bucket_id = 'judge-documents' and public.judge_document_deletable(name));

-- No downloads or listing: reads exist only to sign short-lived URLs and to
-- let organizer deletes find their rows.
create policy "Judge documents are readable only for signing and organizer deletes"
on storage.objects for select
to authenticated
using (
  bucket_id = 'judge-documents'
  and (
    (storage.operation() in ('storage.object.sign', 'storage.object.sign_many') and public.judge_document_readable(name))
    or (storage.operation() in ('storage.object.delete', 'storage.object.delete_many') and public.judge_document_deletable(name))
  )
);
