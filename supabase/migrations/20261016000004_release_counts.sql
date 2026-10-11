create function public.admin_release_counts(p_form_id uuid)
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
  if not public.has_admin_level('organizer') then
    raise exception 'Organizer access required' using errcode = '42501';
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

revoke execute on function public.admin_release_counts(uuid) from public, anon;
grant execute on function public.admin_release_counts(uuid) to authenticated;
