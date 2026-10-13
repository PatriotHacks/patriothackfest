drop function public.admin_claim_emails(uuid, integer);

create function public.admin_claim_emails(p_form_id uuid, p_limit integer)
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
  select c.id, c.recipient::text, pr.full_name, ev.name, ev.starts_at, ev.ends_at, a.role, c.decision, c.previous_decision
  from claimed c
  join public.applications a on a.id = c.application_id
  join public.profiles pr on pr.id = a.user_id
  join public.events ev on ev.id = a.event_id;
end;
$$;

revoke execute on function public.admin_claim_emails(uuid, integer) from public, anon;
grant execute on function public.admin_claim_emails(uuid, integer) to authenticated;
