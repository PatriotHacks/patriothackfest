begin;
create extension if not exists pgtap with schema extensions;

insert into public.events (id, slug, name) values
  ('e0000000-0000-0000-0000-000000000001', 'pgtap-event', 'pgTAP Event');

insert into public.forms (id, event_id, role, title) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'participant', 'Participant');

select plan(6);

select lives_ok(
  $$insert into public.form_fields (form_id, position, type, label, validation)
    values ('f0000000-0000-0000-0000-000000000001', 1, 'file', 'Resume', '{"max_size_mb": 10}')$$,
  'file size limit of 10 MB is allowed'
);
select lives_ok(
  $$insert into public.form_fields (form_id, position, type, label, validation)
    values ('f0000000-0000-0000-0000-000000000001', 2, 'file', 'Cover', '{"accept": ["application/pdf"]}')$$,
  'file size limit is optional'
);
select lives_ok(
  $$insert into public.form_fields (form_id, position, type, label, validation)
    values ('f0000000-0000-0000-0000-000000000001', 3, 'file', 'Small', '{"max_size_mb": 0.5}')$$,
  'fractional limits under 10 MB are allowed'
);
select throws_ok(
  $$insert into public.form_fields (form_id, position, type, label, validation)
    values ('f0000000-0000-0000-0000-000000000001', 4, 'file', 'Big', '{"max_size_mb": 10.5}')$$,
  '23514', null, 'file size limit cannot exceed 10 MB'
);
select throws_ok(
  $$insert into public.form_fields (form_id, position, type, label, validation)
    values ('f0000000-0000-0000-0000-000000000001', 5, 'file', 'Zero', '{"max_size_mb": 0}')$$,
  '23514', null, 'file size limit must be positive'
);
select throws_ok(
  $$insert into public.form_fields (form_id, position, type, label, validation)
    values ('f0000000-0000-0000-0000-000000000001', 6, 'file', 'Text', '{"max_size_mb": "50"}')$$,
  '23514', null, 'file size limit must be a number'
);

select * from finish(true);
rollback;
