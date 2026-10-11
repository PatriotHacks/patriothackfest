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
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner@example.test', '{"full_name": "Owner"}'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'owner2@example.test', '{"full_name": "Owner Two"}');

insert into public.admin_allowlist (email, level) values
  ('owner@example.test', 'owner'),
  ('reviewer@example.test', 'reviewer');

delete from public.admin_allowlist where email not like '%@example.test';

select plan(7);

select pg_temp.login('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner@example.test');
select throws_ok(
  $$delete from public.admin_allowlist where email = 'owner@example.test'$$,
  'P0001', 'At least one owner is required', 'last owner cannot remove themselves'
);
select throws_ok(
  $$update public.admin_allowlist set level = 'organizer' where email = 'owner@example.test'$$,
  'P0001', 'At least one owner is required', 'last owner cannot demote themselves'
);
select throws_ok(
  $$delete from public.admin_allowlist$$,
  'P0001', 'At least one owner is required', 'allowlist cannot be emptied'
);
select lives_ok(
  $$delete from public.admin_allowlist where email = 'reviewer@example.test'$$,
  'non-owner entries can be removed'
);
select lives_ok(
  $$insert into public.admin_allowlist (email, level) values ('owner2@example.test', 'owner')$$,
  'owner adds a second owner'
);
select lives_ok(
  $$update public.admin_allowlist set level = 'organizer' where email = 'owner@example.test'$$,
  'owner demotes themselves when another owner exists'
);
reset role;

select is(
  (select array_agg(email::text order by email) from public.admin_allowlist where level = 'owner'),
  array['owner2@example.test'],
  'one owner remains'
);

select * from finish(true);
rollback;
