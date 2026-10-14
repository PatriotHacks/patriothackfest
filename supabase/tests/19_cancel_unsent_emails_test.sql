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
  v_app := public.start_application('f9000000-0000-0000-0000-000000000001');
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
  perform pg_temp.login('d9000000-0000-0000-0000-0000000000a0', 'cancel-organizer@example.test');
  insert into public.application_decisions (application_id, decision)
  values (current_setting(p_app)::uuid, p_decision)
  on conflict (application_id) do update set decision = excluded.decision;
  reset role;
end;
$$;

create function pg_temp.emails(p_app text)
returns text
language sql
as $$
  select string_agg(status || ':' || decision, ',' order by status)
  from public.email_log
  where application_id = current_setting(p_app)::uuid
$$;

insert into auth.users (id, email) values
  ('d9000000-0000-0000-0000-000000000001', 'd9000000-0000-0000-0000-000000000001@example.test'),
  ('d9000000-0000-0000-0000-000000000002', 'd9000000-0000-0000-0000-000000000002@example.test'),
  ('d9000000-0000-0000-0000-000000000003', 'd9000000-0000-0000-0000-000000000003@example.test'),
  ('d9000000-0000-0000-0000-000000000004', 'd9000000-0000-0000-0000-000000000004@example.test'),
  ('d9000000-0000-0000-0000-0000000000a0', 'cancel-organizer@example.test');
update public.profiles set full_name = coalesce(full_name, 'Applicant'), school = 'George Mason University', phone = '+17035551234', date_of_birth = '2000-01-01' where email like '%.test';

insert into public.admin_allowlist (email, level) values ('cancel-organizer@example.test', 'organizer');

insert into public.events (id, slug, name) values
  ('e9000000-0000-0000-0000-000000000001', 'pgtap-cancel-emails', 'pgTAP Cancel Emails');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema, decisions_released_at) values
  ('f9000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}', now()),
  ('f9000000-0000-0000-0000-000000000002', 'e9000000-0000-0000-0000-000000000001', 'volunteer', 'Volunteer', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Volunteer", "description": null, "fields": []}', null);

select set_config('test.declined', pg_temp.apply('d9000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.withdrawn', pg_temp.apply('d9000000-0000-0000-0000-000000000002')::text, true);
select set_config('test.moved', pg_temp.apply('d9000000-0000-0000-0000-000000000003')::text, true);
select set_config('test.kept', pg_temp.apply('d9000000-0000-0000-0000-000000000004')::text, true);

select pg_temp.decide('test.declined', 'accepted');
select pg_temp.decide('test.withdrawn', 'waitlisted');
select pg_temp.decide('test.moved', 'accepted');
select pg_temp.decide('test.kept', 'accepted');

update public.email_log set status = 'failed', claimed_at = now()
where application_id = current_setting('test.declined')::uuid;
update public.email_log set status = 'sent', claimed_at = now(), sent_at = now()
where application_id = current_setting('test.moved')::uuid;
select pg_temp.decide('test.moved', 'waitlisted');

select plan(6);

select pg_temp.login('d9000000-0000-0000-0000-000000000001', 'd9000000-0000-0000-0000-000000000001@example.test', 'otp');
select public.decline_application_offer(current_setting('test.declined')::uuid);
reset role;
select is(pg_temp.emails('test.declined'), 'cancelled:accepted', 'declining cancels a failed email');
select is(
  (select error from public.email_log where application_id = current_setting('test.declined')::uuid),
  'Applicant declined the offer',
  'cancellation records the reason'
);

update public.applications set status = 'withdrawn', withdrawn_at = now()
where id = current_setting('test.withdrawn')::uuid;
select is(pg_temp.emails('test.withdrawn'), 'cancelled:waitlisted', 'withdrawing cancels a pending email');

select pg_temp.login('d9000000-0000-0000-0000-0000000000a0', 'cancel-organizer@example.test');
select public.admin_change_application_role(current_setting('test.moved')::uuid, 'volunteer');
reset role;
select is(pg_temp.emails('test.moved'), 'cancelled:waitlisted,sent:accepted', 'moving cancels unsent emails and keeps sent ones');

update public.applications set answers = '{}' where id = current_setting('test.kept')::uuid;
select is(pg_temp.emails('test.kept'), 'pending:accepted', 'other updates leave emails pending');

select pg_temp.login('d9000000-0000-0000-0000-0000000000a0', 'cancel-organizer@example.test');
select is(
  (select count(*) from public.admin_claim_emails('f9000000-0000-0000-0000-000000000001', 10)),
  1::bigint,
  'only the untouched application is claimed'
);
reset role;

select * from finish(true);
rollback;
