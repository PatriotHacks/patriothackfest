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

create function pg_temp.failure(p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v_state text;
  v_message text;
  v_detail text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_message = message_text, v_detail = pg_exception_detail;
  return jsonb_build_object('code', v_state, 'message', v_message, 'detail', nullif(v_detail, '')::jsonb);
end;
$$;

create function pg_temp.publish()
returns text
language plpgsql
as $$
begin
  perform pg_temp.login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test');
  begin
    perform public.admin_publish_form('f0000000-0000-0000-0000-000000000001');
    reset role;
    return null;
  exception when others then
    reset role;
    return sqlerrm;
  end;
end;
$$;

create function pg_temp.save(p_answers jsonb)
returns text
language sql
as $$
  select format('select public.save_application_answers(%L, %L)', current_setting('test.app'), p_answers)
$$;

create function pg_temp.answers()
returns jsonb
language sql
as $$
  select answers from public.applications where id = current_setting('test.app')::uuid
$$;

create function pg_temp.file_path(p_field text)
returns text
language sql
as $$
  select format(
    '11111111-1111-1111-1111-111111111111/%s/%s/00000000-0000-4000-8000-000000000001.pdf',
    current_setting('test.app'),
    p_field
  )
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"full_name": "Alice"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test', '{"full_name": "Organizer"}');
update public.profiles set full_name = coalesce(full_name, 'Applicant'), school = 'George Mason University', phone = '+17035551234', date_of_birth = '2000-01-01' where email like '%.test';

insert into public.admin_allowlist (email, level) values ('organizer@example.test', 'organizer');

insert into public.events (id, slug, name) values
  ('e0000000-0000-0000-0000-000000000001', 'pgtap-event', 'pgTAP Event');

insert into public.forms (id, event_id, role, title, submissions_close_at, edits_lock_at) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'participant', 'Participant',
   now() + interval '1 day', now() + interval '2 days');

select plan(32);

select throws_ok(
  $$insert into public.form_fields (form_id, position, type, label, required)
    values ('f0000000-0000-0000-0000-000000000001', 1, 'section', 'S', true)$$,
  '23514', null, 'sections cannot be required'
);
select throws_ok(
  $$insert into public.form_fields (form_id, position, type, label, condition)
    values ('f0000000-0000-0000-0000-000000000001', 1, 'section', 'S',
            '{"field_id": "d0000000-0000-0000-0000-000000000001", "operator": "equals", "value": true}')$$,
  '23514', null, 'sections cannot have conditions'
);
select throws_ok(
  $$insert into public.form_fields (form_id, position, type, label, editable_after_submit)
    values ('f0000000-0000-0000-0000-000000000001', 1, 'short_text', 'Q', true)$$,
  '23514', null, 'only sections can be editable after submission'
);

insert into public.form_fields (id, form_id, position, type, label) values
  ('d0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 2, 'short_text', 'Name');

select is(pg_temp.publish(), 'Start the form with a section', 'publishing requires a leading section');

insert into public.form_fields (id, form_id, position, type, label, help_text) values
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 1, 'section', ' ', 'About you');

select is(pg_temp.publish(), 'Section 1 needs a title', 'sections need a title');

update public.form_fields set label = 'Basics' where id = 'd0000000-0000-0000-0000-000000000001';
update public.form_fields set type = 'section' where id = 'd0000000-0000-0000-0000-000000000002';

select is(pg_temp.publish(), 'Add at least one question', 'a form of only sections cannot be published');

update public.form_fields set type = 'short_text' where id = 'd0000000-0000-0000-0000-000000000002';
insert into public.form_fields (id, form_id, position, type, label, condition) values
  ('d0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 3, 'long_text', 'Why?',
   '{"field_id": "d0000000-0000-0000-0000-000000000001", "operator": "equals", "value": true}');

select is(
  pg_temp.publish(),
  'Question 2 must depend on an earlier choice or checkbox question',
  'conditions cannot reference sections'
);

