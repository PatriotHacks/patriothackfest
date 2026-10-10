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

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"full_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test', '{"full_name": "Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.test', '{"full_name": "Carol"}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner@example.test', '{"full_name": "Owner"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test', '{"full_name": "Organizer"}'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test', '{"full_name": "Reviewer"}');

insert into public.admin_allowlist (email, level) values
  ('owner@example.test', 'owner'),
  ('organizer@example.test', 'organizer'),
  ('reviewer@example.test', 'reviewer');

insert into public.events (id, slug, name, starts_at) values
  ('e0000000-0000-0000-0000-000000000001', 'pgtap-event', 'pgTAP Event', now() + interval '30 days');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published', now() + interval '1 day', now() + interval '2 days'),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'volunteer', 'Volunteer', 'published', now() + interval '1 day', now() + interval '2 days'),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'judge', 'Judge', 'draft', null, null);

select plan(16);

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select set_config('test.alice_app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true);
select public.submit_application(current_setting('test.alice_app')::uuid);
reset role;

select pg_temp.login('22222222-2222-2222-2222-222222222222', 'bob@example.test');
select set_config('test.bob_app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true);
select public.submit_application(current_setting('test.bob_app')::uuid);
reset role;

select pg_temp.login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test');
select lives_ok(
  format('insert into public.application_decisions (application_id, decision) values (%L, %L)', current_setting('test.alice_app'), 'accepted'),
  'reviewer sets a decision before release'
);
select is(
  (select decided_by from public.application_decisions where application_id = current_setting('test.alice_app')::uuid),
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  'decision is stamped with the deciding admin'
);
select throws_ok(
  $$select public.admin_release_decisions('f0000000-0000-0000-0000-000000000001')$$,
  '42501', 'Organizer access required', 'reviewer cannot release decisions'
);
reset role;

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select is((select count(*) from public.application_decisions), 0::bigint, 'applicant cannot read unreleased decision');
select throws_ok(
  format('insert into public.application_decisions (application_id, decision) values (%L, %L)', current_setting('test.bob_app'), 'rejected'),
  '42501', null, 'applicant cannot write decisions'
);
select throws_ok(
  $$select public.admin_release_decisions('f0000000-0000-0000-0000-000000000001')$$,
  '42501', 'Organizer access required', 'applicant cannot release decisions'
);
reset role;

select pg_temp.login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test');
select lives_ok(
  $$select public.admin_release_decisions('f0000000-0000-0000-0000-000000000001')$$,
  'organizer releases decisions'
);
select throws_ok(
  $$select public.admin_release_decisions('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Form not found or decisions already released', 'decisions cannot be released twice'
);
reset role;

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select is(
  (select decision from public.application_decisions),
  'accepted'::public.decision,
  'applicant reads own decision after release'
);
reset role;

select pg_temp.login('22222222-2222-2222-2222-222222222222', 'bob@example.test');
select is((select count(*) from public.application_decisions), 0::bigint, 'applicant cannot read another applicant decision');
reset role;

select pg_temp.login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test');
update public.application_decisions set decision = 'rejected' where application_id = current_setting('test.alice_app')::uuid;
select is(
  (select decision from public.application_decisions where application_id = current_setting('test.alice_app')::uuid),
  'accepted'::public.decision,
  'reviewer cannot change a decision after release'
);
select throws_ok(
  format('insert into public.application_decisions (application_id, decision) values (%L, %L)', current_setting('test.bob_app'), 'rejected'),
  '42501', null, 'reviewer cannot add a decision after release'
);
reset role;

select pg_temp.login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test');
select lives_ok(
  format('update public.application_decisions set decision = %L where application_id = %L', 'waitlisted', current_setting('test.alice_app')),
  'organizer changes a decision after release'
);
select is(
  (select row(decision, decided_by)::text from public.application_decisions where application_id = current_setting('test.alice_app')::uuid),
  row('waitlisted'::public.decision, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)::text,
  'organizer decision is stored and stamped'
);
select lives_ok(
  format('insert into public.application_decisions (application_id, decision) values (%L, %L)', current_setting('test.bob_app'), 'rejected'),
  'organizer adds a decision after release'
);
reset role;

select pg_temp.login('22222222-2222-2222-2222-222222222222', 'bob@example.test');
select is((select decision from public.application_decisions), 'rejected'::public.decision, 'released decision is visible to its applicant');
reset role;

select * from finish(true);
rollback;
