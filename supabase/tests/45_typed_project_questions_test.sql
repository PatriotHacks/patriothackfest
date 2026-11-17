begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer,p_method text default 'otp') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','d4500000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','typed-'||n||'@example.test','amr',json_build_array(json_build_object('method',p_method)))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.q(p_label text) returns text language sql as $$
  select current_setting('test.q_'||p_label);
$$;
create function pg_temp.remember_questions() returns void language sql as $$
  select set_config('test.q_'||label,id::text,true) from public.project_questions
  where event_id='e4500000-0000-0000-0000-000000000001';
$$;
create function pg_temp.detail() returns jsonb language sql as $$
  select public.participant_project_detail('a4500000-0000-0000-0000-000000000001','e4500000-0000-0000-0000-000000000001');
$$;
create function pg_temp.save_errors(p_answers jsonb,p_submit boolean default false) returns jsonb language plpgsql as $$
declare v_detail text;
begin
  perform public.participant_save_project('a4500000-0000-0000-0000-000000000001',
    '{"name":"Demo","summary":"Summary","description":"Description","demo_url":"https://example.com"}'::jsonb,
    p_answers,'{}',p_submit,(pg_temp.detail()->'project'->>'updated_at')::timestamptz);
  return '{}'::jsonb;
exception when sqlstate 'PT422' then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail::jsonb;
end;
$$;
create function pg_temp.error_for(p_label text,p_value jsonb,p_submit boolean default false) returns text language sql as $$
  select pg_temp.save_errors(jsonb_build_object(pg_temp.q(p_label),p_value),p_submit)->>('answers.'||pg_temp.q(p_label));
$$;
create function pg_temp.path(p_file text,p_question text default null) returns text language sql as $$
  select 'a4500000-0000-0000-0000-000000000001/'||coalesce(p_question,pg_temp.q('Deck'))||'/'||p_file||'.pdf';
$$;
create function pg_temp.file(p_path text,p_size integer default 1000,p_type text default 'application/pdf') returns jsonb language sql as $$
  select jsonb_build_object('path',p_path,'name','deck.pdf','size',p_size,'type',p_type);
$$;
create function pg_temp.upload(p_path text,p_size bigint default 1000,p_type text default 'application/pdf') returns void language sql as $$
  insert into storage.objects(bucket_id,name,metadata)
  values('project-files',p_path,jsonb_build_object('size',p_size,'mimetype',p_type));
$$;
create function pg_temp.signable(p_name text) returns bigint language sql as $$
  select set_config('storage.operation','storage.object.sign',true);
  select count(*) from storage.objects where bucket_id='project-files' and name=p_name;
$$;
create function pg_temp.downloadable(p_name text) returns bigint language sql as $$
  select set_config('storage.operation','storage.object.get_authenticated',true);
  select count(*) from storage.objects where bucket_id='project-files' and name=p_name;
$$;

