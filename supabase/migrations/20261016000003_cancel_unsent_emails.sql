create function public.cancel_unsent_decision_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_log
  set status = 'cancelled',
      error = case
        when new.form_id <> old.form_id then 'Application moved to another form'
        when new.status = 'withdrawn' then 'Application withdrawn'
        else 'Applicant declined the offer'
      end
  where application_id = new.id and status in ('pending', 'failed');

  return null;
end;
$$;

create trigger applications_cancel_unsent_emails
after update on public.applications
for each row
when (
  new.form_id <> old.form_id
  or (new.status = 'withdrawn' and old.status <> 'withdrawn')
  or (new.declined_at is not null and old.declined_at is null)
)
execute function public.cancel_unsent_decision_emails();

revoke execute on function public.cancel_unsent_decision_emails() from public, anon, authenticated;
