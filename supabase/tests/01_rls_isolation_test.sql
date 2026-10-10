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

select plan(17);

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select public.start_application('f0000000-0000-0000-0000-000000000001');
reset role;
select pg_temp.login('22222222-2222-2222-2222-222222222222', 'bob@example.test');
select public.start_application('f0000000-0000-0000-0000-000000000001');
reset role;

select set_config(
  'test.bob_application_id',
  (select id::text from public.applications where user_id = '22222222-2222-2222-2222-222222222222'),
  true
);

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');

select is((select count(*) from public.applications), 1::bigint, 'applicant sees only own application');
select is(
  (select user_id from public.applications),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the visible application belongs to the applicant'
);
select is((select count(*) from public.profiles), 1::bigint, 'applicant sees only own profile');
select is(
  (select count(*) from public.forms where id = 'f0000000-0000-0000-0000-000000000003'),
  0::bigint,
  'applicant cannot see draft forms'
);
select is((select count(*) from public.admin_allowlist), 0::bigint, 'applicant cannot read the allowlist');
select is((select count(*) from public.application_archives), 0::bigint, 'applicant cannot read archives');
select is((select count(*) from public.email_log), 0::bigint, 'applicant cannot read the email log');

select throws_ok(
  $$update public.applications set status = 'submitted'$$,
  '42501', null, 'applicant cannot update applications directly'
);
select throws_ok(
  $$update public.applications set role = 'judge', form_id = 'f0000000-0000-0000-0000-000000000003'$$,
  '42501', null, 'applicant cannot change role directly'
);
select throws_ok(
  $$insert into public.applications (user_id, event_id, role, form_id)
    values ('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001', 'volunteer', 'f0000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'applicant cannot insert applications directly'
);
select throws_ok(
  $$delete from public.applications$$,
  '42501', null, 'applicant cannot delete applications'
);
select throws_ok(
  $$update public.profiles set email = 'mallory@example.test'$$,
  '42501', null, 'applicant cannot change profile email'
);
select throws_ok(
  format('select public.save_application_answers(%L, %L)', current_setting('test.bob_application_id'), '{}'),
  'P0001', 'Application not found', 'applicant cannot save answers to another application'
);
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok(
  $$select * from public.applications$$,
  '42501', null, 'anonymous users cannot read applications'
);
reset role;

select pg_temp.login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test');
select is((select count(*) from public.applications), 2::bigint, 'reviewer sees all applications');
reset role;

select lives_ok(
  $$insert into public.events (slug, name) values ('pgtap-undated', 'Undated')$$,
  'events can be created without dates'
);
select throws_ok(
  $$insert into public.events (slug, name, ends_at) values ('pgtap-end-only', 'End only', now())$$,
  '23514',
  null,
  'ends_at requires starts_at'
);

select * from finish(true);
rollback;
