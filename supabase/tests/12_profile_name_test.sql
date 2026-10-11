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
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test', '{"full_name": "Bob"}');

select plan(5);

select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null,
  'OTP sign-up without metadata has no name'
);

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select lives_ok(
  $$update public.profiles set full_name = 'Alice Applicant' where id = '11111111-1111-1111-1111-111111111111'$$,
  'applicant sets own full name'
);
select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice Applicant',
  'full name is stored'
);
update public.profiles set full_name = 'Mallory' where id = '22222222-2222-2222-2222-222222222222';
select throws_ok(
  $$update public.profiles set id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'applicant can only update the name column'
);
reset role;

select is(
  (select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Bob',
  'applicant cannot rename another profile'
);

select * from finish(true);
rollback;
