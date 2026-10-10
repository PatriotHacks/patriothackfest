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

select plan(12);

select pg_temp.login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test');
select lives_ok(
  $$insert into public.form_fields (id, form_id, position, type, label, required) values
    ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 1, 'short_text', 'Name', true),
    ('d0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 2, 'single_choice', 'Shirt size', false)$$,
  'organizer creates fields'
);
select lives_ok(
  $$insert into public.form_fields (form_id, position, type, label, condition) values
    ('f0000000-0000-0000-0000-000000000001', 3, 'long_text', 'Why XL?',
     '{"field_id": "d0000000-0000-0000-0000-000000000002", "operator": "equals", "value": "XL"}')$$,
  'organizer creates a conditional field'
);
select throws_ok(
  $$insert into public.form_fields (form_id, position, type, label, condition) values
    ('f0000000-0000-0000-0000-000000000001', 4, 'long_text', 'Bad', '{"field_id": "d0000000-0000-0000-0000-000000000002", "operator": "gt", "value": 1}')$$,
  '23514', null, 'conditions only allow equals and includes'
);
reset role;

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select is(
  (select count(*) from public.form_fields where form_id = 'f0000000-0000-0000-0000-000000000001'),
  3::bigint,
  'applicant reads fields of a published form'
);
select throws_ok(
  $$insert into public.form_fields (form_id, position, type, label) values ('f0000000-0000-0000-0000-000000000001', 5, 'email', 'Email')$$,
  '42501', null, 'applicant cannot create fields'
);
select set_config('test.alice_app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true);
select public.save_application_answers(
  current_setting('test.alice_app')::uuid,
  '{"d0000000-0000-0000-0000-000000000001": "Alice"}'
);
reset role;

select pg_temp.login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test');
select throws_ok(
  $$update public.form_fields set type = 'long_text' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'P0001', 'Field type cannot change after applications have answered it', 'answered field type cannot change'
);
select lives_ok(
  $$update public.form_fields set type = 'multiple_choice' where id = 'd0000000-0000-0000-0000-000000000002'$$,
  'unanswered field type can change'
);
select lives_ok(
  $$update public.form_fields set label = 'Full name' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'answered field label can change'
);
select throws_ok(
  $$update public.form_fields set form_id = 'f0000000-0000-0000-0000-000000000002' where id = 'd0000000-0000-0000-0000-000000000002'$$,
  'P0001', 'Fields cannot be moved between forms', 'fields cannot move between forms'
);
select lives_ok(
  $$update public.form_fields set archived_at = now() where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'organizer archives a field'
);
reset role;

select is(
  (select answers -> 'd0000000-0000-0000-0000-000000000001' from public.applications where id = current_setting('test.alice_app')::uuid),
  '"Alice"'::jsonb,
  'archiving a field keeps its answers'
);

select pg_temp.login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test');
update public.form_fields set label = 'Reviewer edit' where id = 'd0000000-0000-0000-0000-000000000002';
reset role;

select is(
  (select label from public.form_fields where id = 'd0000000-0000-0000-0000-000000000002'),
  'Shirt size',
  'reviewer cannot edit fields'
);

select * from finish();
rollback;
