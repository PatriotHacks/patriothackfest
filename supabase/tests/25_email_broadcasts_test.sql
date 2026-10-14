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

create function pg_temp.organizer()
returns void
language sql
as $$
  select pg_temp.login('dc000000-0000-0000-0000-0000000000a0', 'broadcast-organizer@example.test');
$$;

create function pg_temp.start(p_id uuid, p_form uuid)
returns uuid
language plpgsql
as $$
declare
  v_app uuid;
begin
  perform pg_temp.login(p_id, p_id || '@example.test', 'otp');
  v_app := public.start_application(p_form);
  reset role;
  return v_app;
end;
$$;

create function pg_temp.apply(p_id uuid, p_form uuid)
returns uuid
language plpgsql
as $$
declare
  v_app uuid;
begin
  v_app := pg_temp.start(p_id, p_form);
  perform pg_temp.login(p_id, p_id || '@example.test', 'otp');
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
  perform pg_temp.organizer();
  insert into public.application_decisions (application_id, decision)
  values (current_setting(p_app)::uuid, p_decision)
  on conflict (application_id) do update set decision = excluded.decision;
  reset role;
end;
$$;

create function pg_temp.row_id(p_broadcast text, p_app text)
returns uuid
language sql
as $$
  select id from public.email_log
  where broadcast_id = current_setting(p_broadcast)::uuid
    and application_id = current_setting(p_app)::uuid
$$;

create function pg_temp.sent_last_24h()
returns integer
language sql
as $$
  select count(*)::integer from public.email_log
  where status = 'sent' and sent_at > now() - interval '24 hours'
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('dc000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000001@example.test', '{"full_name": "Part One"}'),
  ('dc000000-0000-0000-0000-000000000002', 'dc000000-0000-0000-0000-000000000002@example.test', '{"full_name": "Part Two"}'),
  ('dc000000-0000-0000-0000-000000000003', 'dc000000-0000-0000-0000-000000000003@example.test', '{"full_name": "Draft"}'),
  ('dc000000-0000-0000-0000-000000000004', 'dc000000-0000-0000-0000-000000000004@example.test', '{"full_name": "Withdrawn"}'),
  ('dc000000-0000-0000-0000-000000000005', 'dc000000-0000-0000-0000-000000000005@example.test', '{"full_name": "Declined"}'),
  ('dc000000-0000-0000-0000-000000000006', 'dc000000-0000-0000-0000-000000000006@example.test', '{"full_name": "Vol"}'),
  ('dc000000-0000-0000-0000-000000000007', 'dc000000-0000-0000-0000-000000000007@example.test', '{"full_name": "Other Event"}'),
  ('dc000000-0000-0000-0000-0000000000a0', 'broadcast-organizer@example.test', '{}'),
  ('dc000000-0000-0000-0000-0000000000b0', 'broadcast-reviewer@example.test', '{}');
update public.profiles set full_name = coalesce(full_name, 'Applicant'), school = 'George Mason University', phone = '+17035551234', date_of_birth = '2000-01-01' where email like '%.test';

insert into public.admin_allowlist (email, level) values
  ('broadcast-organizer@example.test', 'organizer'),
  ('broadcast-reviewer@example.test', 'reviewer');

