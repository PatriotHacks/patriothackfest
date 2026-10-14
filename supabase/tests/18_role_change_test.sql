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

create function pg_temp.apply(p_id uuid, p_form_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_app uuid;
begin
  perform pg_temp.login(p_id, p_id || '@example.test', 'otp');
  v_app := public.start_application(p_form_id);
  perform public.save_application_answers(v_app, '{"d8000000-0000-0000-0000-000000000001": "old answer"}');
  perform public.submit_application(v_app);
  reset role;
  return v_app;
end;
$$;

insert into auth.users (id, email) values
  ('d8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001@example.test'),
  ('d8000000-0000-0000-0000-000000000002', 'd8000000-0000-0000-0000-000000000002@example.test'),
  ('d8000000-0000-0000-0000-000000000003', 'd8000000-0000-0000-0000-000000000003@example.test'),
  ('d8000000-0000-0000-0000-000000000004', 'd8000000-0000-0000-0000-000000000004@example.test'),
  ('d8000000-0000-0000-0000-0000000000a0', 'roles-organizer@example.test');
update public.profiles set full_name = coalesce(full_name, 'Applicant'), school = 'George Mason University', phone = '+17035551234', date_of_birth = '2000-01-01' where email like '%.test';

insert into public.admin_allowlist (email, level) values ('roles-organizer@example.test', 'organizer');

insert into public.events (id, slug, name) values
  ('e8000000-0000-0000-0000-000000000001', 'pgtap-roles-open', 'pgTAP Roles Open'),
  ('e8000000-0000-0000-0000-000000000002', 'pgtap-roles-released', 'pgTAP Roles Released');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema) values
  ('f8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days',
   '{"title": "Participant", "description": null, "fields": [{"id": "d8000000-0000-0000-0000-000000000001", "type": "short_text", "label": "Q", "help_text": null, "required": false, "options": null, "validation": null, "condition": null}]}'),
  ('f8000000-0000-0000-0000-000000000002', 'e8000000-0000-0000-0000-000000000001', 'volunteer', 'Volunteer', 'published',
   now() - interval '2 days', now() - interval '1 day', '{"title": "Volunteer", "description": null, "fields": []}'),
  ('f8000000-0000-0000-0000-000000000003', 'e8000000-0000-0000-0000-000000000001', 'judge', 'Judge', 'draft', null, null, null),
  ('f8000000-0000-0000-0000-000000000004', 'e8000000-0000-0000-0000-000000000002', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days',
   '{"title": "Participant", "description": null, "fields": [{"id": "d8000000-0000-0000-0000-000000000001", "type": "short_text", "label": "Q", "help_text": null, "required": false, "options": null, "validation": null, "condition": null}]}'),
  ('f8000000-0000-0000-0000-000000000005', 'e8000000-0000-0000-0000-000000000002', 'volunteer', 'Volunteer', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Volunteer", "description": null, "fields": []}'),
  ('f8000000-0000-0000-0000-000000000006', 'e8000000-0000-0000-0000-000000000002', 'judge', 'Judge', 'published',
   now() + interval '1 day', now() + interval '2 days', null);

select set_config('test.open', pg_temp.apply('d8000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-000000000001')::text, true);
select set_config('test.undecided', pg_temp.apply('d8000000-0000-0000-0000-000000000002', 'f8000000-0000-0000-0000-000000000004')::text, true);
select set_config('test.accepted', pg_temp.apply('d8000000-0000-0000-0000-000000000003', 'f8000000-0000-0000-0000-000000000004')::text, true);
select set_config('test.emailed', pg_temp.apply('d8000000-0000-0000-0000-000000000004', 'f8000000-0000-0000-0000-000000000004')::text, true);

select pg_temp.login('d8000000-0000-0000-0000-0000000000a0', 'roles-organizer@example.test');
insert into public.application_decisions (application_id, decision) values (current_setting('test.accepted')::uuid, 'accepted');
select public.admin_release_decisions('f8000000-0000-0000-0000-000000000004');
insert into public.application_decisions (application_id, decision) values (current_setting('test.emailed')::uuid, 'accepted');
reset role;

update public.email_log set status = 'sent', claimed_at = now(), sent_at = now()
where application_id = current_setting('test.emailed')::uuid;

update public.forms set decisions_released_at = now() where id = 'f8000000-0000-0000-0000-000000000005';

select plan(17);

select pg_temp.login('d8000000-0000-0000-0000-0000000000a0', 'roles-organizer@example.test');
select throws_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.open'), 'judge'),
  'P0001', 'The form for this role is not published', 'target form must be published'
);
select throws_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.open'), 'volunteer'),
  'P0001', 'The form for this role is closed', 'target form must still accept submissions'
);
select throws_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.undecided'), 'judge'),
  'P0001', 'The form for this role is not published', 'target form must have a published schema'
);
select lives_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.undecided'), 'volunteer'),
  'organizer moves an application onto a released, open form'
);
reset role;