insert into auth.users(id,email,email_confirmed_at)
select ('d4500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'typed-'||n||'@example.test',now() from generate_series(1,5)n;
insert into public.admin_allowlist(email,level) values ('typed-1@example.test','organizer');
insert into public.events(id,slug,name) values ('e4500000-0000-0000-0000-000000000001','typed-test','Typed');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,judging_close_at)
values ('e4500000-0000-0000-0000-000000000001',true,now()-interval '2 days',now()+interval '4 days');
insert into public.forms(id,event_id,role,title) values ('f4500000-0000-0000-0000-000000000009','e4500000-0000-0000-0000-000000000001','participant','Test');
insert into public.applications(id,user_id,event_id,role,form_id,status,submitted_at)
select ('a4500000-0000-0000-0000-00000000000'||n)::uuid,('d4500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
  'e4500000-0000-0000-0000-000000000001','participant','f4500000-0000-0000-0000-000000000009','submitted',now()
from generate_series(2,4)n;
insert into public.application_decisions(application_id,decision)
select id,'accepted' from public.applications where event_id='e4500000-0000-0000-0000-000000000001';
insert into public.projects(id,event_id,owner_user_id) values
 ('a4500000-0000-0000-0000-000000000001','e4500000-0000-0000-0000-000000000001','d4500000-0000-0000-0000-000000000002');
insert into public.project_collaborators(project_id,event_id,user_id) values
 ('a4500000-0000-0000-0000-000000000001','e4500000-0000-0000-0000-000000000001','d4500000-0000-0000-0000-000000000003');
insert into public.event_judges(id,event_id,email,user_id) values
 ('b4500000-0000-0000-0000-000000000001','e4500000-0000-0000-0000-000000000001','typed-5@example.test','d4500000-0000-0000-0000-000000000005');
insert into public.project_questions(event_id,position,label,max_length)
values ('e4500000-0000-0000-0000-000000000001',100,'Legacy',300);
select set_config('test.a','c4500000-0000-4000-8000-00000000000a',true);
select set_config('test.b','c4500000-0000-4000-8000-00000000000b',true);
select set_config('test.options',jsonb_build_array(
  jsonb_build_object('id',current_setting('test.a'),'label',' Web '),
  jsonb_build_object('id',current_setting('test.b'),'label','Mobile'))::text,true);

select plan(96);

-- Type column and question configuration.
select is((select type::text from public.project_questions where label='Legacy'),'long_text','existing and untyped rows default to long_text');
select pg_temp.login(1,'oauth');
select throws_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Bad','',false,null,null,'single_choice','[]')$$,
  '22023','Add at least one option','choice questions need options');
select throws_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Bad','',false,null,null,'short_text')$$,
  '22023','Only text questions have a maximum length','text questions need a maximum length');
select throws_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Bad','',false,100,null,'url')$$,
  '22023','Only text questions have a maximum length','non-text questions have no maximum length');
select throws_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Bad','',false,null,null,'url',current_setting('test.options')::jsonb)$$,
  '22023','Only choice questions have options','only choice questions have options');
select throws_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Bad','',false,null,null,'single_choice',%L)$$,
  jsonb_build_array(jsonb_build_object('id',current_setting('test.a'),'label','Yes'),jsonb_build_object('id',current_setting('test.b'),'label',' yes '))),
  '22023','Option labels must be unique','option labels unique ignoring case and spaces');
select throws_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Bad','',false,null,null,'single_choice','[{"id":"x","label":"A"}]')$$,
  '22023','Invalid options','option ids must be uuids');
select throws_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Bad','',false,null,null,'file',null,'{"max_size_mb":11}')$$,
  '22023','Maximum file size must be greater than 0 and at most 10 MB','file limit capped at 10 MB');
select throws_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Bad','',false,100,null,'long_text',null,'{"max_size_mb":1}')$$,
  '22023','Maximum file size must be greater than 0 and at most 10 MB','only file questions carry validation');
select throws_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Bad','',false,null,null,'date')$$,
  '22023','Choose a supported question type','unsupported field types rejected');
