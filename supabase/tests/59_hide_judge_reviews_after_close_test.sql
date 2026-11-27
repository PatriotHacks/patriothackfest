begin;
create extension if not exists pgtap with schema extensions;
-- 1 organizer, 2 general judge, 3 guest judge, 4 owner, 9 project owner
create function pg_temp.login(n integer,method text default 'otp') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object(
    'sub','d5900000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','closed-'||n||'@example.test',
    'amr',json_build_array(json_build_object('method',method)),
    'app_metadata',json_build_object('provider',case when method='oauth' then 'google' else 'email' end))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.close_judging(p_at timestamptz) returns void language sql as $$
  update public.event_competition_settings set judging_close_at=p_at
  where event_id='e5900000-0000-4000-8000-000000000001';
$$;

insert into auth.users(id,email,email_confirmed_at)
select ('d5900000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'closed-'||n||'@example.test',now() from generate_series(1,9)n;
insert into public.admin_allowlist(email,level) values('closed-1@example.test','organizer'),('closed-4@example.test','owner');
insert into public.events(id,slug,name) values('e5900000-0000-4000-8000-000000000001','closed','Closed');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,project_submissions_close_at,
  judging_close_at,judges_see_answers)
values('e5900000-0000-4000-8000-000000000001',true,now()-interval '3 days',now()-interval '2 days',now()+interval '1 day',true);
insert into public.judging_criteria(id,event_id,position,name)
values('c5900000-0000-4000-8000-000000000001','e5900000-0000-4000-8000-000000000001',1,'Impact');
insert into public.project_questions(id,event_id,position,label,type)
values('c5900000-0000-4000-8000-000000000002','e5900000-0000-4000-8000-000000000001',1,'Deck','file');
select set_config('test.file','a5900000-0000-4000-8000-000000000001/c5900000-0000-4000-8000-000000000002/c5900000-0000-4000-8000-000000000003.pdf',true);
alter table public.projects disable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at,answers)
values('a5900000-0000-4000-8000-000000000001','e5900000-0000-4000-8000-000000000001','d5900000-0000-0000-0000-000000000009',
  'Project 1','submitted',now(),jsonb_build_object('c5900000-0000-4000-8000-000000000002',
    jsonb_build_object('path',current_setting('test.file'),'name','deck.pdf','size',1000,'type','application/pdf')));
