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
  where application_id = p_application_id and status in ('pending', 'failed');

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
