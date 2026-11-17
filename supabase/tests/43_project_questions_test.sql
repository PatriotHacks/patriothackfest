begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer,p_method text) returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','d4300000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','questions-'||n||'@example.test','amr',json_build_array(json_build_object('method',p_method)))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.detail() returns jsonb language sql as $$
  select public.participant_project_detail('a4300000-0000-0000-0000-000000000001','e4300000-0000-0000-0000-000000000001');
$$;
create function pg_temp.save(p_answers jsonb,p_submit boolean default false) returns timestamptz language sql as $$
  select public.participant_save_project('a4300000-0000-0000-0000-000000000001',
    '{"name":"Demo","summary":"Summary","description":"Description","demo_url":"https://example.com"}'::jsonb,
    p_answers,'{}',p_submit,(pg_temp.detail()->'project'->>'updated_at')::timestamptz);
$$;
create function pg_temp.save_errors(p_answers jsonb,p_submit boolean default false) returns jsonb language plpgsql as $$
declare v_detail text;
begin
  perform pg_temp.save(p_answers,p_submit);
  return '{}'::jsonb;
exception when sqlstate 'PT422' then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail::jsonb;
end;
$$;
create function pg_temp.question(n integer) returns text language sql as $$
  select current_setting('test.q'||n);
$$;
create function pg_temp.remember_questions() returns void language sql as $$
  select set_config('test.q'||substr(label,10),id::text,true) from public.project_questions
  where event_id='e4300000-0000-0000-0000-000000000001';
$$;
create function pg_temp.judge() returns jsonb language sql as $$
  select public.judge_assignment('questions-test','f4300000-0000-0000-0000-000000000001');
$$;
create function pg_temp.admin_detail() returns jsonb language sql as $$
  select public.admin_submitted_project_detail('e4300000-0000-0000-0000-000000000001','a4300000-0000-0000-0000-000000000001');
$$;

insert into auth.users(id,email,email_confirmed_at)
select ('d4300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'questions-'||n||'@example.test',now() from generate_series(1,4)n;
insert into public.admin_allowlist(email,level) values
 ('questions-1@example.test','organizer'),('questions-2@example.test','reviewer');
insert into public.events(id,slug,name) values
 ('e4300000-0000-0000-0000-000000000001','questions-test','Questions'),
 ('e4300000-0000-0000-0000-000000000002','questions-other','Other');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,judging_close_at)
select id,true,now()-interval '2 days',now()+interval '4 days' from public.events where slug like 'questions-%';
insert into public.forms(id,event_id,role,title) values('f4300000-0000-0000-0000-000000000009','e4300000-0000-0000-0000-000000000001','participant','Test');
insert into public.applications(id,user_id,event_id,role,form_id,status,submitted_at) values
 ('a4300000-0000-0000-0000-000000000009','d4300000-0000-0000-0000-000000000003','e4300000-0000-0000-0000-000000000001','participant','f4300000-0000-0000-0000-000000000009','submitted',now());
insert into public.application_decisions(application_id,decision) values('a4300000-0000-0000-0000-000000000009','accepted');
insert into public.projects(id,event_id,owner_user_id) values
 ('a4300000-0000-0000-0000-000000000001','e4300000-0000-0000-0000-000000000001','d4300000-0000-0000-0000-000000000003');
insert into public.event_judges(id,event_id,email,user_id) values
 ('b4300000-0000-0000-0000-000000000001','e4300000-0000-0000-0000-000000000001','questions-4@example.test','d4300000-0000-0000-0000-000000000004');

select plan(51);

-- Organizer-only question management.
select pg_temp.login(2,'oauth');
select throws_ok($$select public.admin_save_project_question('e4300000-0000-0000-0000-000000000001','Question 1','',false,100)$$,'42501',null,'reviewer cannot create questions');
select throws_ok($$select public.admin_project_questions('e4300000-0000-0000-0000-000000000001')$$,'42501',null,'reviewer cannot list questions');
select throws_ok($$select public.admin_set_judges_see_answers('e4300000-0000-0000-0000-000000000001',true)$$,'42501',null,'reviewer cannot change judge visibility');
reset role;
select pg_temp.login(3,'otp');
select throws_ok($$select public.admin_save_project_question('e4300000-0000-0000-0000-000000000001','Question 1','',false,100)$$,'42501',null,'participant cannot create questions');
select throws_ok($$select public.admin_set_judges_see_answers('e4300000-0000-0000-0000-000000000001',true)$$,'42501',null,'participant cannot change judge visibility');
select throws_ok($$select * from public.project_questions$$,'42501',null,'no direct question table reads');
reset role;
set local role anon;
select throws_ok($$select public.admin_project_questions('e4300000-0000-0000-0000-000000000001')$$,'42501',null,'anonymous cannot list questions');
reset role;
select pg_temp.login(1,'oauth');
select lives_ok($$select public.admin_save_project_question('e4300000-0000-0000-0000-000000000001',' Question 1 ',' Help ',false,100)$$,'organizer creates question');
select lives_ok($$select public.admin_save_project_question('e4300000-0000-0000-0000-000000000001','Question 2','',true,10)$$,'organizer creates required question');
select lives_ok($$select public.admin_save_project_question('e4300000-0000-0000-0000-000000000001','Question 3',null,false,100)$$,'organizer creates optional question');
select is((select array_agg(label order by position) from public.admin_project_questions('e4300000-0000-0000-0000-000000000001')),
  array['Question 1','Question 2','Question 3'],'questions appended in order and label trimmed');
