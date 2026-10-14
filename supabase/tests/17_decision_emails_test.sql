begin;
create extension if not exists pgtap with schema extensions;

create function pg_temp.login(p_id uuid, p_email text, p_method text default 'oauth', p_provider text default 'google')
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_id,
      'email', p_email,
      'role', 'authenticated',
      'app_metadata', json_build_object('provider', p_provider),
      'amr', json_build_array(json_build_object('method', p_method, 'timestamp', extract(epoch from now())::bigint))
    )::text,
    true
  );
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.apply(p_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_app uuid;
begin
  perform pg_temp.login(p_id, 'applicant@example.test', 'otp');
  v_app := public.start_application('f7000000-0000-0000-0000-000000000001');
  perform public.submit_application(v_app);
  reset role;
  return v_app;
end;
$$;

create function pg_temp.decide(p_app text, p_decision public.decision)
returns void
language plpgsql
as $$
begin
  perform pg_temp.login('d7000000-0000-0000-0000-0000000000a0', 'emails-organizer@example.test');
  insert into public.application_decisions (application_id, decision)
  values (current_setting(p_app)::uuid, p_decision)
  on conflict (application_id) do update set decision = excluded.decision;
  reset role;
end;
$$;

create function pg_temp.emails(p_app text)
returns text
language sql
as $$
  select string_agg(status || ':' || decision || ':' || coalesce(previous_decision::text, '-'), ',' order by status, decision)
  from public.email_log
  where application_id = current_setting(p_app)::uuid
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('d7000000-0000-0000-0000-000000000001', 'acc@emails.test', '{"full_name": "Acc"}'),
  ('d7000000-0000-0000-0000-000000000002', 'wait@emails.test', '{"full_name": "Wait"}'),
  ('d7000000-0000-0000-0000-000000000003', 'rej@emails.test', '{"full_name": "Rej"}'),
  ('d7000000-0000-0000-0000-000000000004', 'pend@emails.test', '{"full_name": "Pend"}'),
  ('d7000000-0000-0000-0000-000000000005', 'und@emails.test', '{"full_name": "Und"}'),
  ('d7000000-0000-0000-0000-000000000006', 'wd@emails.test', '{"full_name": "Wd"}'),
  ('d7000000-0000-0000-0000-000000000007', 'late@emails.test', '{"full_name": "Late"}'),
  ('d7000000-0000-0000-0000-0000000000a0', 'emails-organizer@example.test', '{}'),
  ('d7000000-0000-0000-0000-0000000000b0', 'emails-reviewer@example.test', '{}');
update public.profiles set full_name = coalesce(full_name, 'Applicant'), school = 'George Mason University', phone = '+17035551234', date_of_birth = '2000-01-01' where email like '%.test';

update public.profiles set email = 'stale@emails.test' where id = 'd7000000-0000-0000-0000-000000000002';

insert into public.admin_allowlist (email, level) values
  ('emails-organizer@example.test', 'organizer'),
  ('emails-reviewer@example.test', 'reviewer');

insert into public.events (id, slug, name) values
  ('e7000000-0000-0000-0000-000000000001', 'pgtap-emails', 'pgTAP Emails');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema) values
  ('f7000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}'),
  ('f7000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000001', 'volunteer', 'Volunteer', 'draft',
   null, null, null);

