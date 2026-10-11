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

update public.forms
set published_schema = '{"title": "Participant", "description": null, "fields": [
  {"id": "d0000000-0000-0000-0000-000000000001", "type": "short_text", "label": "Name", "help_text": null,
   "required": true, "options": null, "validation": null, "condition": null}
]}'
where id = 'f0000000-0000-0000-0000-000000000001';

select plan(25);

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');

select throws_ok(
  $$select public.start_application('f0000000-0000-0000-0000-000000000003')$$,
  'P0001', 'Form is not open for applications', 'cannot start an application on a draft form'
);
select throws_ok(
  $$select public.start_application('f0000000-0000-0000-0000-0000000000ff')$$,
  'P0001', 'Form is not open for applications', 'cannot start an application on a missing form'
);
select lives_ok(
  $$select set_config('test.alice_app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true)$$,
  'applicant starts an application on a published, open form'
);
select is(
  (select row(status, role, form_id)::text from public.applications where id = current_setting('test.alice_app')::uuid),
  row('draft'::public.application_status, 'participant'::public.app_role, 'f0000000-0000-0000-0000-000000000001'::uuid)::text,
  'new application is a participant draft'
);
select throws_ok(
  $$select public.start_application('f0000000-0000-0000-0000-000000000002')$$,
  '23505', null, 'applicant cannot start a second role in the same event'
);
select throws_ok(
  $$select public.start_application('f0000000-0000-0000-0000-000000000001')$$,
  '23505', null, 'applicant cannot start a second application for the same form'
);

select lives_ok(
  format('select public.save_application_answers(%L, %L)', current_setting('test.alice_app'), '{"d0000000-0000-0000-0000-000000000001": "draft"}'),
  'draft answers save before submissions close'
);
select is(
  (select answers from public.applications where id = current_setting('test.alice_app')::uuid),
  '{"d0000000-0000-0000-0000-000000000001": "draft"}'::jsonb,
  'answers are stored'
);
select set_config(
  'test.saved_at',
  public.save_application_answers(current_setting('test.alice_app')::uuid, '{"d0000000-0000-0000-0000-000000000001": "draft"}')::text,
  true
);
select is(
  (select updated_at from public.applications where id = current_setting('test.alice_app')::uuid),
  current_setting('test.saved_at')::timestamptz,
  'save returns the stored updated_at'
);
select throws_ok(
  format('select public.save_application_answers(%L, %L)', current_setting('test.alice_app'), '[]'),
  '23514', null, 'answers must be a json object'
);
select lives_ok(
  format('select public.submit_application(%L)', current_setting('test.alice_app')),
  'draft submits before submissions close'
);
select ok(
  (select status = 'submitted' and submitted_at is not null from public.applications where id = current_setting('test.alice_app')::uuid),
  'submitted application has status and timestamp'
);
select throws_ok(
  format('select public.submit_application(%L)', current_setting('test.alice_app')),
  'P0001', 'Only draft applications can be submitted', 'cannot submit twice'
);
reset role;

select pg_temp.login('22222222-2222-2222-2222-222222222222', 'bob@example.test');
select set_config('test.bob_app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true);
reset role;

update public.forms
set submissions_close_at = now() - interval '1 hour', edits_lock_at = now() + interval '1 hour'
where id = 'f0000000-0000-0000-0000-000000000001';

select pg_temp.login('33333333-3333-3333-3333-333333333333', 'carol@example.test');
select throws_ok(
  $$select public.start_application('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Submissions are closed', 'cannot start an application after submissions close'
);
reset role;

select pg_temp.login('22222222-2222-2222-2222-222222222222', 'bob@example.test');
select throws_ok(
  format('select public.save_application_answers(%L, %L)', current_setting('test.bob_app'), '{"d0000000-0000-0000-0000-000000000001": "late"}'),
  'P0001', 'Application can no longer be edited', 'draft cannot be saved after submissions close'
);
select throws_ok(
  format('select public.submit_application(%L)', current_setting('test.bob_app')),
  'P0001', 'Submissions are closed', 'draft cannot be submitted after submissions close'
);
reset role;

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select lives_ok(
  format('select public.save_application_answers(%L, %L)', current_setting('test.alice_app'), '{"d0000000-0000-0000-0000-000000000001": "edited"}'),
  'submitted application can be edited after submissions close and before edits lock'
);
reset role;

update public.forms
set edits_lock_at = now() - interval '1 minute'
where id = 'f0000000-0000-0000-0000-000000000001';

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select throws_ok(
  format('select public.save_application_answers(%L, %L)', current_setting('test.alice_app'), '{"d0000000-0000-0000-0000-000000000001": "too late"}'),
  'P0001', 'Application can no longer be edited', 'submitted application cannot be edited after edits lock'
);
select is(
  (select answers from public.applications where id = current_setting('test.alice_app')::uuid),
  '{"d0000000-0000-0000-0000-000000000001": "edited"}'::jsonb,
  'answers are unchanged after a rejected edit'
);
reset role;

update public.forms
set submissions_close_at = now() + interval '1 day', edits_lock_at = now() + interval '2 days'
where id = 'f0000000-0000-0000-0000-000000000001';

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select lives_ok(
  format('select public.withdraw_application(%L)', current_setting('test.alice_app')),
  'applicant withdraws'
);
select ok(
  (select status = 'withdrawn' and withdrawn_at is not null from public.applications where id = current_setting('test.alice_app')::uuid),
  'withdrawn application has status and timestamp'
);
select throws_ok(
  format('select public.withdraw_application(%L)', current_setting('test.alice_app')),
  'P0001', 'Application is already withdrawn', 'cannot withdraw twice'
);
select throws_ok(
  format('select public.save_application_answers(%L, %L)', current_setting('test.alice_app'), '{"d0000000-0000-0000-0000-000000000001": "again"}'),
  'P0001', 'Application can no longer be edited', 'withdrawn application cannot be edited'
);
select throws_ok(
  format('select public.submit_application(%L)', current_setting('test.alice_app')),
  'P0001', 'Only draft applications can be submitted', 'withdrawn application cannot be resubmitted'
);
select throws_ok(
  $$select public.start_application('f0000000-0000-0000-0000-000000000001')$$,
  '23505', null, 'withdrawn applicant cannot start a new application for the event'
);
reset role;

select * from finish(true);
rollback;