select is((select help_text from public.admin_project_questions('e4300000-0000-0000-0000-000000000001') where label='Question 1'),'Help','help text trimmed');
select is((select help_text from public.admin_project_questions('e4300000-0000-0000-0000-000000000001') where label='Question 2'),null,'blank help text stored as null');
reset role;
select pg_temp.remember_questions();
select pg_temp.login(1,'oauth');
select throws_ok($$select public.admin_save_project_question('e4300000-0000-0000-0000-000000000001','Too long','',false,10001)$$,'23514',null,'max length bounded');
select throws_ok($$select public.admin_save_project_question('e4300000-0000-0000-0000-000000000002','Moved','',false,10,pg_temp.question(1)::uuid)$$,'P0001','Question not found for this event','cannot edit another event''s question');
select throws_ok(format($$select public.admin_reorder_project_questions('e4300000-0000-0000-0000-000000000001',array[%L,%L]::uuid[])$$,pg_temp.question(1),pg_temp.question(2)),
  'P0001','Question order must list every active question exactly once','reorder requires every active question');
select lives_ok(format($$select public.admin_reorder_project_questions('e4300000-0000-0000-0000-000000000001',array[%L,%L,%L]::uuid[])$$,pg_temp.question(2),pg_temp.question(1),pg_temp.question(3)),'organizer reorders questions');
select is((select array_agg(label order by position) from public.admin_project_questions('e4300000-0000-0000-0000-000000000001')),
  array['Question 2','Question 1','Question 3'],'new order persisted');
reset role;

-- Participant answers.
select pg_temp.login(3,'otp');
select is((select array_agg(q->>'label' order by n) from jsonb_array_elements(pg_temp.detail()->'questions') with ordinality x(q,n)),
  array['Question 2','Question 1','Question 3'],'participant sees active questions in order');
select ok(pg_temp.detail()->'questions'->0 ?& array['id','label','help_text','required','max_length'],'question metadata returned');
select is(pg_temp.save_errors('{"a4300000-0000-0000-0000-00000000ffff":"x"}')->>'form','The project questions changed. Reload the page before saving.','unknown question rejected');
select is(pg_temp.save_errors('[]')->>'form','Invalid question answers','answers must be an object');
select is(pg_temp.save_errors(jsonb_build_object(pg_temp.question(2),repeat('x',11)))->>('answers.'||pg_temp.question(2)),'Use 10 characters or fewer','answer length limited per question');
select is(pg_temp.save_errors(jsonb_build_object(pg_temp.question(1),42))->>('answers.'||pg_temp.question(1)),'Enter text','answers must be text');
select is(pg_temp.save_errors('{}',true)->>('answers.'||pg_temp.question(2)),'This question is required','required question enforced on submit');
select is(pg_temp.save_errors(jsonb_build_object(pg_temp.question(2),'   '),true)->>('answers.'||pg_temp.question(2)),'This question is required','blank answer does not satisfy required');
select is(pg_temp.save_errors('{}'),'{}'::jsonb,'draft may leave required question blank');
select is(pg_temp.save_errors(jsonb_build_object(pg_temp.question(2),' Short ',pg_temp.question(1),' Long answer ',pg_temp.question(3),' '),true),'{}'::jsonb,'complete answers submit');
select is(pg_temp.detail()->'project'->'answers',jsonb_build_object(pg_temp.question(2),'Short',pg_temp.question(1),'Long answer'),'answers trimmed and blanks omitted');
select lives_ok($$select public.participant_save_project(p_project_id=>'a4300000-0000-0000-0000-000000000001'::uuid,
  p_content=>'{"name":"Demo","summary":"Summary","description":"Description","demo_url":"https://example.com"}'::jsonb,
  p_expected_updated_at=>(pg_temp.detail()->'project'->>'updated_at')::timestamptz)$$,'save without answers argument still works');
select is(pg_temp.detail()->'project'->'answers',jsonb_build_object(pg_temp.question(2),'Short',pg_temp.question(1),'Long answer'),'omitted answers keep stored answers');
select is(pg_temp.detail()->'project'->>'status','submitted','project submitted');
reset role;

