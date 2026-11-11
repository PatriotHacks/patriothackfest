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

create function pg_temp.owner()
returns void
language sql
as $$
  select pg_temp.login('de000000-0000-0000-0000-0000000000c0', 'audience-owner@example.test');
$$;

create function pg_temp.applicant(p_id uuid)
returns void
language sql
as $$
  select pg_temp.login(p_id, p_id || '@example.test', 'otp');
$$;

create function pg_temp.start(p_id uuid, p_form uuid)
returns uuid
language plpgsql
as $$
declare
  v_app uuid;
begin
  perform pg_temp.applicant(p_id);
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
  perform pg_temp.applicant(p_id);
  perform public.submit_application(v_app);
  reset role;
  return v_app;
end;
$$;

create function pg_temp.withdraw(p_id uuid, p_app text)
returns void
language plpgsql
as $$
begin
  perform pg_temp.applicant(p_id);
  perform public.withdraw_application(current_setting(p_app)::uuid);
  reset role;
end;
$$;

create function pg_temp.count(p_audience public.broadcast_audience, p_role public.app_role default null)
returns integer
language sql
as $$
  select recipients from public.admin_broadcast_recipient_count('ee000000-0000-0000-0000-000000000001', p_audience, p_role)
$$;

create function pg_temp.queued(p_broadcast text)
returns text
language sql
as $$
  select string_agg(p.full_name, ',' order by p.full_name)
  from public.email_log l
  join public.applications a on a.id = l.application_id
  join public.profiles p on p.id = a.user_id
  where l.broadcast_id = current_setting(p_broadcast)::uuid
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('de000000-0000-0000-0000-000000000001', 'de000000-0000-0000-0000-000000000001@example.test', '{"full_name": "Part Submitted"}'),
  ('de000000-0000-0000-0000-000000000002', 'de000000-0000-0000-0000-000000000002@example.test', '{"full_name": "Part Draft"}'),
  ('de000000-0000-0000-0000-000000000003', 'de000000-0000-0000-0000-000000000003@example.test', '{"full_name": "Part Withdrawn Submitted"}'),
  ('de000000-0000-0000-0000-000000000004', 'de000000-0000-0000-0000-000000000004@example.test', '{"full_name": "Part Withdrawn Draft"}'),
  ('de000000-0000-0000-0000-000000000005', 'de000000-0000-0000-0000-000000000005@example.test', '{"full_name": "Part Declined"}'),
  ('de000000-0000-0000-0000-000000000006', 'de000000-0000-0000-0000-000000000006@example.test', '{"full_name": "Vol Submitted"}'),
  ('de000000-0000-0000-0000-000000000007', 'de000000-0000-0000-0000-000000000007@example.test', '{"full_name": "Vol Draft"}'),
  ('de000000-0000-0000-0000-000000000008', 'de000000-0000-0000-0000-000000000008@example.test', '{"full_name": "Other Event Draft"}'),
  ('de000000-0000-0000-0000-0000000000a0', 'audience-organizer@example.test', '{}'),
  ('de000000-0000-0000-0000-0000000000c0', 'audience-owner@example.test', '{}');
update public.profiles set full_name = coalesce(full_name, 'Admin'), school = 'George Mason University', phone = '+17035551234', date_of_birth = '2000-01-01' where email like '%.test';

insert into public.admin_allowlist (email, level) values
  ('audience-owner@example.test', 'owner'),
  ('audience-organizer@example.test', 'organizer');