select lives_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Short','',false,20,null,'short_text')$$,'short text question');
select lives_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Link','',false,null,null,'url')$$,'url question');
select lives_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Pick','',true,null,null,'single_choice',current_setting('test.options')::jsonb)$$,'single choice question');
select lives_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Many','',false,null,null,'multiple_choice',current_setting('test.options')::jsonb)$$,'multiple choice question');
select lives_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Deck','',true,null,null,'file',null,'{"max_size_mb":1}')$$,'file question');
select lives_ok($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Spare','',false,100)$$,'five-argument calls still create long text');
reset role;
select pg_temp.remember_questions();
select is((select options->0->>'label' from public.project_questions where label='Pick'),'Web','option labels trimmed');
select is((select type::text from public.project_questions where label='Spare'),'long_text','default type is long_text');
select pg_temp.login(1,'oauth');
select is((select answered from public.admin_project_questions('e4500000-0000-0000-0000-000000000001') where label='Pick'),false,'unanswered question reported');
reset role;

-- Typed answer validation.
select pg_temp.login(2);
select ok(pg_temp.detail()->'questions'->0 ?& array['type','options','validation','max_length'],'participant receives type metadata');
select is(pg_temp.error_for('Short',to_jsonb(repeat('x',21))),'Use 20 characters or fewer','short text length limited');
select is(pg_temp.error_for('Link','"not a url"'),'Enter an HTTP or HTTPS URL','url format checked');
select is(pg_temp.error_for('Link','5'),'Enter an HTTP or HTTPS URL','url must be text');
select is(pg_temp.error_for('Link','"javascript:alert(1)"'),'Enter an HTTP or HTTPS URL','non-http schemes rejected');
select is(pg_temp.error_for('Pick','["x"]'),'Choose one of the options','single choice must be one id');
select is(pg_temp.error_for('Pick','"c4500000-0000-4000-8000-0000000000ff"'),null,'unknown single choice id dropped on drafts');
select is(pg_temp.error_for('Pick','"c4500000-0000-4000-8000-0000000000ff"',true),'This question is required','dropped id leaves a required question unanswered');
select is(pg_temp.error_for('Many',jsonb_build_array(current_setting('test.a'),current_setting('test.a'))),'Choose from the options','duplicate choices rejected');
select is(pg_temp.error_for('Many',to_jsonb(current_setting('test.a'))),'Choose from the options','multiple choice must be a list');
select is(pg_temp.error_for('Many','[1]'),'Choose from the options','choice ids must be text');
select is(pg_temp.error_for('Deck','"deck.pdf"'),'Upload a file','file answer must be an object');
select is(pg_temp.error_for('Deck',pg_temp.file(pg_temp.path('c4500000-0000-4000-8000-000000000001'))||'{"extra":1}'),'Upload a file','file answer keys fixed');
select is(pg_temp.error_for('Deck',pg_temp.file(pg_temp.path('c4500000-0000-4000-8000-000000000001'))),'Upload the file again','file must exist in storage');
select is(pg_temp.error_for('Deck',pg_temp.file(pg_temp.path('c4500000-0000-4000-8000-000000000001',pg_temp.q('Short')))),'Upload the file again','file path must match its question');

-- Owner-only uploads while the project is editable.
select set_config('test.file1',pg_temp.path('c4500000-0000-4000-8000-000000000001'),true);
select set_config('test.file2',pg_temp.path('c4500000-0000-4000-8000-000000000002'),true);
select ok(public.project_file_writable(current_setting('test.file1')),'owner may upload to a file question');
select ok(not public.project_file_writable(pg_temp.path('c4500000-0000-4000-8000-000000000001',pg_temp.q('Short'))),'uploads only to file questions');
select ok(not public.project_file_writable('a4500000-0000-0000-0000-000000000001/deck.pdf'),'uploads only to the canonical layout');
select lives_ok($$select pg_temp.upload(current_setting('test.file1'))$$,'owner uploads first file');
select lives_ok($$select pg_temp.upload(current_setting('test.file2'),2000)$$,'owner uploads second file');
select lives_ok($$select pg_temp.upload(pg_temp.path('c4500000-0000-4000-8000-000000000003'),1000,'image/png')$$,'owner uploads a mislabeled file');
select lives_ok($$select pg_temp.upload(pg_temp.path('c4500000-0000-4000-8000-000000000004'),2*1024*1024)$$,'owner uploads an oversized file');
select is(pg_temp.error_for('Deck',pg_temp.file(pg_temp.path('c4500000-0000-4000-8000-000000000003'))),'Upload a PDF file','stored object type checked, not the client type');
select is(pg_temp.error_for('Deck',pg_temp.file(pg_temp.path('c4500000-0000-4000-8000-000000000004'))),'Files must be 1 MB or smaller','stored object size checked, not the client size');
select is(pg_temp.save_errors(jsonb_build_object(
  pg_temp.q('Short'),' hi ',pg_temp.q('Link'),'https://example.com/deck',pg_temp.q('Pick'),current_setting('test.a'),
  pg_temp.q('Many'),jsonb_build_array(current_setting('test.b'),'c4500000-0000-4000-8000-0000000000ff'),
  pg_temp.q('Deck'),pg_temp.file(current_setting('test.file1'),5,'text/plain')),true),'{}'::jsonb,'typed answers submit');
select is(pg_temp.detail()->'project'->'answers',jsonb_build_object(
  pg_temp.q('Short'),'hi',pg_temp.q('Link'),'https://example.com/deck',pg_temp.q('Pick'),current_setting('test.a'),
  pg_temp.q('Many'),jsonb_build_array(current_setting('test.b')),pg_temp.q('Deck'),pg_temp.file(current_setting('test.file1'))),
  'answers stored as typed json with real file size and type');
select ok(not public.project_file_deletable(current_setting('test.file1')),'saved file cannot be deleted');
select ok(public.project_file_deletable(current_setting('test.file2')),'unreferenced file can be deleted');
select is(pg_temp.signable(current_setting('test.file2')),1::bigint,'owner can sign any file of the project');
select is(pg_temp.downloadable(current_setting('test.file1')),0::bigint,'no direct downloads');
reset role;
select pg_temp.login(3);
select ok(not public.project_file_writable(current_setting('test.file1')),'collaborator cannot upload');
select throws_ok(format($$insert into storage.objects(bucket_id,name) values('project-files',%L)$$,pg_temp.path('c4500000-0000-4000-8000-000000000006')),
  '42501',null,'collaborator upload denied by policy');
select ok(not public.project_file_deletable(current_setting('test.file2')),'collaborator cannot delete');
select is(pg_temp.signable(current_setting('test.file1')),1::bigint,'collaborator can sign project files');
reset role;
select pg_temp.login(4);
select ok(not public.project_file_writable(current_setting('test.file1')),'outsider cannot upload');
select throws_ok(format($$insert into storage.objects(bucket_id,name) values('project-files',%L)$$,pg_temp.path('c4500000-0000-4000-8000-000000000007')),
  '42501',null,'outsider upload denied by policy');
select is(pg_temp.signable(current_setting('test.file1')),0::bigint,'outsider cannot sign project files');
reset role;
select pg_temp.login(1,'oauth');
select is(pg_temp.signable(current_setting('test.file1')),1::bigint,'organizer can sign project files');
reset role;

-- Type lock and removed options.
select pg_temp.login(1,'oauth');
select is((select answered from public.admin_project_questions('e4500000-0000-0000-0000-000000000001') where label='Pick'),true,'answered question reported');
select throws_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Pick','',true,null,%L,'multiple_choice',%L)$$,
  pg_temp.q('Pick'),current_setting('test.options')),
  'P0001','This question already has answers, so its type cannot change. Archive it and add a new question instead.','answered type locked');
