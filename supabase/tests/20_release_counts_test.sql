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

create function pg_temp.apply(p_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_app uuid;
begin
  perform pg_temp.login(p_id, p_id || '@example.test', 'otp');
  v_app := public.start_application('fa000000-0000-0000-0000-000000000001');
  perform public.submit_application(v_app);
  reset role;
  return v_app;
end;
$$;

create function pg_temp.decide(p_app text, p_decision public.decision)
returns void
language plpgsql
as $$
begin
  perform pg_temp.login('da000000-0000-0000-0000-0000000000a0', 'counts-organizer@example.test');
  insert into public.application_decisions (application_id, decision)
  values (current_setting(p_app)::uuid, p_decision)
  on conflict (application_id) do update set decision = excluded.decision;
  reset role;
end;
$$;

insert into auth.users (id, email) values
  ('da000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001@example.test'),
  ('da000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000002@example.test'),
  ('da000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000003@example.test'),
  ('da000000-0000-0000-0000-000000000004', 'da000000-0000-0000-0000-000000000004@example.test'),
  ('da000000-0000-0000-0000-000000000005', 'da000000-0000-0000-0000-000000000005@example.test'),
  ('da000000-0000-0000-0000-000000000006', 'da000000-0000-0000-0000-000000000006@example.test'),
  ('da000000-0000-0000-0000-000000000007', 'da000000-0000-0000-0000-000000000007@example.test'),
  ('da000000-0000-0000-0000-0000000000a0', 'counts-organizer@example.test'),
  ('da000000-0000-0000-0000-0000000000b0', 'counts-reviewer@example.test');

insert into public.admin_allowlist (email, level) values
  ('counts-organizer@example.test', 'organizer'),
  ('counts-reviewer@example.test', 'reviewer');

insert into public.events (id, slug, name) values
  ('ea000000-0000-0000-0000-000000000001', 'pgtap-release-counts', 'pgTAP Release Counts');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema) values
  ('fa000000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}');

select set_config('test.acc1', pg_temp.apply('da000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.acc2', pg_temp.apply('da000000-0000-0000-0000-000000000002')::text, true);
select set_config('test.wait', pg_temp.apply('da000000-0000-0000-0000-000000000003')::text, true);
select set_config('test.rej', pg_temp.apply('da000000-0000-0000-0000-000000000004')::text, true);
select set_config('test.pend', pg_temp.apply('da000000-0000-0000-0000-000000000005')::text, true);
select set_config('test.none', pg_temp.apply('da000000-0000-0000-0000-000000000006')::text, true);

select pg_temp.login('da000000-0000-0000-0000-000000000007', 'da000000-0000-0000-0000-000000000007@example.test', 'otp');
select public.start_application('fa000000-0000-0000-0000-000000000001');
reset role;

select pg_temp.decide('test.acc1', 'accepted');
select pg_temp.decide('test.acc2', 'accepted');
select pg_temp.decide('test.wait', 'waitlisted');
select pg_temp.decide('test.rej', 'rejected');
select pg_temp.decide('test.pend', 'pending');

select plan(4);

select pg_temp.login('da000000-0000-0000-0000-0000000000a0', 'counts-organizer@example.test');
select is(
  (select row(c.*)::text from public.admin_release_counts('fa000000-0000-0000-0000-000000000001') c),
  '(6,2,1,1,1,1,0,0,0,0,0,0)',
  'counts submitted applications by decision before release'
);
select public.admin_release_decisions('fa000000-0000-0000-0000-000000000001');
reset role;

select pg_temp.login('da000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000002@example.test', 'otp');
select public.decline_application_offer(current_setting('test.acc2')::uuid);
reset role;
update public.email_log set status = 'sent', claimed_at = now(), sent_at = now()
where application_id = current_setting('test.acc1')::uuid;
update public.email_log set status = 'failed', claimed_at = now()
where application_id = current_setting('test.rej')::uuid;

select pg_temp.login('da000000-0000-0000-0000-0000000000a0', 'counts-organizer@example.test');
select is(
  (select row(c.*)::text from public.admin_release_counts('fa000000-0000-0000-0000-000000000001') c),
  '(6,2,1,1,1,1,1,1,0,1,1,1)',
  'counts declined applications and emails by status'
);
reset role;

select pg_temp.login('da000000-0000-0000-0000-0000000000b0', 'counts-reviewer@example.test');
select throws_ok(
  $$select * from public.admin_release_counts('fa000000-0000-0000-0000-000000000001')$$,
  '42501', 'Organizer access required', 'reviewer cannot read release counts'
);
reset role;

select pg_temp.login('da000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001@example.test', 'otp');
select throws_ok(
  $$select * from public.admin_release_counts('fa000000-0000-0000-0000-000000000001')$$,
  '42501', 'Organizer access required', 'applicant cannot read release counts'
);
reset role;

select * from finish(true);
rollback;