insert into public.events (id, slug, name) values
  ('ee000000-0000-0000-0000-000000000001', 'pgtap-audience', 'pgTAP Audience'),
  ('ee000000-0000-0000-0000-000000000002', 'pgtap-audience-other', 'pgTAP Audience Other');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema, decisions_released_at) values
  ('fe000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}', now()),
  ('fe000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-000000000001', 'volunteer', 'Volunteer', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Volunteer", "description": null, "fields": []}', null),
  ('fe000000-0000-0000-0000-000000000003', 'ee000000-0000-0000-0000-000000000002', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}', null);

select set_config('test.p_sub', pg_temp.apply('de000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.p_draft', pg_temp.start('de000000-0000-0000-0000-000000000002', 'fe000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.p_wsub', pg_temp.apply('de000000-0000-0000-0000-000000000003', 'fe000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.p_wdraft', pg_temp.start('de000000-0000-0000-0000-000000000004', 'fe000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.p_declined', pg_temp.apply('de000000-0000-0000-0000-000000000005', 'fe000000-0000-0000-0000-000000000001')::text, true);
select pg_temp.apply('de000000-0000-0000-0000-000000000006', 'fe000000-0000-0000-0000-000000000002');
select pg_temp.start('de000000-0000-0000-0000-000000000007', 'fe000000-0000-0000-0000-000000000002');
select pg_temp.start('de000000-0000-0000-0000-000000000008', 'fe000000-0000-0000-0000-000000000003');

select pg_temp.withdraw('de000000-0000-0000-0000-000000000003', 'test.p_wsub');
select pg_temp.withdraw('de000000-0000-0000-0000-000000000004', 'test.p_wdraft');

select pg_temp.login('de000000-0000-0000-0000-0000000000a0', 'audience-organizer@example.test');
insert into public.application_decisions (application_id, decision)
values (current_setting('test.p_declined')::uuid, 'accepted');
reset role;
select pg_temp.applicant('de000000-0000-0000-0000-000000000005');
select public.decline_application_offer(current_setting('test.p_declined')::uuid);
reset role;

select plan(18);

insert into public.email_broadcasts (event_id, subject, body)
values ('ee000000-0000-0000-0000-000000000002', 'Legacy', 'Body');
select is(
  (select audience::text from public.email_broadcasts where event_id = 'ee000000-0000-0000-0000-000000000002'),
  'submitted', 'broadcasts default to the submitted audience'
);
select throws_ok(
  $$insert into public.email_broadcasts (event_id, subject, body, audience) values ('ee000000-0000-0000-0000-000000000002', 's', 'b', null)$$,
  '23502', null, 'audience is required'
);

select pg_temp.owner();
select is(pg_temp.count('draft'), 2, 'the draft audience counts drafts, skipping withdrawn drafts and other events');
select is(pg_temp.count('submitted'), 2, 'the submitted audience skips withdrawn and declined applications');
select is(pg_temp.count('all'), 4, 'the all audience counts drafts and submitted applications');
select is(pg_temp.count('draft', 'participant'), 1, 'the draft audience combines with the role filter');
select is(pg_temp.count('submitted', 'volunteer'), 1, 'the submitted audience combines with the role filter');
select is(pg_temp.count('all', 'participant'), 2, 'the all audience combines with the role filter');
select is(pg_temp.count('draft', 'judge'), 0, 'roles without drafts have no recipients');
select throws_ok(
  $$select public.broadcast_audience_includes('all', 'draft', null)$$,
  '42501', null, 'the audience helper is not callable directly'
);

select set_config('test.b_draft', (select broadcast_id::text from public.admin_create_broadcast(
  'ee000000-0000-0000-0000-000000000001', 'Finish your application', 'Body', 2, 'draft')), true);
select set_config('test.b_all', (select broadcast_id::text from public.admin_create_broadcast(
  'ee000000-0000-0000-0000-000000000001', 'Participants', 'Body', 2, 'all', 'participant')), true);
select set_config('test.b_sub', (select broadcast_id::text from public.admin_create_broadcast(
  'ee000000-0000-0000-0000-000000000001', 'Volunteers', 'Body', 1, 'submitted', 'volunteer')), true);
reset role;

select is(pg_temp.queued('test.b_draft'), 'Part Draft,Vol Draft', 'a draft broadcast queues only drafts');
select is(pg_temp.queued('test.b_all'), 'Part Draft,Part Submitted', 'an all broadcast with a role queues drafts and submitted applications of that role');
select is(pg_temp.queued('test.b_sub'), 'Vol Submitted', 'a submitted broadcast with a role queues submitted applications of that role');
select is(
  (select array_agg(audience::text || ':' || coalesce(role::text, '-') order by audience, role) from public.email_broadcasts
   where event_id = 'ee000000-0000-0000-0000-000000000001'),
  array['draft:-', 'submitted:volunteer', 'all:participant'], 'broadcasts record their audience'
);

select pg_temp.owner();
select is(
  (select array_agg(h.subject || ':' || h.audience::text || ':' || h.recipients order by h.subject)
   from public.admin_broadcast_history('ee000000-0000-0000-0000-000000000001') h),
  array['Finish your application:draft:2', 'Participants:all:2', 'Volunteers:submitted:1'],
  'history includes the audience'
);
reset role;

select pg_temp.applicant('de000000-0000-0000-0000-000000000002');
select public.submit_application(current_setting('test.p_draft')::uuid);
reset role;

select pg_temp.owner();
select is(
  (select string_agg(full_name, ',' order by full_name) from public.admin_claim_broadcast_emails(current_setting('test.b_draft')::uuid, 10)),
  'Vol Draft', 'a draft broadcast skips drafts that submitted after it was queued'
);
reset role;
select is(
  (select l.status || ':' || l.error from public.email_log l
   where l.broadcast_id = current_setting('test.b_draft')::uuid and l.application_id = current_setting('test.p_draft')::uuid),
  'cancelled:Application no longer matches the broadcast',
  'claiming cancels draft broadcast emails to applications that submitted'
);

select pg_temp.owner();
select is(
  (select string_agg(full_name, ',' order by full_name) from public.admin_claim_broadcast_emails(current_setting('test.b_all')::uuid, 10)),
  'Part Draft,Part Submitted', 'an all broadcast still sends to drafts that submitted after it was queued'
);
reset role;

select * from finish(true);
rollback;
