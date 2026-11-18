begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer,p_method text default 'otp') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','d4700000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','team-'||n||'@example.test','amr',json_build_array(json_build_object('method',p_method)))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.uid(n integer) returns uuid language sql as $$
  select ('d4700000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.p1() returns uuid language sql as $$ select current_setting('test.p1')::uuid $$;
create function pg_temp.p2() returns uuid language sql as $$ select current_setting('test.p2')::uuid $$;
create function pg_temp.detail() returns jsonb language sql as $$
  select public.participant_project_detail(pg_temp.p1(),'e4700000-0000-0000-0000-000000000001');
$$;
create function pg_temp.save(p_submit boolean default false) returns timestamptz language sql as $$
  select public.participant_save_project(pg_temp.p1(),
    '{"name":"Team project"}'::jsonb,
    null,'{}',p_submit,(pg_temp.detail()->'project'->>'updated_at')::timestamptz);
$$;
create function pg_temp.add(p_project uuid,n integer) returns void language sql as $$
  select public.participant_add_project_collaborator(p_project,'team-'||n||'@example.test');
$$;
create function pg_temp.judge(p_assignment text) returns jsonb language sql as $$
  select public.judge_assignment('team-test',('f4700000-0000-0000-0000-00000000000'||p_assignment)::uuid);
$$;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select pg_temp.uid(n),'team-'||n||'@example.test',now(),jsonb_build_object('full_name','Team '||n)
from generate_series(1,11)n;
insert into public.admin_allowlist(email,level) values('team-9@example.test','organizer');
insert into public.events(id,slug,name) values
 ('e4700000-0000-0000-0000-000000000001','team-test','Teams'),
 ('e4700000-0000-0000-0000-000000000002','team-other','Other');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,judging_close_at)
select id,true,now()-interval '1 day',now()+interval '4 days' from public.events where slug like 'team-%';
insert into public.forms(id,event_id,role,title) values
 ('f4700000-0000-0000-0000-000000000091','e4700000-0000-0000-0000-000000000001','participant','Test'),
 ('f4700000-0000-0000-0000-000000000092','e4700000-0000-0000-0000-000000000002','participant','Other');