select lives_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Pick renamed','',true,null,%L,'single_choice',%L)$$,
  pg_temp.q('Pick'),jsonb_build_array(jsonb_build_object('id',current_setting('test.b'),'label','Mobile app'))),'answered question keeps editing within its type');
select lives_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Spare','',false,null,%L,'url')$$,pg_temp.q('Spare')),'unanswered type can change');
reset role;
select throws_ok(format($$update public.project_questions set type='url',max_length=null where id=%L$$,pg_temp.q('Short')),
  'P0001','This question already has answers, so its type cannot change. Archive it and add a new question instead.','type lock enforced by trigger');
select pg_temp.login(2);
select is(pg_temp.save_errors(null)->>('answers.'||pg_temp.q('Pick')),'This question is required','removed option requires re-answering');
select is(pg_temp.save_errors(jsonb_build_object(
  pg_temp.q('Short'),'hi',pg_temp.q('Pick'),current_setting('test.b'),pg_temp.q('Deck'),pg_temp.file(current_setting('test.file1')))),'{}'::jsonb,'re-answered project saves');
reset role;
select pg_temp.login(1,'oauth');
select lives_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Many','',false,null,%L,'multiple_choice',%L)$$,
  pg_temp.q('Many'),jsonb_build_array(jsonb_build_object('id',current_setting('test.a'),'label','Web'))),'organizer removes an option');
