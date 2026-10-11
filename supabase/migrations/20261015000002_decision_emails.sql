alter table public.email_log
  drop constraint email_log_application_id_kind_key,
  drop constraint email_log_status_check,
  alter column recipient drop not null,
  add column form_id uuid not null references public.forms (id) on delete cascade,
  add column decision public.decision not null,
  add column previous_decision public.decision,
  add column attempts integer not null default 0,
  add column claimed_at timestamptz,
  add column message_id text,
  add column last_error_at timestamptz,
  add constraint email_log_status_check check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  add constraint email_log_decision_check check (decision in ('accepted', 'waitlisted', 'rejected')),
  add constraint email_log_kind_check check (
    kind in ('decision_accepted', 'decision_waitlisted', 'decision_rejected')
    and kind = 'decision_' || decision::text
  );

create index email_log_form_id_status_idx on public.email_log (form_id, status);
create index email_log_application_id_idx on public.email_log (application_id);

create function public.queue_decision_email(p_application_id uuid, p_form_id uuid, p_decision public.decision)
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
  where application_id = p_application_id and status in ('pending', 'failed');

  select e.decision into v_last
  from public.email_log e
  where e.application_id = p_application_id and e.status in ('sending', 'sent')
  order by e.claimed_at desc
  limit 1;

  if p_decision <> 'pending' and p_decision is distinct from v_last then
    insert into public.email_log (application_id, form_id, kind, decision, previous_decision)
    values (p_application_id, p_form_id, 'decision_' || p_decision::text, p_decision, v_last);
  end if;
end;
$$;

create function public.queue_released_decision_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form_id uuid;
begin
  if tg_op = 'UPDATE' and new.decision = old.decision then
    return null;
  end if;

  select f.id into v_form_id
  from public.applications a
  join public.forms f on f.id = a.form_id
  where a.id = new.application_id and f.decisions_released_at is not null;

  if found then
    perform public.queue_decision_email(new.application_id, v_form_id, new.decision);
  end if;

  return null;
end;
$$;

create trigger application_decisions_queue_email
after insert or update on public.application_decisions
for each row execute function public.queue_released_decision_email();

drop function public.admin_release_decisions(uuid);

create function public.admin_release_decisions(p_form_id uuid)
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
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
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

create function public.admin_claim_emails(p_form_id uuid, p_limit integer)
returns table (
  id uuid,
  email text,
  full_name text,
  event_name text,
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
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
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
  select c.id, c.recipient::text, pr.full_name, ev.name, a.role, c.decision, c.previous_decision
  from claimed c
  join public.applications a on a.id = c.application_id
  join public.profiles pr on pr.id = a.user_id
  join public.events ev on ev.id = a.event_id;
end;
$$;

create function public.admin_finish_email(p_id uuid, p_ok boolean, p_error text default null, p_message_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
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

create function public.admin_retry_failed_emails(p_form_id uuid)
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
  where form_id = p_form_id and status = 'failed';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function
  public.queue_decision_email(uuid, uuid, public.decision),
  public.queue_released_decision_email()
from public, anon, authenticated;

revoke execute on function
  public.admin_release_decisions(uuid),
  public.admin_claim_emails(uuid, integer),
  public.admin_finish_email(uuid, boolean, text, text),
  public.admin_retry_failed_emails(uuid)
from public, anon;

grant execute on function
  public.admin_release_decisions(uuid),
  public.admin_claim_emails(uuid, integer),
  public.admin_finish_email(uuid, boolean, text, text),
  public.admin_retry_failed_emails(uuid)
to authenticated;
