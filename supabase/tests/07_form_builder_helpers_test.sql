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
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test', '{"full_name": "Organizer"}'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test', '{"full_name": "Reviewer"}');

insert into public.admin_allowlist (email, level) values
  ('organizer@example.test', 'organizer'),
  ('reviewer@example.test', 'reviewer');

insert into public.events (id, slug, name) values
  ('e0000000-0000-0000-0000-000000000001', 'pgtap-event', 'pgTAP Event');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published', now() + interval '1 day', now() + interval '2 days');

insert into public.form_fields (id, form_id, position, type, label, archived_at) values
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 1, 'short_text', 'One', null),
  ('d0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 2, 'short_text', 'Two', null),
  ('d0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 3, 'short_text', 'Three', null),
  ('d0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 4, 'short_text', 'Archived', now());

select plan(8);

select pg_temp.login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test');
select lives_ok(
  $$select public.admin_reorder_form_fields('f0000000-0000-0000-0000-000000000001', array[
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002'
  ]::uuid[])$$,
  'organizer reorders questions'
);
select is(
  (select array_agg(label order by position) from public.form_fields where archived_at is null),
  array['Three', 'One', 'Two'],
  'positions follow the given order'
);
select throws_ok(
  $$select public.admin_reorder_form_fields('f0000000-0000-0000-0000-000000000001', array[
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001'
  ]::uuid[])$$,
  'P0001', 'Field order must list every question of the form exactly once',
  'reorder must include every question'
);
select throws_ok(
  $$select public.admin_reorder_form_fields('f0000000-0000-0000-0000-000000000001', array[
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002'
  ]::uuid[])$$,
  'P0001', 'Field order must list every question of the form exactly once',
  'reorder rejects duplicates'
);
reset role;

select pg_temp.login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test');
select throws_ok(
  $$select public.admin_reorder_form_fields('f0000000-0000-0000-0000-000000000001', array[
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000003'
  ]::uuid[])$$,
  '42501', 'Organizer access required', 'reviewer cannot reorder'
);
select is(
  (select count(*) from public.form_answered_field_ids('f0000000-0000-0000-0000-000000000001')),
  0::bigint,
  'no questions are answered yet'
);
reset role;

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select set_config('test.alice_app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true);
select public.save_application_answers(
  current_setting('test.alice_app')::uuid,
  '{"d0000000-0000-0000-0000-000000000002": "answer"}'
);
select is(
  (select count(*) from public.form_answered_field_ids('f0000000-0000-0000-0000-000000000001')),
  0::bigint,
  'applicants do not see answered questions'
);
reset role;

select pg_temp.login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test');
select is(
  array(select public.form_answered_field_ids('f0000000-0000-0000-0000-000000000001')),
  array['d0000000-0000-0000-0000-000000000002'::uuid],
  'reviewer sees answered questions'
);
reset role;

select * from finish(true);
rollback;
