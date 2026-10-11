begin;
create extension if not exists pgtap with schema extensions;

create function pg_temp.field(p_n integer, p_type text, p_extra jsonb default '{}')
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', format('00000000-0000-4000-8000-%s', lpad(p_n::text, 12, '0')),
    'type', p_type,
    'label', p_type,
    'help_text', null,
    'required', false,
    'options', case when p_type in ('single_choice', 'multiple_choice') then '["A", "B"]'::jsonb else 'null'::jsonb end,
    'validation', null,
    'condition', null
  ) || p_extra
$$;

create function pg_temp.cond(p_source jsonb, p_operator text, p_value jsonb)
returns jsonb
language sql
as $$
  select jsonb_build_object('condition', jsonb_build_object('field_id', p_source ->> 'id', 'operator', p_operator, 'value', p_value))
$$;

create function pg_temp.schema(variadic p_fields jsonb[])
returns jsonb
language sql
as $$
  select jsonb_build_object('title', 'T', 'description', null, 'fields', to_jsonb(p_fields))
$$;

create function pg_temp.errors(p_schema jsonb, p_answers jsonb)
returns jsonb
language sql
as $$
  select public.application_answer_errors('a0000000-0000-0000-0000-000000000001', p_schema, p_answers)
$$;

create function pg_temp.error_for(p_field jsonb, p_value jsonb)
returns text
language sql
as $$
  select pg_temp.errors(pg_temp.schema(p_field), jsonb_build_object(p_field ->> 'id', p_value)) ->> (p_field ->> 'id')
$$;

create function pg_temp.visible(p_field jsonb, p_answers jsonb, p_schema jsonb)
returns boolean
language sql
as $$
  select public.form_field_visible(p_schema, p_field ->> 'id', p_answers)
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"full_name": "Alice"}');

insert into public.events (id, slug, name) values
  ('e0000000-0000-0000-0000-000000000001', 'pgtap-event', 'pgTAP Event');

insert into public.forms (id, event_id, role, title) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'participant', 'Participant');

insert into public.applications (id, user_id, event_id, role, form_id) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'e0000000-0000-0000-0000-000000000001', 'participant', 'f0000000-0000-0000-0000-000000000001');

insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('application-files',
   '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000301/5f1d0c9e-0b7a-4d5e-9c3b-2a1e8f6d4c21.pdf',
   '11111111-1111-1111-1111-111111111111', '{"size": 1024, "mimetype": "application/pdf"}');

select plan(55);

-- visibility (mirrors packages/forms/src/visibility.test.ts)
select set_config('test.size', pg_temp.field(1, 'single_choice', '{"options": ["S", "XL"]}')::text, true);
select set_config('test.diets', pg_temp.field(2, 'multiple_choice', '{"options": ["Vegan", "Halal"]}')::text, true);
select set_config('test.agree', pg_temp.field(3, 'checkbox')::text, true);
select set_config('test.why', pg_temp.field(4, 'long_text', pg_temp.cond(current_setting('test.size')::jsonb, 'equals', '"XL"'))::text, true);
select set_config('test.vegan', pg_temp.field(5, 'short_text', pg_temp.cond(current_setting('test.diets')::jsonb, 'includes', '"Vegan"'))::text, true);
select set_config('test.unchecked', pg_temp.field(6, 'short_text', pg_temp.cond(current_setting('test.agree')::jsonb, 'equals', 'false'))::text, true);
select set_config('test.nested', pg_temp.field(7, 'short_text', pg_temp.cond(current_setting('test.why')::jsonb, 'equals', '"x"'))::text, true);
select set_config(
  'test.schema',
  pg_temp.schema(
    current_setting('test.size')::jsonb, current_setting('test.diets')::jsonb, current_setting('test.agree')::jsonb,
    current_setting('test.why')::jsonb, current_setting('test.vegan')::jsonb, current_setting('test.unchecked')::jsonb,
    current_setting('test.nested')::jsonb
  )::text,
  true
);

