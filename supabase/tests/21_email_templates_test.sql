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

create function pg_temp.update_subject(p_id uuid, p_email text, p_method text, p_subject text)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  perform pg_temp.login(p_id, p_email, p_method);
  update public.email_templates set subject = p_subject where key = 'accepted';
  get diagnostics v_count = row_count;
  reset role;
  return v_count;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('d2100000-0000-0000-0000-000000000001', 'applicant@templates.test', '{"full_name": "Grace"}'),
  ('d2100000-0000-0000-0000-0000000000a0', 'templates-owner@example.test', '{}'),
  ('d2100000-0000-0000-0000-0000000000b0', 'templates-organizer@example.test', '{}'),
  ('d2100000-0000-0000-0000-0000000000c0', 'templates-reviewer@example.test', '{}');

insert into public.admin_allowlist (email, level) values
  ('templates-owner@example.test', 'owner'),
  ('templates-organizer@example.test', 'organizer'),
  ('templates-reviewer@example.test', 'reviewer');

insert into public.events (id, slug, name, starts_at, ends_at) values
  ('e2100000-0000-0000-0000-000000000001', 'pgtap-templates', 'pgTAP Templates', '2026-11-14T05:00:00Z', '2026-11-16T04:59:59Z');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema) values
  ('f2100000-0000-0000-0000-000000000001', 'e2100000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days', '{"title": "Participant", "description": null, "fields": []}');

select plan(22);

select set_eq(
  $$select key from public.email_templates$$,
  array[
    'accepted', 'accepted_from_waitlisted', 'accepted_from_rejected',
    'waitlisted', 'waitlisted_from_accepted', 'waitlisted_from_rejected',
    'rejected', 'rejected_from_accepted', 'rejected_from_waitlisted'
  ],
  'every decision template variant is seeded'
);

select pg_temp.login('d2100000-0000-0000-0000-000000000001', 'applicant@templates.test', 'otp');
select is((select count(*) from public.email_templates), 0::bigint, 'applicants cannot read templates');
reset role;
select is(
  pg_temp.update_subject('d2100000-0000-0000-0000-000000000001', 'applicant@templates.test', 'otp', 'Hijacked'),
  0, 'applicants cannot update templates'
);

select pg_temp.login('d2100000-0000-0000-0000-0000000000c0', 'templates-reviewer@example.test');
select is((select count(*) from public.email_templates), 0::bigint, 'reviewers cannot read templates');
reset role;
select is(
  pg_temp.update_subject('d2100000-0000-0000-0000-0000000000c0', 'templates-reviewer@example.test', 'oauth', 'Hijacked'),
  0, 'reviewers cannot update templates'
);

select pg_temp.login('d2100000-0000-0000-0000-0000000000a0', 'templates-owner@example.test');
select is((select count(*) from public.email_templates), 9::bigint, 'owners read templates');
reset role;
select is(
  pg_temp.update_subject('d2100000-0000-0000-0000-0000000000a0', 'templates-owner@example.test', 'oauth', 'Owner subject'),
  1, 'owners update templates'
);

select pg_temp.login('d2100000-0000-0000-0000-0000000000b0', 'templates-organizer@example.test');
select is((select count(*) from public.email_templates), 9::bigint, 'organizers read templates');
reset role;
select is(
  pg_temp.update_subject('d2100000-0000-0000-0000-0000000000b0', 'templates-organizer@example.test', 'oauth', 'Welcome to {{event_name}}'),
  1, 'organizers update templates'
);
select is(
  (select subject || '|' || updated_by::text || '|' || (updated_at = now())::text from public.email_templates where key = 'accepted'),
  'Welcome to {{event_name}}|d2100000-0000-0000-0000-0000000000b0|true',
  'updates stamp the editor and time'
);

select pg_temp.login('d2100000-0000-0000-0000-0000000000b0', 'templates-organizer@example.test');
select throws_ok(
  $$update public.email_templates set subject = E' \t ' where key = 'accepted'$$,
  '23514', null, 'subject cannot be blank'
);
select throws_ok(
  $$update public.email_templates set subject = repeat('a', 201) where key = 'accepted'$$,
  '23514', null, 'subject is capped at 200 characters'
);
select throws_ok(
  $$update public.email_templates set subject = E'Line one\nBcc: x@example.test' where key = 'accepted'$$,
  '23514', null, 'subject must be a single line'
);
select throws_ok(
  $$update public.email_templates set body = E' \n ' where key = 'accepted'$$,
  '23514', null, 'body cannot be blank'
);
select throws_ok(
  $$update public.email_templates set body = repeat('a', 10001) where key = 'accepted'$$,
  '23514', null, 'body is capped at 10000 characters'
);
select lives_ok(
  $$update public.email_templates set body = repeat('a', 10000) where key = 'accepted'$$,
  'body of exactly 10000 characters is allowed'
);
select throws_ok(
  $$update public.email_templates set key = 'other' where key = 'accepted'$$,
  '42501', null, 'template keys cannot be changed'
);
select throws_ok(
  $$update public.email_templates set updated_by = null where key = 'accepted'$$,
  '42501', null, 'updated_by cannot be set directly'
);
select throws_ok(
  $$insert into public.email_templates (key, subject, body) values ('accepted', 'x', 'y')$$,
  '42501', null, 'templates cannot be inserted'
);
select throws_ok(
  $$delete from public.email_templates where key = 'accepted'$$,
  '42501', null, 'templates cannot be deleted'
);
reset role;

select pg_temp.login('d2100000-0000-0000-0000-000000000001', 'applicant@templates.test', 'otp');
select set_config('test.app', public.start_application('f2100000-0000-0000-0000-000000000001')::text, true);
select public.submit_application(current_setting('test.app')::uuid);
reset role;

select pg_temp.login('d2100000-0000-0000-0000-0000000000b0', 'templates-organizer@example.test');
insert into public.application_decisions (application_id, decision)
values (current_setting('test.app')::uuid, 'accepted');
select public.admin_release_decisions('f2100000-0000-0000-0000-000000000001');
select is(
  (select concat_ws('|', email, full_name, event_name, event_starts_at, event_ends_at, role, decision)
   from public.admin_claim_emails('f2100000-0000-0000-0000-000000000001', 10)),
  concat_ws('|', 'applicant@templates.test', 'Grace', 'pgTAP Templates',
    '2026-11-14T05:00:00Z'::timestamptz, '2026-11-16T04:59:59Z'::timestamptz, 'participant', 'accepted'),
  'claim returns event dates'
);
reset role;

select pg_temp.login('d2100000-0000-0000-0000-0000000000c0', 'templates-reviewer@example.test');
select throws_ok(
  $$select * from public.admin_claim_emails('f2100000-0000-0000-0000-000000000001', 10)$$,
  '42501', 'Organizer access required', 'reviewers still cannot claim emails'
);
reset role;

select * from finish(true);
rollback;