reset role;
select is((select archived_options from public.project_questions where id=pg_temp.q('Many')::uuid),
  jsonb_build_array(jsonb_build_object('id',current_setting('test.b'),'label','Mobile')),'removed option is archived');
select pg_temp.login(1,'oauth');
select lives_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Many','',false,null,%L,'multiple_choice',%L)$$,
  pg_temp.q('Many'),jsonb_build_array(jsonb_build_object('id',current_setting('test.a'),'label','Web'),
    jsonb_build_object('id','c4500000-0000-4000-8000-0000000000c1','label',' mobile '))),'organizer re-adds the option in a later save');
reset role;
select is((select options->1->>'id' from public.project_questions where id=pg_temp.q('Many')::uuid),current_setting('test.b'),
  're-added label in a later save restores the archived id');
select is((select archived_options from public.project_questions where id=pg_temp.q('Many')::uuid),'[]'::jsonb,
  'restored option leaves the archive');
select pg_temp.login(1,'oauth');
select lives_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Many','',false,null,%L,'multiple_choice',%L)$$,
  pg_temp.q('Many'),jsonb_build_array(jsonb_build_object('id',current_setting('test.a'),'label','Web'),
    jsonb_build_object('id','c4500000-0000-4000-8000-0000000000c3','label',' MOBILE '))),'organizer replaces an option with the same label');
reset role;
select is((select options->1->>'id' from public.project_questions where id=pg_temp.q('Many')::uuid),current_setting('test.b'),
  'same-save re-add keeps the id');
select pg_temp.login(1,'oauth');
select lives_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Many','',false,null,%L,'multiple_choice',%L)$$,
  pg_temp.q('Many'),jsonb_build_array(jsonb_build_object('id',current_setting('test.a'),'label','Mobile'),
    jsonb_build_object('id','c4500000-0000-4000-8000-0000000000c2','label','Web'))),'organizer swaps labels');
reset role;
select is((select array_agg(o->>'id' order by n) from public.project_questions q, jsonb_array_elements(q.options) with ordinality x(o,n)
  where q.id=pg_temp.q('Many')::uuid),array[current_setting('test.a'),'c4500000-0000-4000-8000-0000000000c2'],
  'kept options never take another option''s id');
select is((select archived_options->0->>'id' from public.project_questions where id=pg_temp.q('Many')::uuid),current_setting('test.b'),
  'swapped-out option is archived');
select pg_temp.login(2);
select is(pg_temp.save_errors(jsonb_build_object(
  pg_temp.q('Short'),'hi',pg_temp.q('Pick'),current_setting('test.b'),pg_temp.q('Deck'),pg_temp.file(current_setting('test.file1')),
  pg_temp.q('Many'),jsonb_build_array(current_setting('test.b')))),'{}'::jsonb,'archived option ids are dropped like removed ones');
select ok(not (pg_temp.detail()->'project'->'answers' ? pg_temp.q('Many')),'archived option id is not stored');
select ok(not exists (select 1 from jsonb_array_elements(pg_temp.detail()->'questions') q where q ? 'archived_options'),
  'participants never receive archived options');
reset role;
update storage.objects set metadata=jsonb_build_object('size',3*1024*1024,'mimetype','application/pdf')
where bucket_id='project-files' and name=current_setting('test.file1');
select pg_temp.login(1,'oauth');
select throws_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Deck','',true,null,%L,'file',null,'{"max_size_mb":2}')$$,pg_temp.q('Deck')),
  '22023','Saved answers include files larger than 2 MB. Keep a higher limit.','limit cannot drop below saved files');
select lives_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Deck','',true,null,%L,'file',null,'{"max_size_mb":5}')$$,pg_temp.q('Deck')),
  'limit may stay above saved files');
reset role;