delete from public.form_fields where id = 'd0000000-0000-0000-0000-000000000003';
insert into public.form_fields (id, form_id, position, type, label, editable_after_submit) values
  ('d0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 4, 'file', 'Portfolio', false),
  ('d0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 5, 'section', 'Extras', true),
  ('d0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000001', 6, 'short_text', 'Bio', false),
  ('d0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 7, 'file', 'Resume', false);

select is(pg_temp.publish(), null, 'a form led by a section publishes');
select is(
  (select published_schema -> 'fields' -> 0 from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  '{"id": "d0000000-0000-0000-0000-000000000001", "type": "section", "label": "Basics", "help_text": "About you",
    "required": false, "options": null, "validation": null, "condition": null, "editable_after_submit": false}'::jsonb,
  'snapshot captures section content'
);
select is(
  (select published_schema #> '{fields,3,editable_after_submit}' from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  'true'::jsonb,
  'snapshot captures editable sections'
);
select ok(
  (select not (published_schema -> 'fields' -> 1 ? 'editable_after_submit') from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  'questions carry no editable flag'
);
select is(
  (select public.form_locked_field_ids(published_schema) from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  '{d0000000-0000-0000-0000-000000000002,d0000000-0000-0000-0000-000000000004}'::text[],
  'questions belong to the nearest preceding section'
);

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select set_config('test.app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true);

select lives_ok(
  pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "Al", "d0000000-0000-0000-0000-000000000001": "x"}'),
  'drafts save answers in any section'
);
select lives_ok(
  pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "Alice", "d0000000-0000-0000-0000-000000000001": "x"}'),
  'drafts change answers in non-editable sections'
);
select lives_ok(format('select public.submit_application(%L)', current_setting('test.app')), 'application submits');
select is(pg_temp.answers(), '{"d0000000-0000-0000-0000-000000000002": "Alice"}'::jsonb, 'section items carry no answers');

select lives_ok(
  pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "Alice", "d0000000-0000-0000-0000-000000000006": "Hi"}'),
  'answers in editable sections change after submit'
);
select is(
  pg_temp.answers(),
  '{"d0000000-0000-0000-0000-000000000002": "Alice", "d0000000-0000-0000-0000-000000000006": "Hi"}'::jsonb,
  'editable answers are stored'
);
select lives_ok(
  pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "Alice", "d0000000-0000-0000-0000-000000000005": "x"}'),
  'answers in editable sections can be cleared after submit'
);
select is(
  pg_temp.failure(pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "Bob"}')),
  '{"code": "PT403", "message": "Some answers can no longer be changed",
    "detail": {"d0000000-0000-0000-0000-000000000002": "This answer can no longer be changed"}}'::jsonb,
  'answers in non-editable sections cannot change after submit'
);
select is(
  pg_temp.failure(pg_temp.save('{}')) -> 'detail',
  '{"d0000000-0000-0000-0000-000000000002": "This answer can no longer be changed"}'::jsonb,
  'answers in non-editable sections cannot be cleared after submit'
);
select is(
  pg_temp.failure(pg_temp.save(jsonb_build_object(
    'd0000000-0000-0000-0000-000000000002', 'Alice',
    'd0000000-0000-0000-0000-000000000004', jsonb_build_object(
      'path', pg_temp.file_path('d0000000-0000-0000-0000-000000000004'),
      'name', 'p.pdf', 'size', 10, 'type', 'application/pdf'
    )
  ))) -> 'detail',
  '{"d0000000-0000-0000-0000-000000000004": "This answer can no longer be changed"}'::jsonb,
  'file answers in non-editable sections cannot change after submit'
);
select is(
  pg_temp.failure(pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "Bob", "d0000000-0000-0000-0000-000000000007": {"bad": true}}')) ->> 'code',
  'PT403',
  'locked changes are rejected before validation'
);
select is(
  pg_temp.answers(),
  '{"d0000000-0000-0000-0000-000000000002": "Alice"}'::jsonb,
  'rejected edits leave answers unchanged'
);
select ok(
  not public.application_file_writable(pg_temp.file_path('d0000000-0000-0000-0000-000000000004')),
  'no uploads to file questions in non-editable sections after submit'
);
select ok(
  public.application_file_writable(pg_temp.file_path('d0000000-0000-0000-0000-000000000007')),
  'uploads to file questions in editable sections after submit'
);
reset role;

select throws_ok(
  $$update public.form_fields set type = 'section' where id = 'd0000000-0000-0000-0000-000000000002'$$,
  'P0001', 'Field type cannot change after applications have answered it',
  'answered questions cannot become sections'
);
select lives_ok(
  $$update public.form_fields set type = 'short_text', editable_after_submit = false
    where id = 'd0000000-0000-0000-0000-000000000005'$$,
  'unanswered sections can become questions'
);

update public.forms
set submissions_close_at = now() - interval '2 minutes', edits_lock_at = now() - interval '1 minute'
where id = 'f0000000-0000-0000-0000-000000000001';

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select throws_ok(
  pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "Alice", "d0000000-0000-0000-0000-000000000006": "Late"}'),
  'P0001', 'Application can no longer be edited',
  'editable sections lock at the edits deadline'
);
select ok(
  not public.application_file_writable(pg_temp.file_path('d0000000-0000-0000-0000-000000000007')),
  'no uploads to editable sections after the edits deadline'
);
reset role;

update public.forms
set submissions_close_at = now() + interval '1 day', edits_lock_at = now() + interval '2 days'
where id = 'f0000000-0000-0000-0000-000000000001';
update public.applications set status = 'draft', submitted_at = null where id = current_setting('test.app')::uuid;

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select lives_ok(
  pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "Changed"}'),
  'drafts are unaffected by section locks'
);
select ok(
  public.application_file_writable(pg_temp.file_path('d0000000-0000-0000-0000-000000000004')),
  'drafts upload to any file question'
);
reset role;

select * from finish(true);
rollback;
