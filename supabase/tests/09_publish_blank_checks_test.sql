begin;
create extension if not exists pgtap with schema extensions;

create function pg_temp.publish_with(p_part text, p_value text)
returns text
language plpgsql
as $$
begin
  update public.forms
  set title = case when p_part = 'title' then p_value else 'Participant' end
  where id = 'f0000000-0000-0000-0000-000000000001';
  update public.form_fields
  set label = case when p_part = 'label' then p_value else 'Name' end
  where id = 'd0000000-0000-0000-0000-000000000001';
  update public.form_fields
  set options = jsonb_build_array('S', case when p_part = 'option' then p_value else 'XL' end)
  where id = 'd0000000-0000-0000-0000-000000000002';

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'email', 'organizer@example.test',
      'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'oauth'))
    )::text,
    true
  );
  set local role authenticated;
  begin
    perform public.admin_publish_form('f0000000-0000-0000-0000-000000000001');
    reset role;
    return null;
  exception when others then
    reset role;
    return sqlerrm;
  end;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organizer@example.test', '{"full_name": "Organizer"}');

insert into public.admin_allowlist (email, level) values ('organizer@example.test', 'organizer');

insert into public.events (id, slug, name) values
  ('e0000000-0000-0000-0000-000000000001', 'pgtap-event', 'pgTAP Event');

insert into public.forms (id, event_id, role, title, submissions_close_at, edits_lock_at) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'participant', 'Participant',
   now() + interval '1 day', now() + interval '2 days');

insert into public.form_fields (id, form_id, position, type, label, options) values
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 1, 'short_text', 'Name', null),
  ('d0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 2, 'single_choice', 'Size', '["S", "XL"]');

select plan(17);

select is(public.js_trim(E'﻿  a b \t\n'), 'a b', 'js_trim strips JS whitespace including NBSP and BOM');
select is(public.js_trim('x'), 'x', 'js_trim keeps non-blank text');

select is(pg_temp.publish_with('none', null), null, 'normal title, labels, and options publish');
select is(pg_temp.publish_with('title', E'  Title\t'), null, 'title with surrounding whitespace publishes');

select is(pg_temp.publish_with('title', E'\t\t'), 'Add a form title', 'tab-only title is rejected');
select is(pg_temp.publish_with('title', E'\n'), 'Add a form title', 'newline-only title is rejected');
select is(pg_temp.publish_with('title', E' '), 'Add a form title', 'NBSP-only title is rejected');
select is(pg_temp.publish_with('title', E' \t\r\n ﻿ '), 'Add a form title', 'mixed whitespace title is rejected');

select is(pg_temp.publish_with('label', E'\t\t'), 'Question 1 needs a label', 'tab-only label is rejected');
select is(pg_temp.publish_with('label', E'\n'), 'Question 1 needs a label', 'newline-only label is rejected');
select is(pg_temp.publish_with('label', E' '), 'Question 1 needs a label', 'NBSP-only label is rejected');
select is(pg_temp.publish_with('label', E' \t\r\n ﻿ '), 'Question 1 needs a label', 'mixed whitespace label is rejected');

select is(pg_temp.publish_with('option', E'\t\t'), 'Question 2 has blank or duplicate options', 'tab-only option is rejected');
select is(pg_temp.publish_with('option', E'\n'), 'Question 2 has blank or duplicate options', 'newline-only option is rejected');
select is(pg_temp.publish_with('option', E' '), 'Question 2 has blank or duplicate options', 'NBSP-only option is rejected');
select is(pg_temp.publish_with('option', E' \t\r\n ﻿ '), 'Question 2 has blank or duplicate options', 'mixed whitespace option is rejected');

select is(pg_temp.publish_with('none', null), null, 'restored form publishes again');

select * from finish(true);
rollback;
