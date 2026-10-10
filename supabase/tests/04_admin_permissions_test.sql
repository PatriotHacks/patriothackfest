begin;
create extension if not exists pgtap with schema extensions;

create function pg_temp.login(p_id uuid, p_email text, p_provider text default 'google')
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_id,
      'email', p_email,
      'role', 'authenticated',
      'app_metadata', json_build_object('provider', p_provider)
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

select plan(28);

insert into public.events (id, slug, name, starts_at) values
  ('e0000000-0000-0000-0000-000000000002', 'pgtap-event-2', 'pgTAP Event 2', now() + interval '60 days');

select pg_temp.login('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Owner@Example.test');
select is(public.current_admin_level(), 'owner'::public.admin_level, 'admin level matches email case-insensitively');
select ok(public.has_admin_level('reviewer'), 'owner satisfies reviewer level');
select is((select count(*) from public.admin_allowlist), 3::bigint, 'owner reads the allowlist');
select lives_ok(
  $$insert into public.admin_allowlist (email, level) values ('new-reviewer@example.test', 'reviewer')$$,
  'owner adds an allowlist entry'
);
select is(
  (select created_by from public.admin_allowlist where email = 'new-reviewer@example.test'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'allowlist entry records its creator'
);
select lives_ok(
  $$update public.admin_allowlist set level = 'organizer' where email = 'new-reviewer@example.test'$$,
  'owner changes an allowlist level'
);
select lives_ok(
  $$delete from public.admin_allowlist where email = 'new-reviewer@example.test'$$,
  'owner removes an allowlist entry'
);
reset role;

select pg_temp.login('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner@example.test', 'email');
select is(public.current_admin_level(), null::public.admin_level, 'allowlisted email without Google sign-in has no admin level');
reset role;

select pg_temp.login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test');
select is(public.current_admin_level(), 'organizer'::public.admin_level, 'organizer level resolves');
select ok(not public.has_admin_level('owner'), 'organizer does not satisfy owner level');
select is((select count(*) from public.admin_allowlist), 0::bigint, 'organizer cannot read the allowlist');
select throws_ok(
  $$insert into public.admin_allowlist (email, level) values ('sneaky@example.test', 'owner')$$,
  '42501', null, 'organizer cannot add allowlist entries'
);
select lives_ok(
  $$insert into public.forms (event_id, role, title) values ('e0000000-0000-0000-0000-000000000002', 'participant', 'Participant')$$,
  'organizer creates a form'
);
reset role;

select pg_temp.login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test');
select throws_ok(
  $$insert into public.forms (event_id, role, title) values ('e0000000-0000-0000-0000-000000000002', 'volunteer', 'Volunteer')$$,
  '42501', null, 'reviewer cannot create forms'
);
delete from public.admin_allowlist;
reset role;

select is((select count(*) from public.admin_allowlist), 3::bigint, 'reviewer cannot delete allowlist entries');

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select set_config('test.alice_app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true);
select public.save_application_answers(current_setting('test.alice_app')::uuid, '{"q": "participant answer"}');
select public.submit_application(current_setting('test.alice_app')::uuid);
select throws_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.alice_app'), 'volunteer'),
  '42501', 'Organizer access required', 'applicant cannot change roles'
);
reset role;

select pg_temp.login('22222222-2222-2222-2222-222222222222', 'bob@example.test');
select set_config('test.bob_app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true);
select public.withdraw_application(current_setting('test.bob_app')::uuid);
reset role;

select pg_temp.login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test');
select throws_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.alice_app'), 'volunteer'),
  '42501', 'Organizer access required', 'reviewer cannot change roles'
);
reset role;

insert into public.application_decisions (application_id, decision)
values (current_setting('test.alice_app')::uuid, 'accepted');
delete from public.forms where id = 'f0000000-0000-0000-0000-000000000003';

select pg_temp.login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test');
select throws_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.alice_app'), 'participant'),
  'P0001', 'Application already has this role', 'cannot change to the same role'
);
select throws_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.alice_app'), 'judge'),
  'P0001', 'No form exists for this role in this event', 'target role must have a form in the event'
);
select throws_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.bob_app'), 'volunteer'),
  'P0001', 'Withdrawn applications cannot change role', 'withdrawn applications cannot change role'
);
select lives_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.alice_app'), 'volunteer'),
  'organizer changes an application role'
);
reset role;

select is(
  (select count(*) from public.application_archives where application_id = current_setting('test.alice_app')::uuid),
  1::bigint,
  'role change writes one archive row'
);
select is(
  (select row(from_role, to_role, changed_by)::text from public.application_archives where application_id = current_setting('test.alice_app')::uuid),
  row('participant'::public.app_role, 'volunteer'::public.app_role, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)::text,
  'archive records roles and the acting organizer'
);
select is(
  (select answers from public.application_archives where application_id = current_setting('test.alice_app')::uuid),
  '{"q": "participant answer"}'::jsonb,
  'archive keeps the previous answers'
);
select is(
  (select row(role, form_id)::text from public.applications where id = current_setting('test.alice_app')::uuid),
  row('volunteer'::public.app_role, 'f0000000-0000-0000-0000-000000000002'::uuid)::text,
  'application moves to the new role form'
);
select ok(
  (select status = 'draft' and submitted_at is null from public.applications where id = current_setting('test.alice_app')::uuid),
  'application resets to draft'
);
select is(
  (select answers from public.applications where id = current_setting('test.alice_app')::uuid),
  '{}'::jsonb,
  'answers are wiped'
);
select is(
  (select count(*) from public.application_decisions where application_id = current_setting('test.alice_app')::uuid),
  0::bigint,
  'decision is removed'
);

select * from finish();
rollback;