insert into public.events (id, slug, name) values
  ('ec000000-0000-0000-0000-000000000001', 'pgtap-broadcasts', 'pgTAP Broadcasts'),
  ('ec000000-0000-0000-0000-000000000002', 'pgtap-broadcasts-other', 'pgTAP Broadcasts Other');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema, decisions_released_at) values
  ('fc000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}', now()),
  ('fc000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-000000000001', 'volunteer', 'Volunteer', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Volunteer", "description": null, "fields": []}', null),
  ('fc000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000002', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}', null);

select set_config('test.p1', pg_temp.apply('dc000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.p2', pg_temp.apply('dc000000-0000-0000-0000-000000000002', 'fc000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.draft', pg_temp.start('dc000000-0000-0000-0000-000000000003', 'fc000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.withdrawn', pg_temp.apply('dc000000-0000-0000-0000-000000000004', 'fc000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.declined', pg_temp.apply('dc000000-0000-0000-0000-000000000005', 'fc000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.v1', pg_temp.apply('dc000000-0000-0000-0000-000000000006', 'fc000000-0000-0000-0000-000000000002')::text, true);
select pg_temp.apply('dc000000-0000-0000-0000-000000000007', 'fc000000-0000-0000-0000-000000000003');

select pg_temp.login('dc000000-0000-0000-0000-000000000004', 'dc000000-0000-0000-0000-000000000004@example.test', 'otp');
select public.withdraw_application(current_setting('test.withdrawn')::uuid);
reset role;

select pg_temp.decide('test.declined', 'accepted');
select pg_temp.login('dc000000-0000-0000-0000-000000000005', 'dc000000-0000-0000-0000-000000000005@example.test', 'otp');
select public.decline_application_offer(current_setting('test.declined')::uuid);
reset role;

select pg_temp.decide('test.p1', 'accepted');

select plan(40);

select pg_temp.login('dc000000-0000-0000-0000-0000000000b0', 'broadcast-reviewer@example.test');
select throws_ok($$select * from public.admin_broadcast_recipient_count('ec000000-0000-0000-0000-000000000001', null)$$,
  '42501', 'Organizer access required', 'reviewer cannot count recipients');
select throws_ok($$select * from public.admin_create_broadcast('ec000000-0000-0000-0000-000000000001', null, 's', 'b', 3)$$,
  '42501', 'Organizer access required', 'reviewer cannot create broadcasts');
select throws_ok($$select * from public.admin_claim_broadcast_emails(gen_random_uuid(), 10)$$,
  '42501', 'Organizer access required', 'reviewer cannot claim broadcast emails');
select throws_ok($$select public.admin_retry_failed_broadcast(gen_random_uuid())$$,
  '42501', 'Organizer access required', 'reviewer cannot retry broadcasts');
select throws_ok($$select * from public.admin_broadcast_history('ec000000-0000-0000-0000-000000000001')$$,
  '42501', 'Organizer access required', 'reviewer cannot read broadcast history');
reset role;

select pg_temp.login('dc000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000001@example.test', 'otp');
select throws_ok($$select * from public.admin_broadcast_recipient_count('ec000000-0000-0000-0000-000000000001', null)$$,
  '42501', 'Organizer access required', 'applicant cannot count recipients');
select throws_ok($$select * from public.admin_create_broadcast('ec000000-0000-0000-0000-000000000001', null, 's', 'b', 3)$$,
  '42501', 'Organizer access required', 'applicant cannot create broadcasts');
select throws_ok($$select * from public.admin_claim_broadcast_emails(gen_random_uuid(), 10)$$,
  '42501', 'Organizer access required', 'applicant cannot claim broadcast emails');
select throws_ok($$select public.admin_retry_failed_broadcast(gen_random_uuid())$$,
  '42501', 'Organizer access required', 'applicant cannot retry broadcasts');
select throws_ok($$select * from public.admin_broadcast_history('ec000000-0000-0000-0000-000000000001')$$,
  '42501', 'Organizer access required', 'applicant cannot read broadcast history');
reset role;

select set_config('test.sent_before', pg_temp.sent_last_24h()::text, true);

select pg_temp.organizer();
select is(
  (select row(c.*)::text from public.admin_broadcast_recipient_count('ec000000-0000-0000-0000-000000000001', null) c),
  format('(3,%s)', current_setting('test.sent_before')),
  'counts submitted applications of every role, skipping drafts, withdrawn, declined, and other events'
);
select is(
  (select recipients from public.admin_broadcast_recipient_count('ec000000-0000-0000-0000-000000000001', 'participant')),
  2, 'filters recipients by role'
);
select is(
  (select recipients from public.admin_broadcast_recipient_count('ec000000-0000-0000-0000-000000000001', 'judge')),
  0, 'roles without applicants have no recipients'
);
select throws_ok(
  $$select * from public.admin_create_broadcast('ec000000-0000-0000-0000-000000000001', 'participant', 's', 'b', 3)$$,
  'P0001', 'The number of recipients changed from 3 to 2. Review and send again.',
  'a stale recipient count is rejected'
);
select throws_ok(
  $$select * from public.admin_create_broadcast('ec000000-0000-0000-0000-000000000001', 'judge', 's', 'b', 0)$$,
  'P0001', 'No applicants to email', 'a broadcast needs recipients'
);
select throws_ok(
  $$select * from public.admin_create_broadcast('ec000000-0000-0000-0000-000000000001', null, ' ', 'b', 3)$$,
  '23514', null, 'blank subjects are rejected'
);
select is(
  (select count(*) from public.email_broadcasts where event_id = 'ec000000-0000-0000-0000-000000000001'),
  0::bigint, 'rejected broadcasts leave nothing behind'
);
select set_config('test.b1', (select broadcast_id::text from public.admin_create_broadcast(
  'ec000000-0000-0000-0000-000000000001', null, 'Hello {{name}}', 'Body', 3)), true);
select set_config('test.b2', (select broadcast_id::text from public.admin_create_broadcast(
  'ec000000-0000-0000-0000-000000000001', 'participant', 'Participants', 'Body', 2)), true);
select is(
  (select count(*) from public.email_broadcasts where event_id = 'ec000000-0000-0000-0000-000000000001'),
  2::bigint, 'organizers read broadcasts and may run them concurrently'
);
reset role;

update public.email_broadcasts set created_at = now() - interval '1 hour' where id = current_setting('test.b1')::uuid;

select is(
  (select string_agg(a.role || ':' || l.kind || ':' || l.status || ':' || coalesce(l.form_id::text, '-') || ':' || coalesce(l.decision::text, '-'), ',' order by a.role)
   from public.email_log l join public.applications a on a.id = l.application_id
   where l.broadcast_id = current_setting('test.b1')::uuid),
  'participant:broadcast:pending:-:-,participant:broadcast:pending:-:-,volunteer:broadcast:pending:-:-',
  'queues one pending broadcast email per recipient'
);
select is(
  (select created_by from public.email_broadcasts where id = current_setting('test.b1')::uuid),
  'dc000000-0000-0000-0000-0000000000a0'::uuid, 'records the sender'
);

select throws_ok(
  format($$insert into public.email_log (application_id, broadcast_id, form_id, kind) values (%L, %L, 'fc000000-0000-0000-0000-000000000001', 'broadcast')$$,
    current_setting('test.v1'), current_setting('test.b2')),
  '23514', null, 'broadcast emails cannot have a form'
);
select throws_ok(
  format($$insert into public.email_log (application_id, broadcast_id, kind, decision) values (%L, %L, 'broadcast', 'accepted')$$,
    current_setting('test.v1'), current_setting('test.b2')),
  '23514', null, 'broadcast emails cannot have a decision'
);
select throws_ok(
  format($$insert into public.email_log (application_id, kind) values (%L, 'broadcast')$$, current_setting('test.v1')),
  '23514', null, 'broadcast kind requires a broadcast'
);
select throws_ok(
  format($$insert into public.email_log (application_id, broadcast_id, form_id, kind, decision) values (%L, %L, 'fc000000-0000-0000-0000-000000000001', 'decision_accepted', 'accepted')$$,
    current_setting('test.p1'), current_setting('test.b2')),
  '23514', null, 'decision emails cannot belong to a broadcast'
);
select throws_ok(
  format($$insert into public.email_log (application_id, broadcast_id, kind) values (%L, %L, 'broadcast')$$,
    current_setting('test.p1'), current_setting('test.b2')),
  '23505', null, 'each application gets one email per broadcast'
);

select pg_temp.decide('test.p1', 'waitlisted');
select is(
  (select string_agg(coalesce(kind, '-') || ':' || status, ',' order by kind, status)
   from public.email_log where application_id = current_setting('test.p1')::uuid),
  'broadcast:pending,broadcast:pending,decision_accepted:cancelled,decision_waitlisted:pending',
  'a new decision supersedes decision emails but not broadcast emails'
);

update public.email_log set status = 'failed', claimed_at = now(), error = 'boom'
where id = pg_temp.row_id('test.b1', 'test.p1');

select pg_temp.organizer();
select is(
  (select row(emails_pending, emails_sending, emails_sent, emails_failed, emails_cancelled)::text
   from public.admin_release_counts('fc000000-0000-0000-0000-000000000001')),
  '(1,0,0,0,2)', 'release counts ignore broadcast emails'
);
select is(public.admin_retry_failed_emails('fc000000-0000-0000-0000-000000000001'), 0, 'decision retry ignores broadcast emails');
select is(
  (select array_agg(decision::text) from public.admin_claim_emails('fc000000-0000-0000-0000-000000000001', 10)),
  array['waitlisted'], 'decision claims ignore broadcast emails'
);
select is(public.admin_retry_failed_broadcast(current_setting('test.b1')::uuid), 1, 'retries failed broadcast emails');
reset role;

update public.email_log set status = 'sending', claimed_at = now() - interval '1 hour'
where id = pg_temp.row_id('test.b1', 'test.p2');
select pg_temp.login('dc000000-0000-0000-0000-000000000002', 'dc000000-0000-0000-0000-000000000002@example.test', 'otp');
select public.withdraw_application(current_setting('test.p2')::uuid);
reset role;
select is(
  (select status || ':' || error from public.email_log where id = pg_temp.row_id('test.b2', 'test.p2')),
  'cancelled:Application withdrawn', 'withdrawing cancels pending broadcast emails'
);

select pg_temp.organizer();
select is(
  (select string_agg(email || ':' || full_name || ':' || event_name, ',' order by email)
   from public.admin_claim_broadcast_emails(current_setting('test.b1')::uuid, 10)),
  'dc000000-0000-0000-0000-000000000001@example.test:Part One:pgTAP Broadcasts,dc000000-0000-0000-0000-000000000006@example.test:Vol:pgTAP Broadcasts',
  'claims eligible broadcast emails with recipient details'
);
reset role;
select is(
  (select status || ':' || error from public.email_log where id = pg_temp.row_id('test.b1', 'test.p2')),
  'cancelled:Application no longer matches the broadcast',
  'claiming cancels emails to applications that no longer qualify'
);
select is(
  (select count(*) from public.email_log where broadcast_id = current_setting('test.b1')::uuid and status = 'sending'),
  2::bigint, 'claimed broadcast emails are marked as sending'
);

select pg_temp.organizer();
select public.admin_finish_email(pg_temp.row_id('test.b1', 'test.p1'), true, null, 'message-1');
select is(
  (select sent_last_24h from public.admin_broadcast_recipient_count('ec000000-0000-0000-0000-000000000001', null)),
  current_setting('test.sent_before')::integer + 1, 'counts emails sent in the last day'
);
select is(
  (select array_agg(row(h.subject, h.role, h.sender_email, h.recipients, h.sent, h.failed, h.pending, h.sending, h.cancelled)::text order by h.created_at desc)
   from public.admin_broadcast_history('ec000000-0000-0000-0000-000000000001') h),
  array[
    '(Participants,participant,broadcast-organizer@example.test,2,0,0,1,0,1)',
    '("Hello {{name}}",,broadcast-organizer@example.test,3,1,0,0,1,1)'
  ],
  'history lists broadcasts newest first with delivery counts'
);
select is(
  (select array_agg(id) from public.admin_broadcast_history('ec000000-0000-0000-0000-000000000001')),
  array[current_setting('test.b2')::uuid, current_setting('test.b1')::uuid],
  'history is ordered newest first'
);
reset role;

select pg_temp.login('dc000000-0000-0000-0000-0000000000b0', 'broadcast-reviewer@example.test');
select is((select count(*) from public.email_broadcasts), 0::bigint, 'reviewers cannot read broadcasts');
select throws_ok(
  $$insert into public.email_broadcasts (event_id, subject, body) values ('ec000000-0000-0000-0000-000000000001', 's', 'b')$$,
  '42501', null, 'reviewers cannot insert broadcasts'
);
reset role;

select pg_temp.organizer();
select throws_ok(
  format($$update public.email_broadcasts set subject = 'x' where id = %L$$, current_setting('test.b1')),
  '42501', null, 'organizers cannot edit broadcasts'
);
reset role;

select * from finish(true);
rollback;
