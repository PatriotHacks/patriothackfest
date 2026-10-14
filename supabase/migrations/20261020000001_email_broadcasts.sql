create table public.email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  role public.app_role,
  subject text not null check (
    subject ~ '\S'
    and char_length(subject) <= 200
    and subject !~ '[\r\n]'
  ),
  body text not null check (body ~ '\S' and char_length(body) <= 10000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index email_broadcasts_event_id_created_at_idx on public.email_broadcasts (event_id, created_at);

revoke all on table public.email_broadcasts from anon, authenticated;

alter table public.email_broadcasts enable row level security;

grant select on public.email_broadcasts to authenticated;

create policy "Organizers read email broadcasts"
on public.email_broadcasts for select
to authenticated
using ((select public.has_admin_level('organizer')));

alter table public.email_log
  add column broadcast_id uuid references public.email_broadcasts (id) on delete cascade,
  alter column form_id drop not null,
  alter column decision drop not null,
  drop constraint email_log_kind_check,
  add constraint email_log_kind_check check (
    (
      broadcast_id is null
      and form_id is not null
      and decision is not null
      and kind = 'decision_' || decision::text
    )
    or (
      broadcast_id is not null
      and kind = 'broadcast'
      and decision is null
      and previous_decision is null
      and form_id is null
    )
  );

create unique index email_log_broadcast_id_application_id_key
on public.email_log (broadcast_id, application_id)
where broadcast_id is not null;

create index email_log_broadcast_id_status_idx on public.email_log (broadcast_id, status);

create or replace function public.queue_decision_email(p_application_id uuid, p_form_id uuid, p_decision public.decision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last public.decision;
begin
  update public.email_log
  set status = 'cancelled', error = 'Superseded by a later decision'
  where application_id = p_application_id
    and broadcast_id is null
    and status in ('pending', 'failed');

  select e.decision into v_last
  from public.email_log e
  where e.application_id = p_application_id
    and e.form_id = p_form_id
    and e.status in ('sending', 'sent')
  order by e.claimed_at desc
  limit 1;

  if p_decision <> 'pending' and p_decision is distinct from v_last then
    insert into public.email_log (application_id, form_id, kind, decision, previous_decision)
    values (p_application_id, p_form_id, 'decision_' || p_decision::text, p_decision, v_last);
  end if;
end;
$$;

create function public.admin_broadcast_recipient_count(p_event_id uuid, p_role public.app_role)
returns table (recipients integer, sent_last_24h integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  return query
  select
    (
      select count(*)::integer
      from public.applications a
      where a.event_id = p_event_id
        and a.status = 'submitted'
        and a.declined_at is null
        and (p_role is null or a.role = p_role)
    ),
    (
      select count(*)::integer
      from public.email_log l
      where l.status = 'sent' and l.sent_at > now() - interval '24 hours'
    );
end;
$$;

create function public.admin_create_broadcast(
  p_event_id uuid,
  p_role public.app_role,
  p_subject text,
  p_body text,
  p_expected integer
)
returns table (broadcast_id uuid, queued integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_queued integer;
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  with new_broadcast as (
    insert into public.email_broadcasts (event_id, role, subject, body, created_by)
    values (p_event_id, p_role, p_subject, p_body, auth.uid())
    returning id
  ),
  new_emails as (
    insert into public.email_log (application_id, broadcast_id, kind)
    select a.id, b.id, 'broadcast'
    from new_broadcast b
    cross join public.applications a
    where a.event_id = p_event_id
      and a.status = 'submitted'
      and a.declined_at is null
      and (p_role is null or a.role = p_role)
    returning 1
  )
  select (select id from new_broadcast), (select count(*)::integer from new_emails)
  into v_id, v_queued;

  if v_queued = 0 then
    raise exception 'No applicants to email';
  end if;

  if v_queued <> p_expected then
    raise exception 'The number of recipients changed from % to %. Review and send again.', p_expected, v_queued;
  end if;

  return query select v_id, v_queued;
end;
$$;

create function public.admin_claim_broadcast_emails(p_broadcast_id uuid, p_limit integer)
returns table (
  id uuid,
  email text,
  full_name text,
  event_name text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  update public.email_log e
  set status = 'cancelled', error = 'Application no longer matches the broadcast'
  from public.email_broadcasts b
  where b.id = p_broadcast_id
    and e.broadcast_id = b.id
    and (e.status = 'pending' or (e.status = 'sending' and e.claimed_at < now() - interval '10 minutes'))
    and not exists (
      select 1
      from public.applications a
      where a.id = e.application_id
        and a.event_id = b.event_id
        and a.status = 'submitted'
        and a.declined_at is null
        and (b.role is null or a.role = b.role)
    );

  return query
  with picked as (
    select e.id
    from public.email_log e
    where e.broadcast_id = p_broadcast_id
      and (e.status = 'pending' or (e.status = 'sending' and e.claimed_at < now() - interval '10 minutes'))
    order by e.created_at, e.id
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.email_log e
    set status = 'sending', attempts = e.attempts + 1, claimed_at = now(), recipient = u.email
    from picked p, public.applications a, auth.users u
    where e.id = p.id and a.id = e.application_id and u.id = a.user_id
    returning e.id, e.recipient, e.application_id
  )
  select c.id, c.recipient::text, pr.full_name, ev.name
  from claimed c
  join public.applications a on a.id = c.application_id
  join public.profiles pr on pr.id = a.user_id
  join public.events ev on ev.id = a.event_id;
end;
$$;

create function public.admin_retry_failed_broadcast(p_broadcast_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  update public.email_log
  set status = 'pending', claimed_at = null
  where broadcast_id = p_broadcast_id and status = 'failed';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.admin_broadcast_history(p_event_id uuid)
returns table (
  id uuid,
  role public.app_role,
  subject text,
  body text,
  created_at timestamptz,
  sender_email text,
  recipients integer,
  sent integer,
  failed integer,
  pending integer,
  sending integer,
  cancelled integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  return query
  select
    b.id, b.role, b.subject, b.body, b.created_at, p.email::text,
    count(l.id)::integer,
    (count(*) filter (where l.status = 'sent'))::integer,
    (count(*) filter (where l.status = 'failed'))::integer,
    (count(*) filter (where l.status = 'pending'))::integer,
    (count(*) filter (where l.status = 'sending'))::integer,
    (count(*) filter (where l.status = 'cancelled'))::integer
  from public.email_broadcasts b
  left join public.profiles p on p.id = b.created_by
  left join public.email_log l on l.broadcast_id = b.id
  where b.event_id = p_event_id
  group by b.id, p.email
  order by b.created_at desc, b.id desc;
end;
$$;

revoke execute on function
  public.admin_broadcast_recipient_count(uuid, public.app_role),
  public.admin_create_broadcast(uuid, public.app_role, text, text, integer),
  public.admin_claim_broadcast_emails(uuid, integer),
  public.admin_retry_failed_broadcast(uuid),
  public.admin_broadcast_history(uuid)
from public, anon;

grant execute on function
  public.admin_broadcast_recipient_count(uuid, public.app_role),
  public.admin_create_broadcast(uuid, public.app_role, text, text, integer),
  public.admin_claim_broadcast_emails(uuid, integer),
  public.admin_retry_failed_broadcast(uuid),
  public.admin_broadcast_history(uuid)
to authenticated;