-- A late required question does not unsubmit existing projects.
select pg_temp.login(1,'oauth');
select lives_ok($$select public.admin_save_project_question('e4300000-0000-0000-0000-000000000001','Question 4','',true,100)$$,'organizer adds late required question');
reset role;
select pg_temp.remember_questions();
select is((select status from public.projects where id='a4300000-0000-0000-0000-000000000001'),'submitted','late required question keeps project submitted');
select pg_temp.login(3,'otp');
select is(pg_temp.save_errors(jsonb_build_object(pg_temp.question(2),'Short'))->>('answers.'||pg_temp.question(4)),'This question is required','late required question applies on next save');
select is(pg_temp.save_errors(jsonb_build_object(pg_temp.question(2),'Short',pg_temp.question(1),'Long answer',pg_temp.question(4),'Late')),'{}'::jsonb,'answering late question saves');
reset role;
select pg_temp.login(1,'oauth');
select lives_ok(format($$select public.admin_archive_project_question('e4300000-0000-0000-0000-000000000001',%L)$$,pg_temp.question(3)),'organizer archives question');
reset role;
select pg_temp.login(3,'otp');
select is(jsonb_array_length(pg_temp.detail()->'questions'),3,'archived question hidden from participants');
select is(pg_temp.save_errors(jsonb_build_object(pg_temp.question(3),'x'))->>'form','The project questions changed. Reload the page before saving.','archived question cannot be answered');
reset role;

-- Start judging freezes questions but not judge visibility.
update public.event_competition_settings set project_submissions_close_at=now()-interval '1 hour',judging_started_at=now()
where event_id='e4300000-0000-0000-0000-000000000001';
insert into public.judging_assignments(id,event_id,judge_id,project_id) values
 ('f4300000-0000-0000-0000-000000000001','e4300000-0000-0000-0000-000000000001','b4300000-0000-0000-0000-000000000001','a4300000-0000-0000-0000-000000000001');
select pg_temp.login(1,'oauth');
select throws_ok($$select public.admin_save_project_question('e4300000-0000-0000-0000-000000000001','Question 5','',false,100)$$,'P0001','Questions are locked because judging has started','cannot add questions after judging starts');
select throws_ok(format($$select public.admin_archive_project_question('e4300000-0000-0000-0000-000000000001',%L)$$,pg_temp.question(1)),'P0001','Questions are locked because judging has started','cannot archive after judging starts');
select throws_ok(format($$select public.admin_reorder_project_questions('e4300000-0000-0000-0000-000000000001',array[%L,%L,%L]::uuid[])$$,pg_temp.question(1),pg_temp.question(2),pg_temp.question(4)),
  'P0001','Questions are locked because judging has started','cannot reorder after judging starts');
reset role;
select throws_ok($$update public.project_questions set label='Changed' where event_id='e4300000-0000-0000-0000-000000000001'$$,'P0001','Project content and tracks are locked after judging starts','trigger freezes direct question edits');
select throws_ok($$update public.projects set answers='{}' where id='a4300000-0000-0000-0000-000000000001'$$,'P0001','Project content and tracks are locked after judging starts','trigger freezes answers');

-- Judges see answers only when enabled; organizers always do.
select pg_temp.login(4,'otp');
select is(pg_temp.judge()->'answers','[]'::jsonb,'judge sees no answers by default');
reset role;
update public.event_competition_settings set judging_close_at=now()-interval '1 minute' where event_id='e4300000-0000-0000-0000-000000000001';
select pg_temp.login(1,'oauth');
select lives_ok($$select public.admin_set_judges_see_answers('e4300000-0000-0000-0000-000000000001',true)$$,'switch editable after judging starts and ends');
reset role;
select pg_temp.login(4,'otp');
select is((select jsonb_agg(x-'question_id'-'type'-'options' order by n) from jsonb_array_elements(pg_temp.judge()->'answers') with ordinality a(x,n)),jsonb_build_array(
  jsonb_build_object('label','Question 2','answer','Short'),
  jsonb_build_object('label','Question 1','answer','Long answer'),
  jsonb_build_object('label','Question 4','answer','Late')),'judge sees active answers in order when enabled');
reset role;
select pg_temp.login(1,'oauth');
select lives_ok($$select public.admin_set_judges_see_answers('e4300000-0000-0000-0000-000000000001',false)$$,'switch can be turned off again');
select is(jsonb_array_length(pg_temp.admin_detail()->'answers'),3,'organizer sees answers with switch off');
select is(pg_temp.admin_detail()->'answers'->0->>'label','Question 2','organizer answers labeled and ordered');
reset role;
select pg_temp.login(4,'otp');
select is(pg_temp.judge()->'answers','[]'::jsonb,'judge loses answers when switched off');
reset role;
select * from finish(true);
rollback;
