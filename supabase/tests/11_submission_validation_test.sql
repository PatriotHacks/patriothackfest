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

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"full_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test', '{"full_name": "Bob"}');

insert into public.events (id, slug, name) values
  ('e0000000-0000-0000-0000-000000000001', 'pgtap-event', 'pgTAP Event');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days',
   '{"title": "Participant", "description": null, "fields": [
     {"id": "d0000000-0000-0000-0000-000000000001", "type": "single_choice", "label": "Size", "help_text": null,
      "required": true, "options": ["S", "XL"], "validation": null, "condition": null},
     {"id": "d0000000-0000-0000-0000-000000000002", "type": "long_text", "label": "Why XL?", "help_text": null,
      "required": true, "options": null, "validation": null,
      "condition": {"field_id": "d0000000-0000-0000-0000-000000000001", "operator": "equals", "value": "XL"}},
     {"id": "d0000000-0000-0000-0000-000000000003", "type": "file", "label": "Resume", "help_text": null,
      "required": false, "options": null, "validation": null, "condition": null}
   ]}'),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'volunteer', 'Volunteer', 'published',
   now() + interval '1 day', now() + interval '2 days', null);

select plan(19);

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select set_config('test.app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true);

select lives_ok(pg_temp.save('{"d0000000-0000-0000-0000-000000000001": "nope", "junk": 1}'), 'drafts save without validation');
select is(pg_temp.answers(), '{"d0000000-0000-0000-0000-000000000001": "nope", "junk": 1}'::jsonb, 'draft answers are stored as sent');
select throws_ok(
  format('select public.submit_application(%L)', current_setting('test.app')),
  'PT422', 'Invalid answers', 'submit rejects invalid answers'
);
select is(
  pg_temp.failure(format('select public.submit_application(%L)', current_setting('test.app'))) -> 'detail',
  '{"d0000000-0000-0000-0000-000000000001": "Choose one of the options"}'::jsonb,
  'submit error detail maps field ids to messages'
);
select is((select status from public.applications where id = current_setting('test.app')::uuid), 'draft'::public.application_status, 'rejected submit stays a draft');

select public.save_application_answers(current_setting('test.app')::uuid, '{"d0000000-0000-0000-0000-000000000001": "XL"}');
select is(
  pg_temp.failure(format('select public.submit_application(%L)', current_setting('test.app'))),
  '{"code": "PT422", "message": "Invalid answers", "detail": {"d0000000-0000-0000-0000-000000000002": "Required"}}'::jsonb,
  'submit requires visible conditional fields'
);

select public.save_application_answers(
  current_setting('test.app')::uuid,
  '{"d0000000-0000-0000-0000-000000000001": "S", "d0000000-0000-0000-0000-000000000002": "hidden", "junk": 1}'
);
select lives_ok(format('select public.submit_application(%L)', current_setting('test.app')), 'valid answers submit');
select is(pg_temp.answers(), '{"d0000000-0000-0000-0000-000000000001": "S"}'::jsonb, 'submit prunes hidden and unknown answers');

select is(
  pg_temp.failure(pg_temp.save('{"d0000000-0000-0000-0000-000000000001": "M"}')),
  '{"code": "PT422", "message": "Invalid answers", "detail": {"d0000000-0000-0000-0000-000000000001": "Choose one of the options"}}'::jsonb,
  'edits after submit are validated'
);
select is(
  pg_temp.failure(pg_temp.save('{"d0000000-0000-0000-0000-000000000001": "XL"}')) -> 'detail',
  '{"d0000000-0000-0000-0000-000000000002": "Required"}'::jsonb,
  'edits after submit enforce required fields'
);
select is(
  pg_temp.failure(pg_temp.save('{}')) -> 'detail',
  '{"d0000000-0000-0000-0000-000000000001": "Required"}'::jsonb,
  'edits after submit cannot clear required answers'
);
select is(pg_temp.answers(), '{"d0000000-0000-0000-0000-000000000001": "S"}'::jsonb, 'rejected edits leave answers unchanged');
select is(
  pg_temp.failure(pg_temp.save(
    '{"d0000000-0000-0000-0000-000000000001": "S", "d0000000-0000-0000-0000-000000000003": {"path": "11111111-1111-1111-1111-111111111111/x.pdf", "name": "x.pdf", "size": 10, "type": "application/pdf"}}'
  )) -> 'detail',
  '{"d0000000-0000-0000-0000-000000000003": "Upload the file again"}'::jsonb,
  'edits after submit must reference uploaded files'
);
select lives_ok(
  pg_temp.save('{"d0000000-0000-0000-0000-000000000001": "XL", "d0000000-0000-0000-0000-000000000002": "Tall", "junk": true}'),
  'valid edits after submit save'
);
select is(
  pg_temp.answers(),
  '{"d0000000-0000-0000-0000-000000000001": "XL", "d0000000-0000-0000-0000-000000000002": "Tall"}'::jsonb,
  'edits after submit are pruned'
);
select throws_ok(
  pg_temp.save(jsonb_build_object('d0000000-0000-0000-0000-000000000002', repeat('a', 262144))),
  'PT413', 'Answers are too large', 'answers are capped at 256 kB'
);
reset role;

select pg_temp.login('22222222-2222-2222-2222-222222222222', 'bob@example.test');
select set_config('test.app', public.start_application('f0000000-0000-0000-0000-000000000002')::text, true);
select lives_ok(pg_temp.save('{"anything": 1}'), 'drafts on a form without a published schema save');
select throws_ok(
  pg_temp.save(jsonb_build_object('x', repeat('a', 262144))),
  'PT413', 'Answers are too large', 'draft answers are capped too'
);
select throws_ok(
  format('select public.submit_application(%L)', current_setting('test.app')),
  'P0001', 'Form is not open for applications', 'submit rejects forms without a published schema'
);
reset role;

select * from finish(true);
rollback;
