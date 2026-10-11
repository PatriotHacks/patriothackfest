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

create function pg_temp.apply(p_id uuid, p_submit boolean)
returns uuid
language plpgsql
as $$
declare
  v_app uuid;
begin
  perform pg_temp.login(p_id, p_id || '@example.test', 'otp');
  v_app := public.start_application('f6000000-0000-0000-0000-000000000001');
  if p_submit then
    perform public.submit_application(v_app);
  end if;
  reset role;
  return v_app;
end;
$$;

create function pg_temp.decide(p_admin uuid, p_email text, p_app text, p_decision text)
returns text
language sql
as $$
  select pg_temp.login(p_admin, p_email);
  select format(
    'insert into public.application_decisions (application_id, decision) values (%L, %L)
     on conflict (application_id) do update set decision = excluded.decision',
    current_setting(p_app), p_decision
  );
$$;

insert into auth.users (id, email) values
  ('d6000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001@example.test'),
  ('d6000000-0000-0000-0000-000000000002', 'd6000000-0000-0000-0000-000000000002@example.test'),
  ('d6000000-0000-0000-0000-000000000003', 'd6000000-0000-0000-0000-000000000003@example.test'),
  ('d6000000-0000-0000-0000-000000000004', 'd6000000-0000-0000-0000-000000000004@example.test'),
  ('d6000000-0000-0000-0000-0000000000a0', 'rules-organizer@example.test'),
  ('d6000000-0000-0000-0000-0000000000b0', 'rules-reviewer@example.test');

insert into public.admin_allowlist (email, level) values
  ('rules-organizer@example.test', 'organizer'),
  ('rules-reviewer@example.test', 'reviewer');

insert into public.events (id, slug, name) values
  ('e6000000-0000-0000-0000-000000000001', 'pgtap-decision-rules', 'pgTAP Decision Rules');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema) values
  ('f6000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}');

select set_config('test.first', pg_temp.apply('d6000000-0000-0000-0000-000000000001', true)::text, true);
select set_config('test.second', pg_temp.apply('d6000000-0000-0000-0000-000000000002', true)::text, true);
select set_config('test.draft', pg_temp.apply('d6000000-0000-0000-0000-000000000003', false)::text, true);
select set_config('test.withdrawn', pg_temp.apply('d6000000-0000-0000-0000-000000000004', true)::text, true);

insert into public.application_decisions (application_id, decision)
values (current_setting('test.withdrawn')::uuid, 'accepted');

select pg_temp.login('d6000000-0000-0000-0000-000000000004', 'd6000000-0000-0000-0000-000000000004@example.test', 'otp');
select public.withdraw_application(current_setting('test.withdrawn')::uuid);
reset role;

select plan(10);

select throws_ok(
  pg_temp.decide('d6000000-0000-0000-0000-0000000000b0', 'rules-reviewer@example.test', 'test.draft', 'accepted'),
  'P0001', 'Decisions can only be set on submitted applications', 'reviewer cannot decide a draft'
);
reset role;

select throws_ok(
  pg_temp.decide('d6000000-0000-0000-0000-0000000000a0', 'rules-organizer@example.test', 'test.draft', 'accepted'),
  'P0001', 'Decisions can only be set on submitted applications', 'organizer cannot decide a draft'
);
select throws_ok(
  pg_temp.decide('d6000000-0000-0000-0000-0000000000a0', 'rules-organizer@example.test', 'test.withdrawn', 'rejected'),
  'P0001', 'Decisions can only be set on submitted applications', 'organizer cannot change a withdrawn application decision'
);
reset role;

select throws_ok(
  format('insert into public.application_decisions (application_id, decision) values (%L, %L)', current_setting('test.draft'), 'accepted'),
  'P0001', 'Decisions can only be set on submitted applications', 'draft decisions are rejected without RLS'
);

select lives_ok(
  pg_temp.decide('d6000000-0000-0000-0000-0000000000b0', 'rules-reviewer@example.test', 'test.first', 'accepted'),
  'reviewer decides a submitted application before release'
);
reset role;

select pg_temp.login('d6000000-0000-0000-0000-0000000000a0', 'rules-organizer@example.test');
select public.admin_release_decisions('f6000000-0000-0000-0000-000000000001');
reset role;

select throws_ok(
  pg_temp.decide('d6000000-0000-0000-0000-0000000000b0', 'rules-reviewer@example.test', 'test.second', 'accepted'),
  '42501', 'Decisions are released; only organizers can change them', 'reviewer cannot decide after release'
);
reset role;

select lives_ok(
  pg_temp.decide('d6000000-0000-0000-0000-0000000000a0', 'rules-organizer@example.test', 'test.second', 'waitlisted'),
  'organizer decides after release'
);
select lives_ok(
  pg_temp.decide('d6000000-0000-0000-0000-0000000000a0', 'rules-organizer@example.test', 'test.first', 'rejected'),
  'organizer changes a decision after release'
);
reset role;

select is(
  (select string_agg(decision::text, ',' order by decision) from public.application_decisions
   where application_id in (current_setting('test.first')::uuid, current_setting('test.second')::uuid)),
  'waitlisted,rejected',
  'organizer decisions are stored'
);
select ok(
  not has_function_privilege('authenticated', 'public.enforce_decision_rules()', 'execute'),
  'authenticated cannot execute the decision rules trigger function'
);

select * from finish(true);
rollback;
