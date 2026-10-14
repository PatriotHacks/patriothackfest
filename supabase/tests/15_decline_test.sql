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

create function pg_temp.apply(p_id uuid, p_form_id uuid, p_submit boolean)
returns uuid
language plpgsql
as $$
declare
  v_app uuid;
begin
  perform pg_temp.login(p_id, p_id || '@example.test');
  v_app := public.start_application(p_form_id);
  if p_submit then
    perform public.submit_application(v_app);
  end if;
  reset role;
  return v_app;
end;
$$;

insert into auth.users (id, email) values
  ('d1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001@example.test'),
  ('d1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002@example.test'),
  ('d1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003@example.test'),
  ('d1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004@example.test'),
  ('d1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000005@example.test'),
  ('d1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000006@example.test'),
  ('d1000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000007@example.test'),
  ('d1000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000008@example.test'),
  ('d1000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000009@example.test'),
  ('d1000000-0000-0000-0000-0000000000a0', 'decline-organizer@example.test');
update public.profiles set full_name = coalesce(full_name, 'Applicant'), school = 'George Mason University', phone = '+17035551234', date_of_birth = '2000-01-01' where email like '%.test';

insert into public.admin_allowlist (email, level) values ('decline-organizer@example.test', 'organizer');

insert into public.events (id, slug, name, starts_at) values
  ('e1000000-0000-0000-0000-000000000001', 'pgtap-decline', 'pgTAP Decline', now() + interval '30 days'),
  ('e1000000-0000-0000-0000-000000000002', 'pgtap-decline-unreleased', 'pgTAP Decline Unreleased', now() + interval '30 days');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema) values
  ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}'),
  ('f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'volunteer', 'Volunteer', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Volunteer", "description": null, "fields": []}'),
  ('f1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}');

select set_config('test.accepted', pg_temp.apply('d1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', true)::text, true);
select set_config('test.waitlisted', pg_temp.apply('d1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', true)::text, true);
select set_config('test.rejected', pg_temp.apply('d1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001', true)::text, true);
select set_config('test.pending', pg_temp.apply('d1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000001', true)::text, true);
select set_config('test.undecided', pg_temp.apply('d1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000001', true)::text, true);
select set_config('test.draft', pg_temp.apply('d1000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000001', false)::text, true);
select set_config('test.withdrawn', pg_temp.apply('d1000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000001', true)::text, true);
select set_config('test.unreleased', pg_temp.apply('d1000000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000003', true)::text, true);
select set_config('test.early_withdraw', pg_temp.apply('d1000000-0000-0000-0000-000000000009', 'f1000000-0000-0000-0000-000000000003', true)::text, true);

insert into public.application_decisions (application_id, decision) values
  (current_setting('test.accepted')::uuid, 'accepted'),
  (current_setting('test.waitlisted')::uuid, 'waitlisted'),
  (current_setting('test.rejected')::uuid, 'rejected'),
  (current_setting('test.pending')::uuid, 'pending'),
  (current_setting('test.withdrawn')::uuid, 'accepted'),
  (current_setting('test.unreleased')::uuid, 'accepted');

select plan(25);

select pg_temp.login('d1000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000007@example.test');
select public.withdraw_application(current_setting('test.withdrawn')::uuid);
reset role;

select pg_temp.login('d1000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000009@example.test');
select lives_ok(
  format('select public.withdraw_application(%L)', current_setting('test.early_withdraw')),
  'withdraw still works before decisions are released'
);
reset role;

select pg_temp.login('d1000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000008@example.test');
select throws_ok(
  format('select public.decline_application_offer(%L)', current_setting('test.unreleased')),
  'P0001', 'Decisions have not been released yet', 'cannot decline before decisions are released'
);
reset role;

select pg_temp.login('d1000000-0000-0000-0000-0000000000a0', 'decline-organizer@example.test');
select public.admin_release_decisions('f1000000-0000-0000-0000-000000000001');
reset role;

select pg_temp.login('d1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002@example.test');
select throws_ok(
  format('select public.decline_application_offer(%L)', current_setting('test.accepted')),
  'P0001', 'Application not found', 'cannot decline another applicant''s application'
);
select throws_ok(
  format('update public.applications set declined_at = now() where id = %L', current_setting('test.waitlisted')),
  '42501', null, 'applicant cannot set declined_at directly'
);
select lives_ok(
  format('select public.decline_application_offer(%L)', current_setting('test.waitlisted')),
  'applicant declines a waitlisted spot'
);
reset role;

