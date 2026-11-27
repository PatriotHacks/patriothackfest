-- Active judges with their post-judging documents, for organizers.
create function public.admin_post_judging_roster(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',j.id,'email',j.email::text,'guest',j.guest,
      'receives_invitation',j.receives_invitation,'certificate_path',j.certificate_path) order by j.email,j.id)
    from public.event_judges j where j.event_id=p_event_id and j.active
  ),'[]'::jsonb);
end;
$$;

create function public.admin_set_judge_invitation(p_event_id uuid,p_judge_id uuid,p_receives boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_receives is null then raise exception 'Choose whether the judge receives an invitation letter' using errcode='22023'; end if;
  update public.event_judges set receives_invitation=p_receives where id=p_judge_id and event_id=p_event_id;
  if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
end;
$$;

-- An uploaded file must exist in its own slot before it is recorded.
create function public.judge_document_uploaded(p_path text,p_event_id uuid,p_judge_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.judge_document_parts(p_path) m (parts)
    join storage.objects o on o.bucket_id='judge-documents' and o.name=p_path
    where m.parts[1]=p_event_id::text and m.parts[2] is not distinct from p_judge_id::text
  );
$$;

-- Records the certificate (null clears it) and returns the previous path for deletion.
create function public.admin_set_judge_certificate(p_event_id uuid,p_judge_id uuid,p_path text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_previous text;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  select certificate_path into v_previous from public.event_judges
  where id=p_judge_id and event_id=p_event_id for update;
  if not found then raise exception 'Judge not found for this event' using errcode='PT404'; end if;
  if p_path is not null and not public.judge_document_uploaded(p_path,p_event_id,p_judge_id) then
    raise exception 'Upload the file again' using errcode='22023';
  end if;
  update public.event_judges set certificate_path=p_path where id=p_judge_id;
  return v_previous;
end;
$$;

-- Records the event's invitation letter (null clears it) and returns the previous path.
create function public.admin_set_invitation_letter(p_event_id uuid,p_path text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_previous text;
begin
  if not public.has_admin_level('organizer') then raise exception 'Not authorized' using errcode='42501'; end if;
  select invitation_letter_path into v_previous from public.event_competition_settings
  where event_id=p_event_id for update;
  if not found then raise exception 'Configure competition settings first'; end if;
  if p_path is not null and not public.judge_document_uploaded(p_path,p_event_id,null) then
    raise exception 'Upload the file again' using errcode='22023';
  end if;
  update public.event_competition_settings set invitation_letter_path=p_path where event_id=p_event_id;
  return v_previous;
end;
$$;

-- The caller's documents for one event, only once judging has started and closed. Null when
-- the caller is not an active judge of the event.
create function public.judge_documents(p_event_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'certificate_path',case when closed then j.certificate_path end,
    'invitation_letter_path',case when closed and j.receives_invitation then s.invitation_letter_path end)
  from public.events e
  join public.event_competition_settings s on s.event_id=e.id
  join public.event_judges j on j.id=public.current_event_judge_id(e.id)
  cross join lateral (select s.judging_started_at is not null and s.judging_close_at<=clock_timestamp() closed) c
  where e.slug=p_event_slug;
$$;

revoke all on function public.admin_post_judging_roster(uuid), public.admin_set_judge_invitation(uuid,uuid,boolean),
  public.judge_document_uploaded(text,uuid,uuid), public.admin_set_judge_certificate(uuid,uuid,text),
  public.admin_set_invitation_letter(uuid,text), public.judge_documents(text)
from public,anon,authenticated;
grant execute on function public.admin_post_judging_roster(uuid), public.admin_set_judge_invitation(uuid,uuid,boolean),
  public.admin_set_judge_certificate(uuid,uuid,text), public.admin_set_invitation_letter(uuid,text),
  public.judge_documents(text)
to authenticated;