-- Start judging locks uploads; judges see files only through the switch.
update public.event_competition_settings set project_submissions_close_at=now()-interval '1 hour',judging_started_at=now()
where event_id='e4500000-0000-0000-0000-000000000001';
insert into public.judging_assignments(id,event_id,judge_id,project_id) values
 ('f4500000-0000-0000-0000-000000000001','e4500000-0000-0000-0000-000000000001','b4500000-0000-0000-0000-000000000001','a4500000-0000-0000-0000-000000000001');
select pg_temp.login(2);
select ok(not public.project_file_writable(pg_temp.path('c4500000-0000-4000-8000-000000000005')),'no uploads after judging starts');
select ok(not public.project_file_deletable(current_setting('test.file2')),'no deletes after judging starts');
select throws_ok(format($$insert into storage.objects(bucket_id,name) values('project-files',%L)$$,pg_temp.path('c4500000-0000-4000-8000-000000000005')),
  '42501',null,'upload denied by policy after lock');
reset role;
select pg_temp.login(1,'oauth');
select throws_ok(format($$select public.admin_save_project_question('e4500000-0000-0000-0000-000000000001','Spare','',false,100,%L)$$,pg_temp.q('Spare')),
  'P0001','Questions are locked because judging has started','question types frozen with judging');
reset role;
select pg_temp.login(5);
select is(public.judge_assignment('typed-test','f4500000-0000-0000-0000-000000000001')->'answers','[]'::jsonb,'judge sees no answers with switch off');
select ok(not public.project_file_readable(current_setting('test.file1')),'judge cannot sign files with switch off');
select is(pg_temp.signable(current_setting('test.file1')),0::bigint,'policy hides files from judge with switch off');
reset role;
update public.event_competition_settings set judges_see_answers=true where event_id='e4500000-0000-0000-0000-000000000001';
select pg_temp.login(5);
select is((select x from jsonb_array_elements(public.judge_assignment('typed-test','f4500000-0000-0000-0000-000000000001')->'answers') x
  where x->>'label'='Pick renamed'),jsonb_build_object('question_id',pg_temp.q('Pick')::uuid,'label','Pick renamed','type','single_choice',
  'options',jsonb_build_array(jsonb_build_object('id',current_setting('test.b'),'label','Mobile app')),'answer',current_setting('test.b')),
  'judge answers carry type, options, and typed value');
select is((select x->'answer' from jsonb_array_elements(public.judge_assignment('typed-test','f4500000-0000-0000-0000-000000000001')->'answers') x
  where x->>'label'='Deck'),pg_temp.file(current_setting('test.file1')),'judge receives file metadata');
select is((select x->'answer' from jsonb_array_elements(public.judge_assignment('typed-test','f4500000-0000-0000-0000-000000000001')->'answers') x
  where x->>'label'='Spare'),'null'::jsonb,'unanswered questions return null');
select ok(public.project_file_readable(current_setting('test.file1')),'judge can sign answered file with switch on');
select is(pg_temp.signable(current_setting('test.file1')),1::bigint,'policy lets judge sign answered file');
select is(pg_temp.downloadable(current_setting('test.file1')),0::bigint,'judge cannot download directly');
select ok(not public.project_file_readable(current_setting('test.file2')),'judge cannot sign unreferenced files');
select is(pg_temp.signable(current_setting('test.file2')),0::bigint,'policy hides unreferenced files from judge');
reset role;
update public.judging_assignments set cancelled=true where id='f4500000-0000-0000-0000-000000000001';
select pg_temp.login(5);
select ok(not public.project_file_readable(current_setting('test.file1')),'cancelled assignment loses file access');
reset role;
select pg_temp.login(1,'oauth');
select is((select x->>'type' from jsonb_array_elements(public.admin_submitted_project_detail('e4500000-0000-0000-0000-000000000001','a4500000-0000-0000-0000-000000000001')->'answers') x
  where x->>'label'='Deck'),'file','organizer detail includes answer types');
reset role;
select * from finish(true);
rollback;
