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

create function pg_temp.has_unpublished_changes(p_form_id uuid)
returns boolean
language sql
as $$
  select content_updated_at > published_at from public.forms where id = p_form_id
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"full_name": "Alice"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test', '{"full_name": "Organizer"}'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test', '{"full_name": "Reviewer"}');

insert into public.admin_allowlist (email, level) values
  ('organizer@example.test', 'organizer'),
  ('reviewer@example.test', 'reviewer');

insert into public.events (id, slug, name) values
  ('e0000000-0000-0000-0000-000000000001', 'pgtap-event', 'pgTAP Event');

insert into public.forms (id, event_id, role, title) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'participant', 'Participant'),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'volunteer', 'Volunteer');

select plan(31);

select pg_temp.login('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test');

select throws_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', E'Set both deadlines before publishing\nAdd at least one question',
  'publishing requires deadlines and at least one question'
);
select lives_ok(
  $$update public.forms
    set submissions_close_at = now() + interval '1 day', edits_lock_at = now() + interval '2 days'
    where id = 'f0000000-0000-0000-0000-000000000001'$$,
  'organizer sets deadlines'
);
select throws_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Add at least one question',
  'empty form cannot be published'
);

insert into public.form_fields (id, form_id, position, type, label, options, archived_at) values
  ('d0000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-000000000001', -1, 'section', 'About you', null, null),
  ('d0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001', 0, 'short_text', 'Archived', null, now()),
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 1, 'single_choice', 'Shirt size', '[]', null);

select throws_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Question 1 needs at least one option',
  'choice questions need options'
);

update public.form_fields set options = '["S", "S"]' where id = 'd0000000-0000-0000-0000-000000000001';
select throws_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Question 1 has blank or duplicate options',
  'choice options must be unique'
);

update public.form_fields set options = '["S", " "]' where id = 'd0000000-0000-0000-0000-000000000001';
select throws_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Question 1 has blank or duplicate options',
  'choice options must not be blank'
);

update public.form_fields set options = '["S", "XL"]' where id = 'd0000000-0000-0000-0000-000000000001';
insert into public.form_fields (id, form_id, position, type, label, condition) values
  ('d0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 2, 'long_text', 'Why?',
   '{"field_id": "d0000000-0000-0000-0000-000000000003", "operator": "equals", "value": true}'),
  ('d0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 3, 'checkbox', 'Agree', null);

select throws_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Question 2 must depend on an earlier choice or checkbox question',
  'conditions must reference an earlier question'
);

update public.form_fields
set condition = '{"field_id": "d0000000-0000-0000-0000-000000000000", "operator": "equals", "value": "x"}'
where id = 'd0000000-0000-0000-0000-000000000002';
select throws_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Question 2 must depend on an earlier choice or checkbox question',
  'conditions cannot reference archived questions'
);

update public.form_fields
set condition = '{"field_id": "d0000000-0000-0000-0000-000000000001", "operator": "equals", "value": "M"}'
where id = 'd0000000-0000-0000-0000-000000000002';
select throws_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Question 2 has an invalid condition',
  'condition values must be options of the source question'
);

update public.form_fields
set condition = '{"field_id": "d0000000-0000-0000-0000-000000000001", "operator": "includes", "value": "XL"}'
where id = 'd0000000-0000-0000-0000-000000000002';
select throws_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Question 2 has an invalid condition',
  'single choice conditions use equals'
);

update public.form_fields
set condition = '{"field_id": "d0000000-0000-0000-0000-000000000001", "operator": "equals", "value": "XL"}'
where id = 'd0000000-0000-0000-0000-000000000002';
select lives_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  'valid form publishes'
);

