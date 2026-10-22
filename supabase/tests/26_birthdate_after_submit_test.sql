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

insert into auth.users (id, email, raw_user_meta_data) values
  ('b2000000-0000-0000-0000-000000000001', 'dob-erin@example.test', '{"full_name": "Erin"}');

insert into public.events (id, slug, name, starts_at) values
  ('eb200000-0000-0000-0000-000000000001', 'pgtap-dob-event', 'Dob', '2030-06-15 12:00:00-04');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema) values
  ('fb200000-0000-0000-0000-000000000001', 'eb200000-0000-0000-0000-000000000001', 'participant', 'Dob', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Dob", "description": null, "fields": []}');

select plan(8);

select pg_temp.login('b2000000-0000-0000-0000-000000000001', 'dob-erin@example.test');
select set_config('test.app', public.start_application('fb200000-0000-0000-0000-000000000001')::text, true);
select public.update_basic_info('Erin', 'Some School', '+17035551234', '2000-01-01');
select public.submit_application(current_setting('test.app')::uuid);

select lives_ok(
  $$select public.update_basic_info('Erin', 'Some School', '+17035551234', '2012-06-16')$$,
  'date of birth changes after submit before edits lock'
);
select is(
  (select public.under_18(a) from public.applications a where a.id = current_setting('test.app')::uuid),
  true,
  'the under-18 flag follows the new date of birth'
);
select lives_ok(
  $$select public.update_basic_info('Erin', 'Some School', null, '2011-06-16', true)$$,
  'date of birth changes after submit while keeping the phone'
);
select throws_ok(
  $$select public.update_basic_info('Erin', 'Other School', '+17035551234', '2012-06-16')$$,
  '42501', 'Basic information is locked after you submit an application',
  'other basic fields stay locked after submit'
);
select throws_ok(
  $$select public.update_basic_info('Erin', 'Some School', '+17035551234', null)$$,
  '22023', 'Enter your date of birth',
  'date of birth cannot be cleared after submit'
);
select results_eq(
  $$select full_name, school, phone, date_of_birth from public.profiles where id = 'b2000000-0000-0000-0000-000000000001'$$,
  $$values ('Erin', 'Some School', '+17035551234', date '2011-06-16')$$,
  'only the date of birth changed'
);
reset role;

update public.forms
set submissions_close_at = now() - interval '1 hour', edits_lock_at = now() - interval '1 minute'
where id = 'fb200000-0000-0000-0000-000000000001';

select pg_temp.login('b2000000-0000-0000-0000-000000000001', 'dob-erin@example.test');
select throws_ok(
  $$select public.update_basic_info('Erin', 'Some School', '+17035551234', '2012-06-16')$$,
  '42501', 'Basic information is locked after you submit an application',
  'date of birth locks once edits lock'
);
select is(
  (select date_of_birth from public.profiles where id = 'b2000000-0000-0000-0000-000000000001'),
  date '2011-06-16',
  'a locked date of birth is unchanged'
);
reset role;

select * from finish(true);
rollback;