insert into public.applications(id,user_id,event_id,role,form_id,status,submitted_at)
select ('a4700000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,pg_temp.uid(n),
  case when n=8 then 'e4700000-0000-0000-0000-000000000002'::uuid else 'e4700000-0000-0000-0000-000000000001'::uuid end,
  'participant',case when n=8 then 'f4700000-0000-0000-0000-000000000092'::uuid else 'f4700000-0000-0000-0000-000000000091'::uuid end,
  'submitted',now()
from generate_series(1,8)n;
insert into public.application_decisions(application_id,decision)
select id,case when user_id=pg_temp.uid(7) then 'rejected'::public.decision else 'accepted'::public.decision end
from public.applications where user_id in (select pg_temp.uid(n) from generate_series(1,8)n);
insert into public.project_questions(id,event_id,position,label,type,max_length)
values('c4700000-0000-0000-0000-000000000001','e4700000-0000-0000-0000-000000000001',1,'Deck','file',null);

select plan(44);

-- Any member edits, submits, and adds; only the owner removes.
select pg_temp.login(1);
select set_config('test.p1',public.participant_create_project('e4700000-0000-0000-0000-000000000001')::text,true);
select lives_ok($$select pg_temp.add(pg_temp.p1(),2)$$,'owner adds a teammate');
reset role;
select pg_temp.login(2);
select lives_ok($$select pg_temp.add(pg_temp.p1(),3)$$,'collaborator adds a teammate');
reset role;
select pg_temp.login(3);
select is(pg_temp.detail()->'owner',jsonb_build_object('user_id',pg_temp.uid(1),'full_name','Team 1'),'detail includes the owner');
select is(jsonb_array_length(pg_temp.detail()->'collaborators'),2,'detail lists collaborators');
select is(pg_temp.detail()->'max_team_size','null'::jsonb,'no team size limit by default');
reset role;
select pg_temp.login(2);
select lives_ok($$select pg_temp.save()$$,'collaborator edits content');
select throws_ok($$select public.participant_save_project(pg_temp.p1(),'{}',null,'{}',false,'2000-01-01')$$,'PT409','This project changed. Reload before saving again.','stale member save rejected');
select lives_ok($$select pg_temp.save(true)$$,'collaborator submits');
select is(pg_temp.detail()->'project'->>'status','submitted','submission recorded');
select throws_ok($$select public.participant_remove_project_collaborator(pg_temp.p1(),pg_temp.uid(3))$$,'42501','Only the project owner can remove teammates','collaborator cannot remove teammates');
select throws_ok($$select public.participant_withdraw_project(pg_temp.p1())$$,'42501','Only the project owner can withdraw the project','collaborator cannot withdraw');
reset role;

-- Leaving.
select pg_temp.login(1);
select throws_ok($$select public.participant_leave_project(pg_temp.p1())$$,'P0001','The project owner cannot leave the team','owner cannot leave');
reset role;
select pg_temp.login(3);
select lives_ok($$select public.participant_leave_project(pg_temp.p1())$$,'collaborator leaves');
select is(pg_temp.detail(),null::jsonb,'leaving removes access');
reset role;
select pg_temp.login(5);
select throws_ok($$select public.participant_leave_project(pg_temp.p1())$$,'PT404','Project not found','outsider cannot leave');
reset role;

-- One team per event.
select pg_temp.login(4);
select set_config('test.p2',public.participant_create_project('e4700000-0000-0000-0000-000000000001')::text,true);
select throws_ok($$select pg_temp.add(pg_temp.p2(),2)$$,'P0001','This participant is already on a team for this event','collaborator on another team cannot be added');
reset role;
select pg_temp.login(1);
select throws_ok($$select pg_temp.add(pg_temp.p1(),4)$$,'P0001','This participant is already on a team for this event','owner of another team cannot be added');
select throws_ok($$select pg_temp.add(pg_temp.p1(),2)$$,'P0001','This participant is already on a team for this event','existing teammate cannot be added again');
select throws_ok($$select public.participant_create_project('e4700000-0000-0000-0000-000000000001')$$,'P0001','You are already on a team for this event','owner cannot create a second project');
reset role;
select pg_temp.login(2);
select throws_ok($$select public.participant_create_project('e4700000-0000-0000-0000-000000000001')$$,'P0001','You are already on a team for this event','collaborator cannot create a project');
reset role;
insert into public.project_collaborators(project_id,event_id,user_id) values(pg_temp.p2(),'e4700000-0000-0000-0000-000000000001',pg_temp.uid(7));
select pg_temp.login(1);
select throws_ok($$select pg_temp.add(pg_temp.p1(),7)$$,'P0001','Cannot add this collaborator. Use the email of an eligible registered participant.','ineligible teammate gets the generic error');
select throws_ok($$select pg_temp.add(pg_temp.p1(),8)$$,'P0001','Cannot add this collaborator. Use the email of an eligible registered participant.','participant of another event gets the generic error');
reset role;

-- Team size limit counts the owner.
select pg_temp.login(1);
select throws_ok($$select public.admin_set_max_team_size('e4700000-0000-0000-0000-000000000001',3)$$,'42501',null,'participant cannot set the limit');
reset role;
select pg_temp.login(9,'oauth');
select throws_ok($$select public.admin_set_max_team_size('e4700000-0000-0000-0000-000000000001',1)$$,'P0001','A team already has 2 members. Choose a limit of at least 2.','limit cannot drop below a current team');
select throws_ok($$select public.admin_set_max_team_size('e4700000-0000-0000-0000-000000000001',0)$$,'22023','Team size limit must be at least 1','limit must be positive');
select lives_ok($$select public.admin_set_max_team_size('e4700000-0000-0000-0000-000000000001',2)$$,'limit may equal the largest team');
reset role;
select pg_temp.login(1);
select is(pg_temp.detail()->'max_team_size','2'::jsonb,'members see the limit');
select throws_ok($$select pg_temp.add(pg_temp.p1(),3)$$,'P0001','This team is full. Teams can have at most 2 members.','full team rejects additions');
reset role;
select pg_temp.login(9,'oauth');
select lives_ok($$select public.admin_set_max_team_size('e4700000-0000-0000-0000-000000000001',null)$$,'limit can be removed');
reset role;

-- Withdrawn projects no longer count as teams.
select pg_temp.login(4);
select lives_ok($$select public.participant_withdraw_project(pg_temp.p2())$$,'owner withdraws');
reset role;
select pg_temp.login(1);
select lives_ok($$select pg_temp.add(pg_temp.p1(),4)$$,'member of a withdrawn project can join another team');
reset role;

-- Member file uploads.
select set_config('test.file','{p1}/c4700000-0000-0000-0000-000000000001/c4700000-0000-4000-8000-000000000001.pdf',true);
select set_config('test.file',replace(current_setting('test.file'),'{p1}',pg_temp.p1()::text),true);
select pg_temp.login(4);
select ok(public.project_file_writable(current_setting('test.file')),'collaborator may upload');
reset role;
select pg_temp.login(5);
select ok(not public.project_file_writable(current_setting('test.file')),'outsider cannot upload');
reset role;

-- Migration guard reports existing violations.
alter table public.projects disable trigger projects_one_team;
insert into public.projects(event_id,owner_user_id) values
 ('e4700000-0000-0000-0000-000000000001',pg_temp.uid(5)),('e4700000-0000-0000-0000-000000000001',pg_temp.uid(5));
alter table public.projects enable trigger projects_one_team;
select throws_ok($$select public.assert_one_team_per_event()$$,'P0001',
  format('Users belong to more than one team in an event: event %s user %s','e4700000-0000-0000-0000-000000000001',pg_temp.uid(5)),
  'violations are listed by event and user');
delete from public.projects where owner_user_id=pg_temp.uid(5);
select lives_ok($$select public.assert_one_team_per_event()$$,'no violations once resolved');

-- Judges see names only with the switch on; team members are never their judges.
update public.profiles set full_name=null where id=pg_temp.uid(4);
update public.event_competition_settings set project_submissions_close_at=now()-interval '1 hour',judging_started_at=now()
where event_id='e4700000-0000-0000-0000-000000000001';
insert into public.event_judges(id,event_id,email,user_id) values
 ('b4700000-0000-0000-0000-000000000001','e4700000-0000-0000-0000-000000000001','team-10@example.test',pg_temp.uid(10)),
 ('b4700000-0000-0000-0000-000000000002','e4700000-0000-0000-0000-000000000001','team-4@example.test',pg_temp.uid(4)),
 ('b4700000-0000-0000-0000-000000000003','e4700000-0000-0000-0000-000000000001','team-11@example.test',pg_temp.uid(11));
select ok(exists (select 1 from public.assignment_candidates('e4700000-0000-0000-0000-000000000001',pg_temp.p1(),null) where judge_id='b4700000-0000-0000-0000-000000000003'),'unrelated judge is a candidate');
select ok(not exists (select 1 from public.assignment_candidates('e4700000-0000-0000-0000-000000000001',pg_temp.p1(),null) where judge_id='b4700000-0000-0000-0000-000000000002'),'teammate judge is never a candidate');
insert into public.judging_assignments(id,event_id,judge_id,project_id) values
 ('f4700000-0000-0000-0000-000000000001','e4700000-0000-0000-0000-000000000001','b4700000-0000-0000-0000-000000000001',pg_temp.p1()),
 ('f4700000-0000-0000-0000-000000000002','e4700000-0000-0000-0000-000000000001','b4700000-0000-0000-0000-000000000002',pg_temp.p1());
select pg_temp.login(10);
select is(pg_temp.judge('1')->'team','[]'::jsonb,'judge sees no team by default');
reset role;
select pg_temp.login(1);
select throws_ok($$select public.admin_set_judges_see_team('e4700000-0000-0000-0000-000000000001',true)$$,'42501',null,'participant cannot change team visibility');
reset role;
select pg_temp.login(9,'oauth');
select lives_ok($$select public.admin_set_judges_see_team('e4700000-0000-0000-0000-000000000001',true)$$,'organizer shows teams during judging');
reset role;
select pg_temp.login(10);
select is(pg_temp.judge('1')->'team','["Team 1","Team 2",null]'::jsonb,'judge sees owner first, then teammates, names only');
reset role;
select pg_temp.login(4);
select is(pg_temp.judge('2'),null::jsonb,'teammate judge cannot open the team project');
reset role;
select pg_temp.login(9,'oauth');
select lives_ok($$select public.admin_set_judges_see_team('e4700000-0000-0000-0000-000000000001',false)$$,'organizer hides teams again');
reset role;
select pg_temp.login(10);
select is(pg_temp.judge('1')->'team','[]'::jsonb,'judge loses team names when switched off');
reset role;
select * from finish(true);
rollback;
