-- Invitation letters become per judge, like certificates: a judge sees one iff it is recorded on
-- their row. The shared event letter and the per-judge switch go away.
drop function public.admin_set_judge_invitation(uuid,uuid,boolean);
drop function public.admin_set_invitation_letter(uuid,text);
drop function public.judge_document_uploaded(text,uuid,uuid);

alter table public.event_judges
  drop column receives_invitation,
  add column invitation_letter_path text;
alter table public.event_competition_settings drop column invitation_letter_path;

-- Paths: event_id/certificates/event_judge_id/file_id.pdf and
-- event_id/invitation-letters/event_judge_id/file_id.pdf.
-- parts[1] is the event id, parts[2] the slot, parts[3] the judge id.
create or replace function public.judge_document_parts(p_name text)
returns text[] language sql immutable set search_path = '' as $$
  select regexp_match(
    p_name,
    '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/(certificates|invitation-letters)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  );
$$;

-- Organizers only, into an event with settings and a judge of that event.
create or replace function public.judge_document_writable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.has_admin_level('organizer') and exists (
    select 1
    from public.judge_document_parts(p_name) m (parts)
    join public.event_competition_settings s on s.event_id::text = m.parts[1]
    join public.event_judges j on j.id::text = m.parts[3] and j.event_id = s.event_id
  );
$$;

-- Organizers delete any file that is not recorded, including those of deleted judges.
create or replace function public.judge_document_deletable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.has_admin_level('organizer')
    and exists (
      select 1 from public.judge_document_parts(p_name) m (parts)
      join public.event_competition_settings s on s.event_id::text = m.parts[1]
    )
    and not exists (
      select 1 from public.event_judges j
      where j.certificate_path = p_name or j.invitation_letter_path = p_name
    );
$$;

-- Organizers see every file. Once judging has started and closed, a judge sees their own
-- recorded documents.
create or replace function public.judge_document_readable(p_name text)
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
            and (j.certificate_path = p_name or j.invitation_letter_path = p_name)
        )
      )
  );
$$;

create or replace function public.admin_post_judging_roster(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',j.id,'email',j.email::text,'guest',j.guest,
      'certificate_path',j.certificate_path,'invitation_letter_path',j.invitation_letter_path) order by j.email,j.id)
    from public.event_judges j where j.event_id=p_event_id and j.active
  ),'[]'::jsonb);
end;
$$;

-- An uploaded file must exist in its own judge's slot before it is recorded.
create function public.judge_document_uploaded(p_path text,p_event_id uuid,p_judge_id uuid,p_slot text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.judge_document_parts(p_path) m (parts)
    join storage.objects o on o.bucket_id='judge-documents' and o.name=p_path
    where m.parts[1]=p_event_id::text and m.parts[2]=p_slot and m.parts[3]=p_judge_id::text
  );
$$;

-- Records the certificate (null clears it) and returns the previous path for deletion.
create or replace function public.admin_set_judge_certificate(p_event_id uuid,p_judge_id uuid,p_path text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_previous text;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  select certificate_path into v_previous from public.event_judges
  where id=p_judge_id and event_id=p_event_id for update;
  if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
  if p_path is not null and not public.judge_document_uploaded(p_path,p_event_id,p_judge_id,'certificates') then
    raise exception 'Upload the file again' using errcode='22023';
  end if;
  update public.event_judges set certificate_path=p_path where id=p_judge_id;
  return v_previous;
end;
$$;

-- Records the invitation letter (null clears it) and returns the previous path for deletion.
create function public.admin_set_judge_invitation_letter(p_event_id uuid,p_judge_id uuid,p_path text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_previous text;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  select invitation_letter_path into v_previous from public.event_judges
  where id=p_judge_id and event_id=p_event_id for update;
  if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
  if p_path is not null and not public.judge_document_uploaded(p_path,p_event_id,p_judge_id,'invitation-letters') then
    raise exception 'Upload the file again' using errcode='22023';
  end if;
  update public.event_judges set invitation_letter_path=p_path where id=p_judge_id;
  return v_previous;
end;
$$;

-- The caller's documents for one event, only once judging has started and closed. Null when
-- the caller is not an active judge of the event.
create or replace function public.judge_documents(p_event_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'certificate_path',case when closed then j.certificate_path end,
    'invitation_letter_path',case when closed then j.invitation_letter_path end)
  from public.events e
  join public.event_competition_settings s on s.event_id=e.id
  join public.event_judges j on j.id=public.current_event_judge_id(e.id)
  cross join lateral (select s.judging_started_at is not null and s.judging_close_at<=clock_timestamp() closed) c
  where e.slug=p_event_slug;
$$;

-- Deleting a judge returns their recorded document paths so the caller can delete the files.
drop function public.admin_delete_event_judge(uuid,uuid);
create function public.admin_delete_event_judge(p_event_id uuid,p_judge_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare v_started_at timestamptz; v_certificate text; v_letter text;
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select judging_started_at into v_started_at from public.event_competition_settings
  where event_id=p_event_id for update;
  if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
  if v_started_at is not null then
    raise exception 'Judging has started; deactivate this judge instead';
  end if;
  delete from public.judge_track_scopes where judge_id=p_judge_id and event_id=p_event_id;
  delete from public.event_judges where id=p_judge_id and event_id=p_event_id
  returning certificate_path,invitation_letter_path into v_certificate,v_letter;
  if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
  return array_remove(array[v_certificate,v_letter],null);
end;
$$;

revoke all on function public.judge_document_uploaded(text,uuid,uuid,text),
  public.admin_set_judge_invitation_letter(uuid,uuid,text), public.admin_delete_event_judge(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.admin_set_judge_invitation_letter(uuid,uuid,text),
  public.admin_delete_event_judge(uuid,uuid)
to authenticated;