select set_config('test.acc', pg_temp.apply('d7000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.wait', pg_temp.apply('d7000000-0000-0000-0000-000000000002')::text, true);
select set_config('test.rej', pg_temp.apply('d7000000-0000-0000-0000-000000000003')::text, true);
select set_config('test.pend', pg_temp.apply('d7000000-0000-0000-0000-000000000004')::text, true);
select set_config('test.und', pg_temp.apply('d7000000-0000-0000-0000-000000000005')::text, true);
select set_config('test.wd', pg_temp.apply('d7000000-0000-0000-0000-000000000006')::text, true);
select set_config('test.late', pg_temp.apply('d7000000-0000-0000-0000-000000000007')::text, true);

select pg_temp.decide('test.acc', 'accepted');
select pg_temp.decide('test.wait', 'waitlisted');
select pg_temp.decide('test.rej', 'rejected');
select pg_temp.decide('test.pend', 'pending');
select pg_temp.decide('test.wd', 'accepted');

select pg_temp.login('d7000000-0000-0000-0000-000000000006', 'wd@emails.test', 'otp');
select public.withdraw_application(current_setting('test.wd')::uuid);
reset role;

select plan(30);

select is((select count(*) from public.email_log where form_id = 'f7000000-0000-0000-0000-000000000001'), 0::bigint, 'decisions before release queue nothing');

select pg_temp.login('d7000000-0000-0000-0000-0000000000b0', 'emails-reviewer@example.test');
select throws_ok(
  $$select public.admin_release_decisions('f7000000-0000-0000-0000-000000000001')$$,
  '42501', 'Organizer access required', 'reviewer cannot release decisions'
);
reset role;

select pg_temp.login('d7000000-0000-0000-0000-0000000000a0', 'emails-organizer@example.test');
select throws_ok(
  $$select public.admin_release_decisions('f7000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Publish the form before releasing decisions', 'unpublished forms cannot be released'
);
select is(
  public.admin_release_decisions('f7000000-0000-0000-0000-000000000001'),
  '{"queued": 3, "undecided": 3}'::jsonb,
  'release queues final decisions and counts undecided applications'
);
select throws_ok(
  $$select public.admin_release_decisions('f7000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Decisions are already released', 'release is one-shot'
);
reset role;

select is(
  (select string_agg(kind || ':' || status || ':' || coalesce(previous_decision::text, '-'), ',' order by kind)
   from public.email_log where form_id = 'f7000000-0000-0000-0000-000000000001'),
  'decision_accepted:pending:-,decision_rejected:pending:-,decision_waitlisted:pending:-',
  'release queues one pending email per final decision, skipping withdrawn applications'
);

select pg_temp.login('d7000000-0000-0000-0000-0000000000b0', 'emails-reviewer@example.test');
select is((select count(*) from public.email_log), 0::bigint, 'reviewer cannot read the email log');
select throws_ok(
  $$select * from public.admin_claim_emails('f7000000-0000-0000-0000-000000000001', 10)$$,
  '42501', 'Organizer access required', 'reviewer cannot claim emails'
);
select throws_ok(
  $$select public.admin_retry_failed_emails('f7000000-0000-0000-0000-000000000001')$$,
  '42501', 'Organizer access required', 'reviewer cannot retry emails'
);
reset role;

select pg_temp.login('d7000000-0000-0000-0000-000000000001', 'acc@emails.test', 'otp');
select throws_ok(
  $$select * from public.admin_claim_emails('f7000000-0000-0000-0000-000000000001', 10)$$,
  '42501', 'Organizer access required', 'applicant cannot claim emails'
);
select throws_ok(
  $$select public.admin_finish_email(gen_random_uuid(), true)$$,
  '42501', 'Organizer access required', 'applicant cannot finish emails'
);
select public.decline_application_offer(current_setting('test.acc')::uuid);
reset role;

select pg_temp.login('d7000000-0000-0000-0000-0000000000a0', 'emails-organizer@example.test');
select is(
  (select string_agg(concat_ws('|', email, full_name, event_name, role, decision, coalesce(previous_decision::text, '-')), ',' order by email)
   from public.admin_claim_emails('f7000000-0000-0000-0000-000000000001', 10)),
  'rej@emails.test|Rej|pgTAP Emails|participant|rejected|-,wait@emails.test|Wait|pgTAP Emails|participant|waitlisted|-',
  'claim returns recipient from auth.users, name, event, role, and decision'
);
select is(
  (select count(*) from public.email_log where status = 'sending' and attempts = 1 and claimed_at is not null and recipient is not null),
  2::bigint,
  'claimed emails are marked sending'
);
select is(pg_temp.emails('test.acc'), 'cancelled:accepted:-', 'claim cancels emails for declined applications');
select is(
  (select count(*) from public.admin_claim_emails('f7000000-0000-0000-0000-000000000001', 10)),
  0::bigint,
  'in-flight emails are not claimed again'
);
select lives_ok(
  format('select public.admin_finish_email(id, true, null, %L) from public.email_log where application_id = %L', 'msg-1', current_setting('test.wait')),
  'organizer marks an email sent'
);
select lives_ok(
  format('select public.admin_finish_email(id, false, %L) from public.email_log where application_id = %L', 'SMTP down', current_setting('test.rej')),
  'organizer marks an email failed'
);
select throws_ok(
  format('select public.admin_finish_email(id, true) from public.email_log where application_id = %L', current_setting('test.wait')),
  'P0001', 'Email is not being sent', 'an email cannot be finished twice'
);
reset role;

select is(
  (select row(status, message_id, sent_at is not null)::text from public.email_log where application_id = current_setting('test.wait')::uuid),
  row('sent', 'msg-1', true)::text,
  'sent email stores its message id'
);
select is(
  (select row(status, error, last_error_at is not null)::text from public.email_log where application_id = current_setting('test.rej')::uuid),
  row('failed', 'SMTP down', true)::text,
  'failed email stores its error'
);

select pg_temp.decide('test.late', 'accepted');
select is(pg_temp.emails('test.late'), 'pending:accepted:-', 'a decision after release queues an email');

select pg_temp.decide('test.wait', 'accepted');
select is(pg_temp.emails('test.wait'), 'pending:accepted:waitlisted,sent:waitlisted:-', 'promotion records the previously emailed decision');

select pg_temp.decide('test.wait', 'waitlisted');
select is(pg_temp.emails('test.wait'), 'cancelled:accepted:waitlisted,sent:waitlisted:-', 'reverting to the emailed decision cancels the queued email');

select pg_temp.decide('test.late', 'rejected');
select is(pg_temp.emails('test.late'), 'cancelled:accepted:-,pending:rejected:-', 'a changed decision supersedes the queued email');

select pg_temp.decide('test.late', 'pending');
select is(pg_temp.emails('test.late'), 'cancelled:accepted:-,cancelled:rejected:-', 'moving back to pending cancels the queued email');

select pg_temp.login('d7000000-0000-0000-0000-0000000000a0', 'emails-organizer@example.test');
select is(public.admin_retry_failed_emails('f7000000-0000-0000-0000-000000000001'), 1, 'retry moves failed emails back to pending');
select is(
  (select count(*) from public.admin_claim_emails('f7000000-0000-0000-0000-000000000001', 10)),
  1::bigint,
  'retried email is claimed again'
);
reset role;

update public.email_log set claimed_at = now() - interval '11 minutes' where application_id = current_setting('test.rej')::uuid;

select pg_temp.login('d7000000-0000-0000-0000-0000000000a0', 'emails-organizer@example.test');
select is(
  (select count(*) from public.admin_claim_emails('f7000000-0000-0000-0000-000000000001', 10)),
  1::bigint,
  'stale sending emails are reclaimed'
);
reset role;

select is(
  (select attempts from public.email_log where application_id = current_setting('test.rej')::uuid),
  3,
  'each claim counts an attempt'
);
select ok(
  not has_function_privilege('authenticated', 'public.queue_decision_email(uuid, uuid, public.decision)', 'execute'),
  'authenticated cannot queue emails directly'
);

select * from finish(true);
rollback;