alter table public.projects enable trigger projects_one_team;
insert into public.event_judges(id,event_id,email,user_id,guest)
select ('b5900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'e5900000-0000-4000-8000-000000000001',
  'closed-'||n||'@example.test',('d5900000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,n=3 from generate_series(2,3)n;
update public.event_competition_settings set judging_started_at=now()-interval '1 hour'
where event_id='e5900000-0000-4000-8000-000000000001';
insert into public.judging_assignments(id,event_id,judge_id,project_id,notes,submitted_at)
values('f5900000-0000-4000-8000-000000000001','e5900000-0000-4000-8000-000000000001',
  'b5900000-0000-4000-8000-000000000002','a5900000-0000-4000-8000-000000000001','Strong demo',now());
insert into public.judging_scores(assignment_id,criterion_id,event_id,score)
values('f5900000-0000-4000-8000-000000000001','c5900000-0000-4000-8000-000000000001','e5900000-0000-4000-8000-000000000001',4);
select set_config('test.cert','e5900000-0000-4000-8000-000000000001/certificates/b5900000-0000-4000-8000-000000000002/c5900000-0000-4000-8000-000000000004.pdf',true);

select plan(30);

-- Before close judges read their work.
select pg_temp.login(2);
select is(public.judge_queue('closed')->>'total','1','judge sees the queue before close');
select is(public.judge_assignment('closed','f5900000-0000-4000-8000-000000000001')->'assignment'->>'notes','Strong demo',
  'judge sees notes before close');
select is(public.judge_assignment('closed','f5900000-0000-4000-8000-000000000001')->'assignment'->'scores',
  '{"c5900000-0000-4000-8000-000000000001": 4.0}'::jsonb,'judge sees scores before close');
select is(jsonb_array_length(public.judge_criteria('closed')),1,'judge sees the rubric before close');
select ok(public.project_file_readable(current_setting('test.file')),'judge can sign assigned project files before close');
reset role;

select pg_temp.login(3);
select is(jsonb_array_length(public.judge_guest_projects('closed')),1,'guest sees projects before close');
select is(public.judge_guest_project('closed','a5900000-0000-4000-8000-000000000001')->'project'->>'name','Project 1',
  'guest sees project details before close');
reset role;

select pg_temp.close_judging(now()-interval '1 minute');
select pg_temp.login(1,'oauth');
insert into storage.objects(bucket_id,name,metadata)
values('judge-documents',current_setting('test.cert'),jsonb_build_object('size',1000,'mimetype','application/pdf'));
select public.admin_set_judge_certificate('e5900000-0000-4000-8000-000000000001',
  'b5900000-0000-4000-8000-000000000002',current_setting('test.cert'));
reset role;

-- After close judges see nothing but their event summary and documents.
select pg_temp.login(2);
select is(public.judge_queue('closed'),null,'no queue after close');
select is(public.judge_assignment('closed','f5900000-0000-4000-8000-000000000001'),null,'no scores or notes after close');
select is(public.judge_criteria('closed'),null,'no rubric after close');
select ok(not public.project_file_readable(current_setting('test.file')),'no project files after close');
select throws_ok($$select public.judge_save_review('closed','f5900000-0000-4000-8000-000000000001','{}','',false)$$,
  'PT410',null,'no saves after close');
select is(public.judge_documents('closed'),jsonb_build_object('certificate_path',current_setting('test.cert'),
  'invitation_letter_path',null),'documents still listed after close');
select is((public.judge_event_access('closed')->>'judging_close_at')::timestamptz,
  (select judging_close_at from public.event_competition_settings where event_id='e5900000-0000-4000-8000-000000000001'),
  'event summary still available after close');
select is(jsonb_array_length(public.judge_events()),1,'event list still available after close');
reset role;

select pg_temp.login(3);
select is(public.judge_guest_projects('closed'),null,'no guest projects after close');
select is(public.judge_guest_project('closed','a5900000-0000-4000-8000-000000000001'),null,'no guest project details after close');
select is(public.judge_documents('closed'),jsonb_build_object('certificate_path',null,'invitation_letter_path',null),
  'guest documents still readable after close');
reset role;

-- Organizer reads are unaffected.
select pg_temp.login(1,'oauth');
select is(public.admin_judge_progress('e5900000-0000-4000-8000-000000000001')->0->>'completed','1',
  'organizer sees judge progress after close');
select is(jsonb_array_length(public.admin_judging_criteria('e5900000-0000-4000-8000-000000000001')),1,
  'organizer sees criteria after close');
select is(public.admin_assignment_overview('e5900000-0000-4000-8000-000000000001')->'assignments'->0->>'status','submitted',
  'organizer sees assignments after close');
select ok(public.project_file_readable(current_setting('test.file')),'organizer can sign project files after close');
select is(jsonb_array_length(public.admin_project_detail('e5900000-0000-4000-8000-000000000001',
  'a5900000-0000-4000-8000-000000000001')->'answers'),1,'organizer sees project review details after close');
select is(jsonb_array_length(public.admin_submitted_project_detail('e5900000-0000-4000-8000-000000000001',
  'a5900000-0000-4000-8000-000000000001')->'answers'),1,'organizer sees submitted project details after close');
select is(jsonb_array_length(public.admin_judge_roster('e5900000-0000-4000-8000-000000000001')),2,
  'organizer sees the judge roster after close');
reset role;

select pg_temp.login(4,'oauth');
select is(public.admin_judging_results('e5900000-0000-4000-8000-000000000001')->'projects'->0->>'completed','1',
  'owner sees completed reviews in results after close');
select is((public.admin_judging_results('e5900000-0000-4000-8000-000000000001')->'projects'->0->>'average_score')::numeric,4.0,
  'owner sees scores in results after close');
reset role;

-- An extension restores access.
select pg_temp.close_judging(now()+interval '1 day');
select pg_temp.login(2);
select is(public.judge_queue('closed')->>'total','1','queue returns after an extension');
select is(public.judge_assignment('closed','f5900000-0000-4000-8000-000000000001')->'assignment'->>'notes','Strong demo',
  'notes return after an extension');
reset role;
select pg_temp.login(3);
select is(jsonb_array_length(public.judge_guest_projects('closed')),1,'guest projects return after an extension');
reset role;

select * from finish();
rollback;
