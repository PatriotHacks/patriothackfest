begin;
create extension if not exists pgtap with schema extensions;

create function pg_temp.login(p_id uuid, p_email text)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_id,
      'email', p_email,
      'role', 'authenticated',
      'app_metadata', json_build_object('provider', 'email'),
      'amr', json_build_array(json_build_object('method', 'otp'))
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

create function pg_temp.flag(p_application_id uuid)
returns boolean
language sql
as $$
  select public.under_18(a) from public.applications a where a.id = p_application_id
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('b1000000-0000-0000-0000-000000000001', 'basic-alice@example.test', '{"full_name": "Alice"}'),
  ('b1000000-0000-0000-0000-000000000002', 'basic-bob@example.test', '{"full_name": "Bob"}'),
  ('b1000000-0000-0000-0000-000000000003', 'basic-carol@example.test', '{"full_name": "Carol"}'),
  ('b1000000-0000-0000-0000-000000000004', 'basic-dave@example.test', '{"full_name": "Dave"}');

insert into public.events (id, slug, name, starts_at) values
  ('eb000000-0000-0000-0000-000000000001', 'pgtap-basic-dated', 'Dated', '2030-06-15 23:30:00-04'),
  ('eb000000-0000-0000-0000-000000000002', 'pgtap-basic-undated', 'Undated', null);

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema) values
  ('fb000000-0000-0000-0000-000000000001', 'eb000000-0000-0000-0000-000000000001', 'participant', 'Dated', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Dated", "description": null, "fields": []}'),
  ('fb000000-0000-0000-0000-000000000002', 'eb000000-0000-0000-0000-000000000002', 'participant', 'Undated', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Undated", "description": null, "fields": []}');

select plan(32);

select pg_temp.login('b1000000-0000-0000-0000-000000000001', 'basic-alice@example.test');
select throws_ok(
  $$select public.update_basic_info('Alice', 'School', '+17035551234', '2000-01-01')$$,
  '42501', 'Basic information can only be changed while you have a draft application',
  'basic info needs a draft application'
);

select set_config('test.app1', public.start_application('fb000000-0000-0000-0000-000000000001')::text, true);

select throws_ok(
  $$update public.profiles set school = 'School' where id = 'b1000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'applicants cannot write school directly'
);
update public.profiles set full_name = 'Renamed' where id = 'b1000000-0000-0000-0000-000000000001';
select is(
  (select full_name from public.profiles where id = 'b1000000-0000-0000-0000-000000000001'),
  'Alice',
  'a set name cannot be changed directly'
);

select is(
  pg_temp.failure(format('select public.submit_application(%L)', current_setting('test.app1'))),
  '{"code": "PT422", "message": "Basic information is incomplete", "detail": {"school": "Required", "phone": "Required", "date_of_birth": "Required"}}'::jsonb,
  'submit requires basic information'
);

select throws_ok(
  $$select public.update_basic_info('  ', 'School', null, null)$$,
  '22023', 'Enter your name', 'blank names are rejected'
);
select throws_ok(
  $$select public.update_basic_info('Alice', 'School', null, current_date + 1)$$,
  '22023', 'Enter a date of birth in the past', 'future birth dates are rejected'
);
select throws_ok(
  $$select public.update_basic_info('Alice', 'School', null, '1899-12-31')$$,
  '23514', null, 'birth dates before 1900 are rejected'
);
select throws_ok(
  $$select public.update_basic_info('Alice', 'School', '7035551234', null)$$,
  '23514', null, 'phones must be E.164'
);
select lives_ok(
  $$select public.update_basic_info('  Alice A  ', ' Some School ', null, null)$$,
  'partial basic info saves while drafting'
);
select lives_ok(
  $$select public.update_basic_info('Alice A', 'Some School', '+17035551234', '2012-06-16')$$,
  'complete basic info saves'
);
select results_eq(
  $$select full_name, school, phone, date_of_birth from public.profiles where id = 'b1000000-0000-0000-0000-000000000001'$$,
  $$values ('Alice A', 'Some School', '+17035551234', date '2012-06-16')$$,
  'basic info is stored trimmed'
);

select lives_ok(
  $$select public.update_basic_info('Alice A', 'Other School', null, '2012-06-16', true)$$,
  'basic info saves while keeping the phone'
);
select results_eq(
  $$select school, phone from public.profiles where id = 'b1000000-0000-0000-0000-000000000001'$$,
  $$values ('Other School', '+17035551234')$$,
  'keeping the phone leaves it unchanged while other fields save'
);
select lives_ok(
  $$select public.update_basic_info('Alice A', 'Some School', null, '2012-06-16')$$,
  'basic info saves with a cleared phone'
);
select is(
  (select phone from public.profiles where id = 'b1000000-0000-0000-0000-000000000001'),
  null,
  'a null phone without keep clears it'
);
select public.update_basic_info('Alice A', 'Some School', '+17035551234', '2012-06-16');

select lives_ok(
  format('select public.submit_application(%L)', current_setting('test.app1')),
  'under-18 applicants can submit'
);

select set_config('test.app2', public.start_application('fb000000-0000-0000-0000-000000000002')::text, true);
select throws_ok(
  $$select public.update_basic_info('Alice B', 'Some School', '+17035551234', '2012-06-16')$$,
  '42501', 'Basic information is locked after you submit an application',
  'basic info locks after submitting for an upcoming event'
);
reset role;

select pg_temp.login('b1000000-0000-0000-0000-000000000002', 'basic-bob@example.test');
select set_config('test.app3', public.start_application('fb000000-0000-0000-0000-000000000001')::text, true);
reset role;
select pg_temp.login('b1000000-0000-0000-0000-000000000003', 'basic-carol@example.test');
select set_config('test.app4', public.start_application('fb000000-0000-0000-0000-000000000001')::text, true);
reset role;
select pg_temp.login('b1000000-0000-0000-0000-000000000004', 'basic-dave@example.test');
select set_config('test.app5', public.start_application('fb000000-0000-0000-0000-000000000002')::text, true);
reset role;

update public.profiles set school = 'George Mason University', date_of_birth = '2012-06-16'
where id = 'b1000000-0000-0000-0000-000000000002';
update public.profiles set school = 'Some School', date_of_birth = '2012-06-15'
where id = 'b1000000-0000-0000-0000-000000000003';
update public.profiles set school = 'Some School', date_of_birth = current_date - interval '17 years'
where id = 'b1000000-0000-0000-0000-000000000004';

select is(pg_temp.flag(current_setting('test.app1')::uuid), true, '17 on the event date outside GMU is flagged');
select is(pg_temp.flag(current_setting('test.app3')::uuid), false, '17 on the event date at GMU is not flagged');
select is(pg_temp.flag(current_setting('test.app4')::uuid), false, 'turning 18 on the event date is not flagged');
select is(pg_temp.flag(current_setting('test.app5')::uuid), true, 'undated events measure age today');

update public.profiles set school = 'Some School', date_of_birth = null
where id = 'b1000000-0000-0000-0000-000000000004';
select is(pg_temp.flag(current_setting('test.app5')::uuid), null, 'missing birth dates are unknown');
select is(
  (select count(*) from public.applications a where a.id = current_setting('test.app5')::uuid and public.under_18(a) = false),
  0::bigint,
  'unknown ages are excluded from the not-under-18 filter'
);

update public.profiles set school = 'George Mason University', date_of_birth = null
where id = 'b1000000-0000-0000-0000-000000000002';
select is(pg_temp.flag(current_setting('test.app3')::uuid), false, 'GMU applicants without a birth date are not flagged');

update public.profiles set school = '  george MASON university ', date_of_birth = '2012-06-16'
where id = 'b1000000-0000-0000-0000-000000000002';
select is(pg_temp.flag(current_setting('test.app3')::uuid), false, 'the GMU match ignores case and surrounding whitespace');

update public.profiles set school = 'George Mason', date_of_birth = '2012-06-16'
where id = 'b1000000-0000-0000-0000-000000000002';
select is(pg_temp.flag(current_setting('test.app3')::uuid), true, 'only the exact GMU name exempts');

select pg_temp.login('b1000000-0000-0000-0000-000000000004', 'basic-dave@example.test');
select is(
  (select count(public.under_18(a) is null) from public.applications a),
  1::bigint,
  'applicants only see their own applications'
);
reset role;

update public.events set starts_at = now() - interval '3 days', ends_at = now() - interval '2 days'
where id = 'eb000000-0000-0000-0000-000000000001';
select pg_temp.login('b1000000-0000-0000-0000-000000000001', 'basic-alice@example.test');
select lives_ok(
  $$select public.update_basic_info('Alice B', 'Some School', '+17035551234', '2012-06-16')$$,
  'basic info unlocks once the submitted event is over'
);
reset role;

update public.events set starts_at = now(), ends_at = null
where id = 'eb000000-0000-0000-0000-000000000001';
select pg_temp.login('b1000000-0000-0000-0000-000000000001', 'basic-alice@example.test');
select throws_ok(
  $$select public.update_basic_info('Alice C', 'Some School', '+17035551234', '2012-06-16')$$,
  '42501', 'Basic information is locked after you submit an application',
  'basic info stays locked through the last event day'
);
reset role;

update public.profiles set school = 'Some School', date_of_birth = '2008-02-29'
where id = 'b1000000-0000-0000-0000-000000000004';
update public.events set starts_at = '2026-02-28 12:00:00-05'
where id = 'eb000000-0000-0000-0000-000000000002';
select is(pg_temp.flag(current_setting('test.app5')::uuid), true, 'Feb 29 birthdays are under 18 on Feb 28 of a non-leap 18th year');
update public.events set starts_at = '2026-03-01 12:00:00-05'
where id = 'eb000000-0000-0000-0000-000000000002';
select is(pg_temp.flag(current_setting('test.app5')::uuid), false, 'Feb 29 birthdays turn 18 on Mar 1 of a non-leap year');

update public.profiles set date_of_birth = '2008-03-01'
where id = 'b1000000-0000-0000-0000-000000000004';
select is(pg_temp.flag(current_setting('test.app5')::uuid), false, 'Mar 1 birthdays turn 18 on Mar 1');

select * from finish(true);
rollback;