select pg_temp.login('d1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001@example.test');
select throws_ok(
  format('select public.withdraw_application(%L)', current_setting('test.accepted')),
  'P0001', 'Applications cannot be withdrawn after the decision is released', 'cannot withdraw after an acceptance is released'
);
select lives_ok(
  format('select public.decline_application_offer(%L)', current_setting('test.accepted')),
  'applicant declines an accepted spot'
);
select ok(
  (select declined_at is not null from public.applications where id = current_setting('test.accepted')::uuid),
  'applicant reads own declined_at'
);
select throws_ok(
  format('select public.decline_application_offer(%L)', current_setting('test.accepted')),
  'P0001', 'Application is already declined', 'cannot decline twice'
);
reset role;

select pg_temp.login('d1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003@example.test');
select throws_ok(
  format('select public.decline_application_offer(%L)', current_setting('test.rejected')),
  'P0001', 'Only accepted or waitlisted applications can be declined', 'cannot decline a rejection'
);
select throws_ok(
  format('select public.withdraw_application(%L)', current_setting('test.rejected')),
  'P0001', 'Applications cannot be withdrawn after the decision is released', 'rejected applicant cannot withdraw after release'
);
reset role;

select pg_temp.login('d1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004@example.test');
select throws_ok(
  format('select public.decline_application_offer(%L)', current_setting('test.pending')),
  'P0001', 'Only accepted or waitlisted applications can be declined', 'cannot decline a pending decision'
);
select lives_ok(
  format('select public.withdraw_application(%L)', current_setting('test.pending')),
  'withdraw works after release while the decision is pending'
);
reset role;

select pg_temp.login('d1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000005@example.test');
select throws_ok(
  format('select public.decline_application_offer(%L)', current_setting('test.undecided')),
  'P0001', 'Only accepted or waitlisted applications can be declined', 'cannot decline without a decision'
);
select lives_ok(
  format('select public.withdraw_application(%L)', current_setting('test.undecided')),
  'withdraw works after release without a decision'
);
reset role;

select pg_temp.login('d1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000006@example.test');
select throws_ok(
  format('select public.decline_application_offer(%L)', current_setting('test.draft')),
  'P0001', 'Only submitted applications can be declined', 'cannot decline a draft'
);
reset role;

select pg_temp.login('d1000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000007@example.test');
select throws_ok(
  format('select public.decline_application_offer(%L)', current_setting('test.withdrawn')),
  'P0001', 'Only submitted applications can be declined', 'cannot decline a withdrawn application'
);
reset role;

select pg_temp.login('d1000000-0000-0000-0000-0000000000a0', 'decline-organizer@example.test');
select is(
  (select count(*) from public.applications where id in (current_setting('test.accepted')::uuid, current_setting('test.waitlisted')::uuid) and declined_at is not null),
  2::bigint,
  'organizer reads declined_at'
);
select throws_ok(
  format('update public.application_decisions set decision = %L where application_id = %L', 'rejected', current_setting('test.accepted')),
  'P0001', 'The applicant declined; this decision is final', 'organizer cannot change a declined decision'
);
select throws_ok(
  format('update public.application_decisions set decision = %L where application_id = %L', 'accepted', current_setting('test.waitlisted')),
  'P0001', 'The applicant declined; this decision is final', 'organizer cannot accept a declined waitlist spot'
);
select throws_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.accepted'), 'volunteer'),
  'P0001', 'Declined applications cannot change role', 'organizer cannot change role after decline'
);
select lives_ok(
  format('update public.application_decisions set decision = %L where application_id = %L', 'waitlisted', current_setting('test.rejected')),
  'organizer still changes undeclined decisions'
);
reset role;

select is(
  (select decision from public.application_decisions where application_id = current_setting('test.accepted')::uuid),
  'accepted'::public.decision,
  'declined decision is unchanged'
);
select is(
  (select role from public.applications where id = current_setting('test.accepted')::uuid),
  'participant'::public.app_role,
  'declined role is unchanged'
);
select throws_ok(
  format('update public.applications set status = %L, declined_at = now() where id = %L', 'draft', current_setting('test.rejected')),
  '23514', null, 'declined_at requires a submitted application'
);

select * from finish(true);
rollback;
