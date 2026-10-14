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

insert into public.admin_allowlist (email, level) values ('organizer@example.test', 'organizer');

insert into public.events (id, slug, name) values
  ('e0000000-0000-0000-0000-000000000001', 'pgtap-event', 'pgTAP Event');

insert into public.forms (id, event_id, role, title, submissions_close_at, edits_lock_at) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'participant', 'Participant',
   now() + interval '1 day', now() + interval '2 days');

select plan(10);

insert into public.form_fields (id, form_id, position, type, label, editable_after_submit, required, options) values
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 10, 'section', 'Basics', false, false, null),
  ('d0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 20, 'single_choice', 'Size', false, true, '["S", "XL"]'),
  ('d0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 30, 'section', 'Extras', true, false, null),
  ('d0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 40, 'checkbox', 'Team?', false, false, null),
  ('d0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 50, 'short_text', 'Team name', false, true, null);

update public.form_fields
set condition = '{"field_id": "d0000000-0000-0000-0000-000000000004", "operator": "equals", "value": true}'
where id = 'd0000000-0000-0000-0000-000000000005';

select is(pg_temp.publish(), null, 'form publishes');

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select set_config('test.app', public.start_application('f0000000-0000-0000-0000-000000000001')::text, true);
select lives_ok(pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "XL"}'), 'draft saves');
select lives_ok(format('select public.submit_application(%L)', current_setting('test.app')), 'application submits');
reset role;

insert into public.form_fields (id, form_id, position, type, label, required) values
  ('d0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000001', 25, 'short_text', 'Phone', true);
update public.form_fields set options = '["S", "M"]' where id = 'd0000000-0000-0000-0000-000000000002';
select is(pg_temp.publish(), null, 'republish adds a required question and removes an option in a locked section');

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select lives_ok(
  pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "XL", "d0000000-0000-0000-0000-000000000004": true, "d0000000-0000-0000-0000-000000000005": "Owls"}'),
  'editable sections save despite new requirements and removed options in locked sections'
);
select is(
  pg_temp.answers(),
  '{"d0000000-0000-0000-0000-000000000002": "XL", "d0000000-0000-0000-0000-000000000004": true, "d0000000-0000-0000-0000-000000000005": "Owls"}'::jsonb,
  'editable answers are stored next to unchanged locked answers'
);
select is(
  pg_temp.failure(pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "XL", "d0000000-0000-0000-0000-000000000004": true}')),
  '{"code": "PT422", "message": "Invalid answers", "detail": {"d0000000-0000-0000-0000-000000000005": "Required"}}'::jsonb,
  'questions in editable sections are still fully validated'
);
select is(
  pg_temp.failure(pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "M"}')) -> 'detail',
  '{"d0000000-0000-0000-0000-000000000002": "This answer can no longer be changed"}'::jsonb,
  'locked answers still cannot change'
);
select is(
  pg_temp.failure(pg_temp.save('{"d0000000-0000-0000-0000-000000000002": "XL", "d0000000-0000-0000-0000-000000000006": "555"}')) -> 'detail',
  '{"d0000000-0000-0000-0000-000000000006": "This answer can no longer be changed"}'::jsonb,
  'new locked questions cannot be answered after submit'
);
reset role;

update public.applications set status = 'draft', submitted_at = null where id = current_setting('test.app')::uuid;

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select is(
  pg_temp.failure(format('select public.submit_application(%L)', current_setting('test.app'))) -> 'detail',
  '{"d0000000-0000-0000-0000-000000000002": "Choose one of the options", "d0000000-0000-0000-0000-000000000006": "Required"}'::jsonb,
  'submitting still validates every question'
);
reset role;

select * from finish(true);
rollback;
