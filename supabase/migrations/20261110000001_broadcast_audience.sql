create type public.broadcast_audience as enum ('draft', 'submitted', 'all');

alter table public.email_broadcasts
  add column audience public.broadcast_audience not null default 'submitted';

create function public.broadcast_audience_includes(
  p_audience public.broadcast_audience,
  p_status public.application_status,
  p_declined_at timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_declined_at is null and case p_audience
    when 'draft' then p_status = 'draft'
    when 'submitted' then p_status = 'submitted'
    when 'all' then p_status in ('draft', 'submitted')
  end
$$;

drop function public.admin_broadcast_recipient_count(uuid, public.app_role);
drop function public.admin_create_broadcast(uuid, text, text, integer, public.app_role);
drop function public.admin_broadcast_history(uuid);

create function public.admin_broadcast_recipient_count(
  p_event_id uuid,
  p_audience public.broadcast_audience,
  p_role public.app_role default null
)
returns table (recipients integer, daily_used integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_level('owner') then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  return query
  select
    (
      select count(*)::integer
      from public.applications a
      where a.event_id = p_event_id
        and public.broadcast_audience_includes(p_audience, a.status, a.declined_at)
        and (p_role is null or a.role = p_role)
    ),
    (
      select count(*)::integer
      from public.email_log l
      where l.status in ('pending', 'sending')
        or (l.status = 'sent' and l.sent_at > now() - interval '24 hours')
    );
end;
$$;

create function public.admin_create_broadcast(
  p_event_id uuid,
  p_subject text,
  p_body text,
  p_expected integer,
  p_audience public.broadcast_audience,
  p_role public.app_role default null
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
  if not public.has_admin_level('owner') then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  with new_broadcast as (
    insert into public.email_broadcasts (event_id, audience, role, subject, body, created_by)
    values (p_event_id, p_audience, p_role, p_subject, p_body, auth.uid())
    returning id
  ),
  new_emails as (
    insert into public.email_log (application_id, broadcast_id, kind)
    select a.id, b.id, 'broadcast'
    from new_broadcast b
    cross join public.applications a
    where a.event_id = p_event_id
      and public.broadcast_audience_includes(p_audience, a.status, a.declined_at)
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

create or replace function public.admin_claim_broadcast_emails(p_broadcast_id uuid, p_limit integer)
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
  if not public.has_admin_level('owner') then
    raise exception 'Owner access required' using errcode = '42501';
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
        and public.broadcast_audience_includes(b.audience, a.status, a.declined_at)
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

create function public.admin_broadcast_history(p_event_id uuid)
returns table (
  id uuid,
  audience public.broadcast_audience,
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
  if not public.has_admin_level('owner') then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  return query
  select
    b.id, b.audience, b.role, b.subject, b.body, b.created_at, p.email::text,
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
  public.broadcast_audience_includes(public.broadcast_audience, public.application_status, timestamptz)
from public, anon, authenticated;

revoke execute on function
  public.admin_broadcast_recipient_count(uuid, public.broadcast_audience, public.app_role),
  public.admin_create_broadcast(uuid, text, text, integer, public.broadcast_audience, public.app_role),
  public.admin_broadcast_history(uuid)
from public, anon;

grant execute on function
  public.admin_broadcast_recipient_count(uuid, public.broadcast_audience, public.app_role),
  public.admin_create_broadcast(uuid, text, text, integer, public.broadcast_audience, public.app_role),
  public.admin_broadcast_history(uuid)
to authenticated;
