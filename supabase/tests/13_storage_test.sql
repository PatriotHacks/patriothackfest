begin;
create extension if not exists pgtap with schema extensions;

create function pg_temp.login(p_id uuid, p_email text)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated', 'amr', json_build_array(json_build_object('method', 'otp')))::text,
    true
  );
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.path(p_user text, p_app text, p_field text, p_file text default '5f1d0c9e-0b7a-4d5e-9c3b-2a1e8f6d4c21.pdf')
returns text
language sql
as $$
  select format('%s/%s/%s/%s', p_user, p_app, p_field, p_file)
$$;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test');

insert into public.events (id, slug, name) values
  ('e0000000-0000-0000-0000-000000000001', 'pgtap-event', 'pgTAP Event');

insert into public.forms (id, event_id, role, title, status, submissions_close_at, edits_lock_at, published_schema) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'participant', 'Participant', 'published',
   now() + interval '1 day', now() + interval '2 days',
   '{"title": "Participant", "description": null, "fields": [
     {"id": "d0000000-0000-0000-0000-000000000001", "type": "file", "label": "Resume", "help_text": null,
      "required": true, "options": null, "validation": null, "condition": null},
     {"id": "d0000000-0000-0000-0000-000000000002", "type": "short_text", "label": "Name", "help_text": null,
      "required": false, "options": null, "validation": null, "condition": null}
   ]}');

insert into public.applications (id, user_id, event_id, role, form_id) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'e0000000-0000-0000-0000-000000000001', 'participant', 'f0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'e0000000-0000-0000-0000-000000000001', 'participant', 'f0000000-0000-0000-0000-000000000001');

select set_config('test.alice', '11111111-1111-1111-1111-111111111111', true);
select set_config('test.app', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('test.field', 'd0000000-0000-0000-0000-000000000001', true);
select set_config('test.good', pg_temp.path(current_setting('test.alice'), current_setting('test.app'), current_setting('test.field')), true);

select plan(22);

select is(
  (select row(file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'application-files'),
  row(10485760::bigint, '{application/pdf}'::text[])::text,
  'bucket limits uploads to 10 MB PDFs'
);

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select ok(public.application_file_writable(current_setting('test.good')), 'own draft file field path is writable');
select ok(
  not public.application_file_writable(pg_temp.path('22222222-2222-2222-2222-222222222222', current_setting('test.app'), current_setting('test.field'))),
  'path must start with the caller id'
);
select ok(
  not public.application_file_writable(pg_temp.path(current_setting('test.alice'), 'a0000000-0000-0000-0000-000000000002', current_setting('test.field'))),
  'application must belong to the caller'
);
select ok(
  not public.application_file_writable(pg_temp.path(current_setting('test.alice'), current_setting('test.app'), 'd0000000-0000-0000-0000-000000000002')),
  'field must be a file question'
);
select ok(
  not public.application_file_writable(pg_temp.path(current_setting('test.alice'), current_setting('test.app'), 'd0000000-0000-0000-0000-000000000009')),
  'field must exist in the published form'
);
select ok(
  not public.application_file_writable(pg_temp.path(current_setting('test.alice'), current_setting('test.app'), current_setting('test.field'), 'resume.pdf')),
  'file name must be a uuid'
);
select ok(
  not public.application_file_writable(pg_temp.path(current_setting('test.alice'), current_setting('test.app'), current_setting('test.field'), '5f1d0c9e-0b7a-4d5e-9c3b-2a1e8f6d4c21.png')),
  'file must be a pdf'
);
select ok(
  not public.application_file_writable(current_setting('test.good') || '/x.pdf'),
  'no extra path segments'
);

select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('application-files', %L)$$, current_setting('test.good')),
  'applicant uploads to own application'
);
select throws_ok(
  format(
    $$insert into storage.objects (bucket_id, name) values ('application-files', %L)$$,
    pg_temp.path(current_setting('test.alice'), 'a0000000-0000-0000-0000-000000000002', current_setting('test.field'))
  ),
  '42501', null, 'applicant cannot upload to another application'
);
select throws_ok(
  format(
    $$insert into storage.objects (bucket_id, name) values ('application-files', %L)$$,
    current_setting('test.alice') || '/resume.pdf'
  ),
  '42501', null, 'applicant cannot upload outside the application layout'
);
select ok(public.application_file_deletable(current_setting('test.good')), 'draft files are deletable');
reset role;

update public.applications
set status = 'submitted', submitted_at = now(),
    answers = jsonb_build_object(current_setting('test.field'), jsonb_build_object('path', current_setting('test.good')))
where id = current_setting('test.app')::uuid;

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select ok(public.application_file_writable(current_setting('test.good')), 'submitted application accepts uploads before edits lock');
select ok(not public.application_file_deletable(current_setting('test.good')), 'files referenced by a submitted application cannot be deleted');
select ok(
  public.application_file_deletable(pg_temp.path(current_setting('test.alice'), current_setting('test.app'), current_setting('test.field'), '00000000-0000-4000-8000-000000000001.pdf')),
  'unreferenced files of a submitted application can be deleted'
);
reset role;

update public.forms set submissions_close_at = now() - interval '1 hour' where id = 'f0000000-0000-0000-0000-000000000001';

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select ok(public.application_file_writable(current_setting('test.good')), 'submitted application accepts uploads after submissions close');
reset role;

update public.forms set edits_lock_at = now() - interval '1 minute' where id = 'f0000000-0000-0000-0000-000000000001';

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select ok(not public.application_file_writable(current_setting('test.good')), 'no uploads after edits lock');
reset role;

update public.forms set submissions_close_at = now() + interval '1 day', edits_lock_at = now() + interval '2 days'
where id = 'f0000000-0000-0000-0000-000000000001';
update public.applications set status = 'draft', submitted_at = null where id = current_setting('test.app')::uuid;
update public.forms set submissions_close_at = now() - interval '1 hour' where id = 'f0000000-0000-0000-0000-000000000001';

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select ok(not public.application_file_writable(current_setting('test.good')), 'drafts accept no uploads after submissions close');
reset role;

update public.forms set submissions_close_at = now() + interval '1 day' where id = 'f0000000-0000-0000-0000-000000000001';
update public.applications set status = 'withdrawn', withdrawn_at = now() where id = current_setting('test.app')::uuid;

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select ok(not public.application_file_writable(current_setting('test.good')), 'withdrawn applications accept no uploads');
select is(
  (select count(*) from storage.objects where bucket_id = 'application-files' and name = current_setting('test.good')),
  1::bigint,
  'applicant reads own files'
);
reset role;

select pg_temp.login('22222222-2222-2222-2222-222222222222', 'bob@example.test');
select is(
  (select count(*) from storage.objects where bucket_id = 'application-files' and name = current_setting('test.good')),
  0::bigint,
  'applicant cannot read other applicants files'
);
reset role;

select * from finish(true);
rollback;
