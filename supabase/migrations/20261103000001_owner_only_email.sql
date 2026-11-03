drop policy "Organizers read email templates" on public.email_templates;
drop policy "Organizers update email templates" on public.email_templates;

create policy "Owners read email templates"
on public.email_templates for select
to authenticated
using ((select public.has_admin_level('owner')));

create policy "Owners update email templates"
on public.email_templates for update
to authenticated
using ((select public.has_admin_level('owner')))
with check ((select public.has_admin_level('owner')));

create or replace function public.admin_release_decisions(p_form_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form public.forms;
  v_queued integer;
  v_undecided integer;
begin
  if not public.has_admin_level('owner') then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  select * into v_form from public.forms where id = p_form_id for update;

  if not found then
    raise exception 'Form not found';
  end if;

  if v_form.decisions_released_at is not null then
    raise exception 'Decisions are already released';
  end if;

  if v_form.status <> 'published' then
    raise exception 'Publish the form before releasing decisions';
  end if;

  update public.forms set decisions_released_at = now() where id = p_form_id;

  insert into public.email_log (application_id, form_id, kind, decision)
  select a.id, a.form_id, 'decision_' || d.decision::text, d.decision
  from public.applications a
  join public.application_decisions d on d.application_id = a.id
  where a.form_id = p_form_id
    and a.status = 'submitted'
    and a.declined_at is null
    and d.decision <> 'pending';

  get diagnostics v_queued = row_count;

  select count(*) into v_undecided
  from public.applications a
  left join public.application_decisions d on d.application_id = a.id
  where a.form_id = p_form_id
    and a.status = 'submitted'
    and coalesce(d.decision, 'pending') = 'pending';

  return jsonb_build_object('queued', v_queued, 'undecided', v_undecided);
end;
$$;

create or replace function public.admin_claim_emails(p_form_id uuid, p_limit integer)
returns table (
  id uuid,
  email text,
  full_name text,
  event_name text,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  role public.app_role,
  decision public.decision,
  previous_decision public.decision
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
  set status = 'cancelled', error = 'Application no longer has this decision'
  where e.form_id = p_form_id
    and (e.status = 'pending' or (e.status = 'sending' and e.claimed_at < now() - interval '10 minutes'))
    and not exists (
      select 1
      from public.applications a
      join public.application_decisions d on d.application_id = a.id
      where a.id = e.application_id
        and a.form_id = e.form_id
        and a.status = 'submitted'
        and a.declined_at is null
        and d.decision = e.decision
    );

  return query
  with picked as (
    select e.id
    from public.email_log e
    where e.form_id = p_form_id
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
    returning e.id, e.recipient, e.application_id, e.decision, e.previous_decision
  )
  select c.id, c.recipient::text, pr.full_name, ev.name, ev.starts_at, ev.ends_at, a.role, c.decision, c.previous_decision
  from claimed c
  join public.applications a on a.id = c.application_id
  join public.profiles pr on pr.id = a.user_id
  join public.events ev on ev.id = a.event_id;
end;
$$;

create or replace function public.admin_finish_email(p_id uuid, p_ok boolean, p_error text default null, p_message_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_level('owner') then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  update public.email_log
  set status = case when p_ok then 'sent' else 'failed' end,
      sent_at = case when p_ok then now() end,
      message_id = p_message_id,
      error = case when p_ok then null else p_error end,
      last_error_at = case when p_ok then last_error_at else now() end
  where id = p_id and status = 'sending';

  if not found then
    raise exception 'Email is not being sent';
  end if;
end;
$$;

create or replace function public.admin_retry_failed_emails(p_form_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.has_admin_level('owner') then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  update public.email_log
  set status = 'pending', claimed_at = null
  where form_id = p_form_id and status = 'failed';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_release_counts(p_form_id uuid)
returns table (
  submitted integer,
  accepted integer,
  waitlisted integer,
  rejected integer,
  pending integer,
  undecided integer,
  declined integer,
  emails_pending integer,
  emails_sending integer,
  emails_sent integer,
  emails_failed integer,
  emails_cancelled integer
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
    a.submitted, a.accepted, a.waitlisted, a.rejected, a.pending, a.undecided, a.declined,
    e.pending, e.sending, e.sent, e.failed, e.cancelled
  from (
    select
      count(*)::integer as submitted,
      (count(*) filter (where d.decision = 'accepted'))::integer as accepted,
      (count(*) filter (where d.decision = 'waitlisted'))::integer as waitlisted,
      (count(*) filter (where d.decision = 'rejected'))::integer as rejected,
      (count(*) filter (where d.decision = 'pending'))::integer as pending,
      (count(*) filter (where d.decision is null))::integer as undecided,
      (count(*) filter (where ap.declined_at is not null))::integer as declined
    from public.applications ap
    left join public.application_decisions d on d.application_id = ap.id
    where ap.form_id = p_form_id and ap.status = 'submitted'
  ) a
  cross join (
    select
      (count(*) filter (where l.status = 'pending'))::integer as pending,
      (count(*) filter (where l.status = 'sending'))::integer as sending,
      (count(*) filter (where l.status = 'sent'))::integer as sent,
      (count(*) filter (where l.status = 'failed'))::integer as failed,
      (count(*) filter (where l.status = 'cancelled'))::integer as cancelled
    from public.email_log l
    where l.form_id = p_form_id
  ) e;
end;
$$;

create or replace function public.admin_broadcast_recipient_count(p_event_id uuid, p_role public.app_role default null)
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
        and a.status = 'submitted'
        and a.declined_at is null
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

create or replace function public.admin_create_broadcast(
  p_event_id uuid,
  p_subject text,
  p_body text,
  p_expected integer,
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

create or replace function public.admin_retry_failed_broadcast(p_broadcast_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.has_admin_level('owner') then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  update public.email_log
  set status = 'pending', claimed_at = null
  where broadcast_id = p_broadcast_id and status = 'failed';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_broadcast_history(p_event_id uuid)
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
  if not public.has_admin_level('owner') then
    raise exception 'Owner access required' using errcode = '42501';
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