select is(
  (select row(from_role, to_role, from_form_id, schema -> 'fields' -> 0 ->> 'label', answers)::text
   from public.application_archives where application_id = current_setting('test.undecided')::uuid),
  row('participant'::public.app_role, 'volunteer'::public.app_role, 'f8000000-0000-0000-0000-000000000004'::uuid, 'Q',
      '{"d8000000-0000-0000-0000-000000000001": "old answer"}'::jsonb)::text,
  'archive stores the source form and its published schema'
);
select is(
  (select row(form_id, status)::text from public.applications where id = current_setting('test.undecided')::uuid),
  row('f8000000-0000-0000-0000-000000000005'::uuid, 'draft'::public.application_status)::text,
  'application lands as a draft on the target form'
);
select is(
  (select count(*) from public.email_log where application_id = current_setting('test.undecided')::uuid),
  0::bigint,
  'role change queues no email'
);

select pg_temp.login('d8000000-0000-0000-0000-0000000000a0', 'roles-organizer@example.test');
select lives_ok(
  format('select public.admin_change_application_role(%L, %L)', current_setting('test.accepted'), 'volunteer'),
  'organizer moves an accepted application with a queued email'
);
select is(
  (select count(*) from public.admin_claim_emails('f8000000-0000-0000-0000-000000000004', 10)),
  0::bigint,
  'queued email for a moved application is not claimed'
);
reset role;

select is(
  (select status from public.email_log where application_id = current_setting('test.accepted')::uuid),
  'cancelled',
  'queued email for a moved application is cancelled'
);

select pg_temp.login('d8000000-0000-0000-0000-000000000002', 'd8000000-0000-0000-0000-000000000002@example.test', 'otp');
select lives_ok(
  format('select public.submit_application(%L)', current_setting('test.undecided')),
  'moved applicant submits on the released form'
);
reset role;

select pg_temp.login('d8000000-0000-0000-0000-0000000000a0', 'roles-organizer@example.test');
insert into public.application_decisions (application_id, decision) values (current_setting('test.undecided')::uuid, 'accepted');
reset role;

select is(
  (select string_agg(status || ':' || decision, ',') from public.email_log where application_id = current_setting('test.undecided')::uuid),
  'pending:accepted',
  'organizer decision on the released form queues an email'
);

select pg_temp.login('d8000000-0000-0000-0000-000000000002', 'd8000000-0000-0000-0000-000000000002@example.test', 'otp');
select throws_ok(
  format('select public.withdraw_application(%L)', current_setting('test.undecided')),
  'P0001', 'Applications cannot be withdrawn after the decision is released', 'moved applicant cannot withdraw once decided'
);
reset role;

select pg_temp.login('d8000000-0000-0000-0000-0000000000a0', 'roles-organizer@example.test');
select public.admin_change_application_role(current_setting('test.emailed')::uuid, 'volunteer');
reset role;
select pg_temp.login('d8000000-0000-0000-0000-000000000004', 'd8000000-0000-0000-0000-000000000004@example.test', 'otp');
select public.submit_application(current_setting('test.emailed')::uuid);
reset role;
select pg_temp.login('d8000000-0000-0000-0000-0000000000a0', 'roles-organizer@example.test');
insert into public.application_decisions (application_id, decision) values (current_setting('test.emailed')::uuid, 'accepted');
reset role;

select is(
  (select string_agg(status || ':' || decision || ':' || coalesce(previous_decision::text, '-'), ',')
   from public.email_log
   where application_id = current_setting('test.emailed')::uuid and form_id = 'f8000000-0000-0000-0000-000000000005'),
  'pending:accepted:-',
  'an email sent for the previous form does not suppress the new form''s email'
);

select pg_temp.login('d8000000-0000-0000-0000-0000000000a0', 'roles-organizer@example.test');
select lives_ok(
  $$delete from public.forms where id = 'f8000000-0000-0000-0000-000000000004'$$,
  'organizer deletes a form referenced only by archives'
);
reset role;

select is(
  (select count(*) from public.forms where id = 'f8000000-0000-0000-0000-000000000004'),
  0::bigint,
  'the form is gone'
);
select is(
  (select string_agg(coalesce(from_form_id::text, '-') || ':' || (schema ->> 'title'), ',')
   from public.application_archives where application_id = current_setting('test.undecided')::uuid),
  '-:Participant',
  'archive keeps its schema snapshot after the source form is deleted'
);

select * from finish(true);
rollback;
