begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer,p_method text default 'otp') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','d4600000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','units-'||n||'@example.test','amr',json_build_array(json_build_object('method',p_method)))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.q(p_label text) returns text language sql as $$
  select id::text from public.project_questions
  where event_id='e4600000-0000-0000-0000-000000000001' and label=p_label;
$$;
create function pg_temp.project_error(p_label text,p_value jsonb,p_complete boolean default false) returns text language sql as $$
  select public.project_answer_errors(p,jsonb_build_object(pg_temp.q(p_label),p_value),p_complete)->>('answers.'||pg_temp.q(p_label))
  from public.projects p where p.id='a4600000-0000-0000-0000-000000000001';
$$;
create function pg_temp.save(p_label text,p_type text,p_max integer,p_unit text default 'characters',
  p_required boolean default false,p_question_id uuid default null)
returns uuid language sql as $$
  select public.admin_save_project_question(p_event_id=>'e4600000-0000-0000-0000-000000000001',p_label=>p_label,
    p_help_text=>'',p_required=>p_required,p_max_length=>p_max,p_question_id=>p_question_id,
    p_type=>p_type::public.field_type,p_length_unit=>p_unit::public.text_length_unit);
$$;
create function pg_temp.text_field(p_validation jsonb,p_required boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('id','00000000-0000-4000-8000-000000000461','type','long_text','label','Why',
    'help_text',null,'required',p_required,'options',null,'validation',p_validation,'condition',null);
$$;
create function pg_temp.application_error(p_validation jsonb,p_value text,p_required boolean default false) returns text language sql as $$
  select public.application_answer_errors('a4600000-0000-0000-0000-000000000009',
    jsonb_build_object('title','T','description',null,'fields',jsonb_build_array(pg_temp.text_field(p_validation,p_required))),
    jsonb_build_object('00000000-0000-4000-8000-000000000461',p_value))->>'00000000-0000-4000-8000-000000000461';
$$;
create function pg_temp.add_field(p_type text,p_validation jsonb) returns void language sql as $$
  insert into public.form_fields(form_id,position,type,label,validation)
  values ('f4600000-0000-0000-0000-000000000001',1,p_type::public.field_type,'Field',p_validation);
$$;

insert into auth.users(id,email,email_confirmed_at)
select ('d4600000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'units-'||n||'@example.test',now() from generate_series(1,2)n;
insert into public.admin_allowlist(email,level) values ('units-1@example.test','organizer');
insert into public.events(id,slug,name) values ('e4600000-0000-0000-0000-000000000001','units-test','Units');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,judging_close_at)
values ('e4600000-0000-0000-0000-000000000001',true,now()-interval '2 days',now()+interval '4 days');
insert into public.forms(id,event_id,role,title) values ('f4600000-0000-0000-0000-000000000001','e4600000-0000-0000-0000-000000000001','participant','Test');
insert into public.applications(id,user_id,event_id,role,form_id,status,submitted_at) values
 ('a4600000-0000-0000-0000-000000000002','d4600000-0000-0000-0000-000000000002','e4600000-0000-0000-0000-000000000001',
  'participant','f4600000-0000-0000-0000-000000000001','submitted',now());
insert into public.application_decisions(application_id,decision) values ('a4600000-0000-0000-0000-000000000002','accepted');
insert into public.projects(id,event_id,owner_user_id) values
 ('a4600000-0000-0000-0000-000000000001','e4600000-0000-0000-0000-000000000001','d4600000-0000-0000-0000-000000000002');
insert into public.project_questions(event_id,position,label,max_length)
values ('e4600000-0000-0000-0000-000000000001',100,'Legacy',300);

select plan(59);

-- Word counting matches countWords in @workspace/forms.
select is(public.word_count(''),0,'empty text has no words');
select is(public.word_count(E' \t\n\r '),0,'whitespace-only text has no words');
select is(public.word_count(U&'\FEFF\00A0\3000'),0,'Unicode whitespace-only text has no words');
select is(public.word_count('one'),1,'single word');
select is(public.word_count(E'  one  two\tthree\n'),3,'runs of whitespace separate words and ends are trimmed');
select is(public.word_count(U&'one\00A0two\3000three\2003four\2028five'),5,'Unicode whitespace separates words');
select is(public.word_count(U&'zero\200Bwidth'),1,'zero-width space is not whitespace, as in JavaScript');
select is(public.word_count('don''t stop-me now.'),3,'punctuation stays inside words');
select is(public.word_count(null),null,'null text has no count');
select is(public.format_length(1,'words'),'1 word','singular word');
select is(public.format_length(1,'characters'),'1 character','singular character');
select is(public.format_length(2,'words'),'2 words','plural words');

-- Project question configuration.
select is((select length_unit::text from public.project_questions where label='Legacy'),'characters','existing questions keep character limits');
select pg_temp.login(1,'oauth');
select throws_ok($$select pg_temp.save('Bad','long_text',1501,'words')$$,'22023','Word limits must be at most 1500 words','word limits capped');
select throws_ok($$select pg_temp.save('Bad','url',null,'words')$$,'22023','Only text questions have a word limit','only text questions count words');
select throws_ok($$select public.admin_save_project_question(p_event_id=>'e4600000-0000-0000-0000-000000000001',p_label=>'Bad',
  p_help_text=>'',p_required=>false,p_max_length=>10,p_type=>'long_text',p_length_unit=>null)$$,
  '22023','Choose characters or words','unit required');
select lives_ok($$select pg_temp.save('Essay','long_text',1500,'words')$$,'word limit at the cap');
select lives_ok($$select pg_temp.save('Brief','short_text',3,'words',true)$$,'short text word limit');
select lives_ok($$select pg_temp.save('One','short_text',1,'words')$$,'one-word limit');
select lives_ok($$select public.admin_save_project_question('e4600000-0000-0000-0000-000000000001','Chars','',false,10)$$,
  'calls without a unit keep character limits');
select lives_ok($$select pg_temp.save('Long','long_text',10000)$$,'character limits keep the 10,000 cap');
select is((select length_unit::text from public.admin_project_questions('e4600000-0000-0000-0000-000000000001') where label='Essay'),
  'words','organizers read the unit');
select is((select length_unit::text from public.admin_project_questions('e4600000-0000-0000-0000-000000000001') where label='Chars'),
  'characters','unit defaults to characters');
reset role;
select is((select length_unit::text from public.project_questions where label='Chars'),'characters','stored default is characters');
select throws_ok($$insert into public.project_questions(event_id,position,label,max_length,length_unit)
  values ('e4600000-0000-0000-0000-000000000001',200,'Direct',1501,'words')$$,'23514',null,'table rejects word limits above the cap');
select throws_ok($$insert into public.project_questions(event_id,position,label,type,length_unit)
  values ('e4600000-0000-0000-0000-000000000001',200,'Direct','url','words')$$,'23514',null,'table rejects word units on non-text questions');
select pg_temp.login(2);
select is((select x->>'length_unit' from jsonb_array_elements(public.participant_project_detail('a4600000-0000-0000-0000-000000000001',
  'e4600000-0000-0000-0000-000000000001')->'questions') x where x->>'label'='Brief'),'words','participants receive the unit');
reset role;

-- Project answer validation.
select is(pg_temp.project_error('Brief','"one two three"'),null,'answer at the word limit');
select is(pg_temp.project_error('Brief',to_jsonb(E'  one  two\nthree  '::text)),null,'whitespace runs count once');
select is(pg_temp.project_error('Brief','"one two three four"'),'Use 3 words or fewer','answer over the word limit');
select is(pg_temp.project_error('Brief',to_jsonb(repeat('x',50))),null,'word limits ignore characters per word');
select is(pg_temp.project_error('One','"one two"'),'Use 1 word or fewer','singular word limit');
select is(pg_temp.project_error('Brief','"   "',true),'This question is required','whitespace-only answers are empty');
select is(pg_temp.project_error('Essay',to_jsonb(repeat('a ',1500))),null,'answer at the word cap');
select is(pg_temp.project_error('Essay',to_jsonb(repeat('a ',1501))),'Use 1500 words or fewer','answer over the word cap');
select is(pg_temp.project_error('Essay',to_jsonb(repeat('x',10001))),'Use 10000 characters or fewer','word limits keep the 10,000 character cap');
select is(pg_temp.project_error('Chars',to_jsonb(repeat('x',10))),null,'answer at the character limit');
select is(pg_temp.project_error('Chars','"one two three"'),'Use 10 characters or fewer','character limits count characters');
select is(pg_temp.project_error('Legacy',to_jsonb(repeat('x',301))),'Use 300 characters or fewer','existing questions count characters');

-- Changing the unit of an answered question.
update public.projects set answers=jsonb_build_object(pg_temp.q('Brief'),'one two') where id='a4600000-0000-0000-0000-000000000001';
select set_config('test.brief',pg_temp.q('Brief'),true);
select pg_temp.login(1,'oauth');
select is((select answered from public.admin_project_questions('e4600000-0000-0000-0000-000000000001') where label='Brief'),true,'question answered');
select lives_ok($$select pg_temp.save('Brief','short_text',20,'characters',true,current_setting('test.brief')::uuid)$$,'answered questions may change unit');
reset role;
select is((select length_unit::text from public.project_questions where label='Brief'),'characters','unit changed');

-- Application form field configuration.
select lives_ok($$select pg_temp.add_field('short_text','{"max_length":1500,"length_unit":"words"}')$$,'word limit at the cap');
select throws_ok($$select pg_temp.add_field('short_text','{"max_length":1501,"length_unit":"words"}')$$,'23514',null,'word maximum capped');
select throws_ok($$select pg_temp.add_field('long_text','{"min_length":1501,"length_unit":"words"}')$$,'23514',null,'word minimum capped');
select lives_ok($$select pg_temp.add_field('long_text','{"max_length":5000,"length_unit":"characters"}')$$,'character limits are not word-capped');
select lives_ok($$select pg_temp.add_field('long_text','{"max_length":5000}')$$,'validation without a unit still saves');
select throws_ok($$select pg_temp.add_field('number','{"max":5,"length_unit":"words"}')$$,'23514',null,'only text fields have a unit');
select throws_ok($$select pg_temp.add_field('short_text','{"max_length":5,"length_unit":"lines"}')$$,'23514',null,'unknown units rejected');
select throws_ok($$select pg_temp.add_field('short_text','{"max_length":5,"length_unit":null}')$$,'23514',null,'null units rejected');

-- Application answer validation.
select is(pg_temp.application_error('{"max_length":5}','abcdef'),'Enter at most 5 characters','snapshots without a unit count characters');
select is(pg_temp.application_error('{"max_length":5}','  abcde  '),null,'character counts trim whitespace');
select is(pg_temp.application_error('{"min_length":2,"max_length":3,"length_unit":"words"}',E' one  two\tthree '),null,'answer within word limits');
select is(pg_temp.application_error('{"max_length":3,"length_unit":"words"}','one two three four'),'Enter at most 3 words','answer over the word maximum');
select is(pg_temp.application_error('{"min_length":2,"length_unit":"words"}',repeat('x',50)),'Enter at least 2 words','answer under the word minimum');
select is(pg_temp.application_error('{"max_length":3,"length_unit":"words"}',U&'one\00A0two\3000three\2003four'),'Enter at most 3 words','Unicode whitespace separates words');
select is(pg_temp.application_error('{"max_length":3,"length_unit":"words"}',' ',true),'Required','whitespace-only answers are empty');
select is(pg_temp.application_error('{"max_length":1,"length_unit":"words"}','one two'),'Enter at most 1 word','singular word maximum');
select is(pg_temp.application_error('{"min_length":2,"max_length":1}','ab'),'Enter at most 1 character','singular character maximum');

select * from finish(true);
rollback;