select ok(pg_temp.visible(current_setting('test.size')::jsonb, '{}', current_setting('test.schema')::jsonb), 'shows unconditional fields');
select ok(
  pg_temp.visible(current_setting('test.why')::jsonb, '{"00000000-0000-4000-8000-000000000001": "XL"}', current_setting('test.schema')::jsonb),
  'equals on single choice matches'
);
select ok(
  not pg_temp.visible(current_setting('test.why')::jsonb, '{"00000000-0000-4000-8000-000000000001": "S"}', current_setting('test.schema')::jsonb),
  'equals on single choice does not match another option'
);
select ok(not pg_temp.visible(current_setting('test.why')::jsonb, '{}', current_setting('test.schema')::jsonb), 'equals on unanswered single choice is hidden');
select ok(
  pg_temp.visible(current_setting('test.vegan')::jsonb, '{"00000000-0000-4000-8000-000000000002": ["Halal", "Vegan"]}', current_setting('test.schema')::jsonb),
  'includes on multiple choice matches'
);
select ok(
  not pg_temp.visible(current_setting('test.vegan')::jsonb, '{"00000000-0000-4000-8000-000000000002": ["Halal"]}', current_setting('test.schema')::jsonb),
  'includes on multiple choice does not match'
);
select ok(pg_temp.visible(current_setting('test.unchecked')::jsonb, '{}', current_setting('test.schema')::jsonb), 'unanswered checkbox is false');
select ok(
  not pg_temp.visible(current_setting('test.unchecked')::jsonb, '{"00000000-0000-4000-8000-000000000003": true}', current_setting('test.schema')::jsonb),
  'checked checkbox does not equal false'
);
select ok(
  not pg_temp.visible(
    current_setting('test.nested')::jsonb,
    '{"00000000-0000-4000-8000-000000000001": "S", "00000000-0000-4000-8000-000000000004": "x"}',
    current_setting('test.schema')::jsonb
  ),
  'hides fields whose source is hidden'
);
select ok(
  not pg_temp.visible(
    pg_temp.field(8, 'short_text', '{"condition": {"field_id": "00000000-0000-4000-8000-999999999999", "operator": "equals", "value": "A"}}'),
    '{}',
    pg_temp.schema(pg_temp.field(8, 'short_text', '{"condition": {"field_id": "00000000-0000-4000-8000-999999999999", "operator": "equals", "value": "A"}}'))
  ),
  'hides fields whose source is missing'
);
select ok(
  not pg_temp.visible(
    pg_temp.field(9, 'single_choice', '{"condition": {"field_id": "00000000-0000-4000-8000-000000000010", "operator": "equals", "value": "A"}}'),
    '{"00000000-0000-4000-8000-000000000009": "A", "00000000-0000-4000-8000-000000000010": "A"}',
    pg_temp.schema(
      pg_temp.field(9, 'single_choice', '{"condition": {"field_id": "00000000-0000-4000-8000-000000000010", "operator": "equals", "value": "A"}}'),
      pg_temp.field(10, 'single_choice', '{"condition": {"field_id": "00000000-0000-4000-8000-000000000009", "operator": "equals", "value": "A"}}')
    )
  ),
  'terminates on cyclic conditions'
);

-- pruning
select is(
  public.prune_application_answers(
    pg_temp.schema(current_setting('test.size')::jsonb, current_setting('test.why')::jsonb),
    '{"00000000-0000-4000-8000-000000000001": "S", "00000000-0000-4000-8000-000000000004": "big", "other": 1}'
  ),
  '{"00000000-0000-4000-8000-000000000001": "S"}'::jsonb,
  'prune drops hidden and unknown answers'
);
select is(
  public.prune_application_answers(
    pg_temp.schema(current_setting('test.size')::jsonb, current_setting('test.why')::jsonb),
    '{"00000000-0000-4000-8000-000000000001": "XL", "00000000-0000-4000-8000-000000000004": "big"}'
  ),
  '{"00000000-0000-4000-8000-000000000001": "XL", "00000000-0000-4000-8000-000000000004": "big"}'::jsonb,
  'prune keeps visible answers'
);
select is(public.prune_application_answers(pg_temp.schema(current_setting('test.size')::jsonb), '{}'), '{}'::jsonb, 'prune of no answers is empty');