select ok(
  (select status = 'published' and published_at is not null from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  'publishing sets status and published_at'
);
select is(
  (select jsonb_path_query_array(published_schema, '$.fields[*].id') from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  '["d0000000-0000-0000-0000-00000000000a", "d0000000-0000-0000-0000-000000000001", "d0000000-0000-0000-0000-000000000002", "d0000000-0000-0000-0000-000000000003"]'::jsonb,
  'snapshot lists non-archived questions in position order'
);
select is(
  (select published_schema -> 'fields' -> 2 from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  jsonb_build_object(
    'id', 'd0000000-0000-0000-0000-000000000002',
    'type', 'long_text',
    'label', 'Why?',
    'help_text', null,
    'required', false,
    'options', null,
    'validation', null,
    'condition', '{"field_id": "d0000000-0000-0000-0000-000000000001", "operator": "equals", "value": "XL"}'::jsonb
  ),
  'snapshot captures question content'
);
select is(
  (select published_schema -> 'title' from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  '"Participant"'::jsonb,
  'snapshot captures the form title'
);
select ok(not pg_temp.has_unpublished_changes('f0000000-0000-0000-0000-000000000001'), 'no unpublished changes after publishing');

update public.form_fields set label = 'T-shirt size' where id = 'd0000000-0000-0000-0000-000000000001';
select ok(pg_temp.has_unpublished_changes('f0000000-0000-0000-0000-000000000001'), 'editing a question marks unpublished changes');
select is(
  (select published_schema #>> '{fields,1,label}' from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  'Shirt size',
  'working copy edits do not change the published snapshot'
);

select public.admin_publish_form('f0000000-0000-0000-0000-000000000001');
select ok(not pg_temp.has_unpublished_changes('f0000000-0000-0000-0000-000000000001'), 'republishing clears unpublished changes');

update public.forms set submissions_close_at = now() + interval '3 days', edits_lock_at = now() + interval '4 days'
where id = 'f0000000-0000-0000-0000-000000000001';
select ok(not pg_temp.has_unpublished_changes('f0000000-0000-0000-0000-000000000001'), 'deadline changes apply without publishing');

update public.forms set description = 'Apply now' where id = 'f0000000-0000-0000-0000-000000000001';
select ok(pg_temp.has_unpublished_changes('f0000000-0000-0000-0000-000000000001'), 'editing the description marks unpublished changes');

select public.admin_publish_form('f0000000-0000-0000-0000-000000000001');
delete from public.form_fields where id = 'd0000000-0000-0000-0000-000000000000';
select ok(pg_temp.has_unpublished_changes('f0000000-0000-0000-0000-000000000001'), 'deleting a question marks unpublished changes');

select throws_ok(
  $$update public.forms set status = 'published' where id = 'f0000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'organizer cannot publish by updating status directly'
);
select throws_ok(
  $$update public.forms set published_schema = '{}' where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'organizer cannot write the snapshot directly'
);
reset role;

select pg_temp.login('cccccccc-cccc-cccc-cccc-cccccccccccc', 'reviewer@example.test');
select throws_ok(
  $$select public.admin_publish_form('f0000000-0000-0000-0000-000000000001')$$,
  '42501', 'Organizer access required', 'reviewer cannot publish'
);
select is(
  (select count(*) from public.form_fields where form_id = 'f0000000-0000-0000-0000-000000000001'),
  4::bigint,
  'reviewer reads the working copy'
);
select throws_ok(
  $$insert into public.form_fields (form_id, position, type, label) values ('f0000000-0000-0000-0000-000000000001', 9, 'email', 'Email')$$,
  '42501', null, 'reviewer cannot add questions'
);
update public.form_fields set label = 'Reviewer edit' where id = 'd0000000-0000-0000-0000-000000000003';
update public.forms set submissions_close_at = now() + interval '9 days' where id = 'f0000000-0000-0000-0000-000000000001';
reset role;

select ok(
  (select label = 'Agree' from public.form_fields where id = 'd0000000-0000-0000-0000-000000000003')
  and (select submissions_close_at = now() + interval '3 days' from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  'reviewer cannot edit questions or deadlines'
);

select pg_temp.login('11111111-1111-1111-1111-111111111111', 'alice@example.test');
select is(
  (select count(*) from public.form_fields),
  0::bigint,
  'applicant cannot read the working copy'
);
select ok(
  (select published_schema is not null from public.forms where id = 'f0000000-0000-0000-0000-000000000001'),
  'applicant reads the published snapshot'
);
select is(
  (select count(*) from public.forms where id = 'f0000000-0000-0000-0000-000000000002'),
  0::bigint,
  'applicant cannot read draft forms'
);
reset role;

select * from finish(true);
rollback;