-- requiredness (mirrors packages/forms/src/answers.test.ts)
select is(
  pg_temp.errors(pg_temp.schema(pg_temp.field(100, 'short_text', '{"required": true}')), '{}'),
  '{"00000000-0000-4000-8000-000000000100": "Required"}'::jsonb,
  'missing required answer'
);
select is(pg_temp.error_for(pg_temp.field(100, 'short_text', '{"required": true}'), '"  "'), 'Required', 'spaces-only answer is blank');
select is(pg_temp.error_for(pg_temp.field(100, 'short_text', '{"required": true}'), to_jsonb(E'\t\n ﻿'::text)), 'Required', 'JS whitespace answer is blank');
select is(pg_temp.error_for(pg_temp.field(100, 'short_text', '{"required": true}'), 'null'), 'Required', 'null answer is blank');
select is(pg_temp.error_for(pg_temp.field(101, 'multiple_choice', '{"required": true}'), '[]'), 'Required', 'empty array is blank');
select is(pg_temp.errors(pg_temp.schema(pg_temp.field(100, 'short_text')), '{}'), '{}'::jsonb, 'optional blank answers are valid');
select is(
  pg_temp.errors(
    pg_temp.schema(
      current_setting('test.size')::jsonb,
      pg_temp.field(4, 'long_text', pg_temp.cond(current_setting('test.size')::jsonb, 'equals', '"XL"') || '{"required": true}')
    ),
    '{"00000000-0000-4000-8000-000000000001": "S"}'
  ),
  '{}'::jsonb,
  'hidden required fields are not required'
);
select is(
  pg_temp.errors(
    pg_temp.schema(
      current_setting('test.size')::jsonb,
      pg_temp.field(4, 'long_text', pg_temp.cond(current_setting('test.size')::jsonb, 'equals', '"XL"') || '{"required": true}')
    ),
    '{"00000000-0000-4000-8000-000000000001": "XL"}'
  ),
  '{"00000000-0000-4000-8000-000000000004": "Required"}'::jsonb,
  'visible conditional required fields are required'
);
select is(pg_temp.error_for(pg_temp.field(102, 'checkbox', '{"required": true}'), 'false'), 'Required', 'required checkbox must be checked');
select is(pg_temp.error_for(pg_temp.field(102, 'checkbox', '{"required": true}'), 'true'), null, 'checked required checkbox is valid');
select is(pg_temp.error_for(pg_temp.field(102, 'checkbox'), '"yes"'), 'Invalid value', 'checkbox answers are booleans');

-- formats
select is(pg_temp.error_for(pg_temp.field(103, 'long_text', '{"validation": {"min_length": 3, "max_length": 5}}'), '"ab"'), 'Enter at least 3 characters', 'text min length');
select is(pg_temp.error_for(pg_temp.field(103, 'long_text', '{"validation": {"min_length": 3, "max_length": 5}}'), '"abcdef"'), 'Enter at most 5 characters', 'text max length');
select is(pg_temp.error_for(pg_temp.field(103, 'long_text', '{"validation": {"min_length": 3, "max_length": 5}}'), '" abcd "'), null, 'text length ignores surrounding whitespace');
select is(pg_temp.error_for(pg_temp.field(103, 'long_text'), '12'), 'Enter text', 'text answers are strings');
select is(pg_temp.error_for(pg_temp.field(104, 'email'), '"nope"'), 'Enter a valid email address', 'invalid email');
select is(pg_temp.error_for(pg_temp.field(104, 'email'), '"a@b.co"'), null, 'valid email');
select is(pg_temp.error_for(pg_temp.field(105, 'url'), '"https://example.com"'), null, 'valid url');
select is(pg_temp.error_for(pg_temp.field(105, 'url'), '"ftp://example.com"'), 'Enter a valid URL starting with http:// or https://', 'non-http url');
select is(pg_temp.error_for(pg_temp.field(106, 'number', '{"validation": {"min": 18, "max": 99, "integer": true}}'), '17'), 'Enter 18 or more', 'number min');
select is(pg_temp.error_for(pg_temp.field(106, 'number', '{"validation": {"min": 18, "max": 99, "integer": true}}'), '100'), 'Enter 99 or less', 'number max');
select is(pg_temp.error_for(pg_temp.field(106, 'number', '{"validation": {"min": 18, "max": 99, "integer": true}}'), '20.5'), 'Enter a whole number', 'number integer');
select is(pg_temp.error_for(pg_temp.field(106, 'number', '{"validation": {"min": 18, "max": 99, "integer": true}}'), '"20"'), 'Enter a number', 'number answers are numbers');
select is(pg_temp.error_for(pg_temp.field(106, 'number', '{"validation": {"min": 18, "max": 99, "integer": true}}'), '20'), null, 'valid number');
select is(pg_temp.error_for(pg_temp.field(107, 'date', '{"validation": {"min": "2026-01-01", "max": "2026-12-31"}}'), '"2025-12-31"'), 'Enter 2026-01-01 or later', 'date min');
select is(pg_temp.error_for(pg_temp.field(107, 'date', '{"validation": {"min": "2026-01-01", "max": "2026-12-31"}}'), '"2027-01-01"'), 'Enter 2026-12-31 or earlier', 'date max');
select is(pg_temp.error_for(pg_temp.field(107, 'date', '{"validation": {"min": "2026-01-01", "max": "2026-12-31"}}'), '"2026-13-01"'), 'Enter a valid date', 'invalid date');
select is(pg_temp.error_for(pg_temp.field(107, 'date', '{"validation": {"min": "2026-01-01", "max": "2026-12-31"}}'), '"2026-06-01"'), null, 'valid date');
select is(pg_temp.error_for(pg_temp.field(108, 'single_choice'), '"C"'), 'Choose one of the options', 'single choice outside options');
select is(pg_temp.error_for(pg_temp.field(108, 'single_choice'), '"A"'), null, 'valid single choice');
select is(pg_temp.error_for(pg_temp.field(109, 'multiple_choice'), '["A", "C"]'), 'Choose from the options', 'multiple choice outside options');
select is(pg_temp.error_for(pg_temp.field(109, 'multiple_choice'), '["A", "A"]'), 'Choose from the options', 'multiple choice duplicates');
select is(pg_temp.error_for(pg_temp.field(109, 'multiple_choice'), '["A", "B"]'), null, 'valid multiple choice');

-- files
select set_config(
  'test.pdf',
  jsonb_build_object(
    'path', '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000301/5f1d0c9e-0b7a-4d5e-9c3b-2a1e8f6d4c21.pdf',
    'name', 'r.pdf', 'size', 1024, 'type', 'application/pdf'
  )::text,
  true
);
select is(pg_temp.error_for(pg_temp.field(301, 'file'), current_setting('test.pdf')::jsonb), null, 'uploaded pdf is valid');
select is(
  pg_temp.error_for(pg_temp.field(301, 'file'), current_setting('test.pdf')::jsonb || '{"type": "image/png"}'),
  'This file type is not allowed', 'default accept is pdf'
);
select is(
  pg_temp.error_for(pg_temp.field(301, 'file'), current_setting('test.pdf')::jsonb || jsonb_build_object('size', 11 * 1024 * 1024)),
  'Files must be 10 MB or smaller', 'default size limit is 10 MB'
);
select is(
  pg_temp.error_for(pg_temp.field(301, 'file', '{"validation": {"max_size_mb": 1}}'), current_setting('test.pdf')::jsonb || jsonb_build_object('size', 2 * 1024 * 1024)),
  'Files must be 1 MB or smaller', 'field size limit overrides the default'
);
select is(pg_temp.error_for(pg_temp.field(301, 'file'), '"r.pdf"'), 'Upload a file', 'file answers are objects');
select is(
  pg_temp.error_for(pg_temp.field(302, 'file'), current_setting('test.pdf')::jsonb),
  'Upload the file again', 'file path must be under the field folder'
);
select is(
  pg_temp.error_for(
    pg_temp.field(301, 'file'),
    current_setting('test.pdf')::jsonb || jsonb_build_object('path', '11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000301/missing.pdf')
  ),
  'Upload the file again', 'file must exist in storage'
);

set local role authenticated;
select throws_ok(
  $$select public.application_answer_errors('a0000000-0000-0000-0000-000000000001', '{}', '{}')$$,
  '42501', null, 'applicants cannot call the validator directly'
);
reset role;

select * from finish(true);
rollback;
