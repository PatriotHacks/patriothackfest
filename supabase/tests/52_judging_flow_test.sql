begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,email_confirmed_at)
select ('d5200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'flow-'||n||'@example.test',now() from generate_series(1,8)n;
insert into public.admin_allowlist(email,level) values('flow-1@example.test','owner'),('flow-2@example.test','reviewer');
insert into public.events(id,slug,name) values
 ('e5200000-0000-0000-0000-000000000001','flow','Flow'),
 ('e5200000-0000-0000-0000-000000000002','flow-other','Flow other');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,project_submissions_close_at,judging_close_at,general_reviews_per_project)
select id,true,now()-interval '3 days',now()-interval '2 days',now()+interval '1 day',2 from public.events where slug like 'flow%';
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at)
select ('a5200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'e5200000-0000-0000-0000-000000000001',
 ('d5200000-0000-0000-0000-'||lpad((n+4)::text,12,'0'))::uuid,'Project '||n,'submitted',now() from generate_series(1,3)n;
insert into public.event_judges(id,event_id,email,user_id)
select ('b5200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'e5200000-0000-0000-0000-000000000001',
 'flow-'||n||'@example.test',('d5200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid from generate_series(3,4)n;
create function pg_temp.login(n integer,method text default 'otp') returns void language sql as $$
 select set_config('request.jwt.claims',json_build_object('sub','d5200000-0000-0000-0000-'||lpad(n::text,12,'0'),
  'email','flow-'||n||'@example.test','amr',json_build_array(json_build_object('method',method)))::text,true);
 select set_config('role','authenticated',true);
$$;
create function pg_temp.add(name text) returns uuid language sql as $$
 select public.admin_save_judging_criterion('e5200000-0000-0000-0000-000000000001',name,'Description of '||name);
$$;
create function pg_temp.names() returns text language sql as $$
 select string_agg(c->>'name',',') from jsonb_array_elements(public.admin_judging_criteria('e5200000-0000-0000-0000-000000000001')) c;
$$;
select no_plan();

-- Rubric editing and privacy.
select pg_temp.login(1,'oauth');
select set_config('test.a',pg_temp.add('Criterion A')::text,true);
select set_config('test.b',pg_temp.add('Criterion B')::text,true);
select set_config('test.c',pg_temp.add('Criterion C')::text,true);
select is(pg_temp.names(),'Criterion A,Criterion B,Criterion C','criteria listed in creation order');
select is(public.admin_judging_criteria('e5200000-0000-0000-0000-000000000001')->0->>'description','Description of Criterion A','description returned');
select lives_ok($$select public.admin_save_judging_criterion('e5200000-0000-0000-0000-000000000001','  Criterion A2 ','',current_setting('test.a')::uuid)$$,'criterion edited');
select is(public.admin_judging_criteria('e5200000-0000-0000-0000-000000000001')->0,
 jsonb_build_object('id',current_setting('test.a'),'name','Criterion A2','description',''),'edit trims name and clears description');
select throws_ok($$select pg_temp.add('   ')$$,'23514',null,'blank name rejected');
select throws_ok($$select public.admin_save_judging_criterion('e5200000-0000-0000-0000-000000000002','X','',current_setting('test.a')::uuid)$$,'P0001','Criterion not found for this event','cannot edit across events');
select lives_ok($$select public.admin_reorder_judging_criteria('e5200000-0000-0000-0000-000000000001',array[current_setting('test.c'),current_setting('test.a'),current_setting('test.b')]::uuid[])$$,'criteria reordered');
select is(pg_temp.names(),'Criterion C,Criterion A2,Criterion B','new order persisted');
select throws_ok($$select public.admin_reorder_judging_criteria('e5200000-0000-0000-0000-000000000001',array[current_setting('test.c')]::uuid[])$$,'P0001','Criteria order must list every criterion exactly once','partial order rejected');
select set_config('test.d',pg_temp.add('Criterion D')::text,true);
select lives_ok($$select public.admin_delete_judging_criterion('e5200000-0000-0000-0000-000000000001',current_setting('test.d')::uuid)$$,'criterion deleted before start');
select throws_ok($$select public.admin_delete_judging_criterion('e5200000-0000-0000-0000-000000000001',current_setting('test.d')::uuid)$$,'P0001','Criterion not found for this event','deleted criterion gone');
select throws_ok($$select * from public.judging_criteria$$,'42501',null,'no direct criteria reads for admins either');
reset role;
select pg_temp.login(2,'oauth');
select throws_ok($$select public.admin_judging_criteria('e5200000-0000-0000-0000-000000000001')$$,'42501','Not authorized','reviewer cannot read rubric');
select throws_ok($$select pg_temp.add('Criterion X')$$,'42501','Not authorized','reviewer cannot edit rubric');
reset role;
select pg_temp.login(5);
select throws_ok($$select * from public.judging_criteria$$,'42501',null,'participant cannot select criteria');
select throws_ok($$select * from public.judging_scores$$,'42501',null,'participant cannot select scores');
select is(public.judge_criteria('flow'),null::jsonb,'participant gets no rubric');
select throws_ok($$select public.admin_judging_criteria('e5200000-0000-0000-0000-000000000001')$$,'42501','Not authorized','participant cannot use admin read');
reset role;
select pg_temp.login(3);
select is(jsonb_array_length(public.judge_criteria('flow')),3,'active judge reads rubric before judging starts');
select is(public.judge_criteria('flow-other'),null::jsonb,'judge cannot read another event rubric');
select throws_ok($$select public.admin_judging_criteria('e5200000-0000-0000-0000-000000000001')$$,'42501','Not authorized','judge cannot use admin read');
reset role;
set local role anon;
select throws_ok($$select public.judge_criteria('flow')$$,'42501',null,'anonymous rubric read denied');
reset role;
update public.event_judges set active=false where id='b5200000-0000-0000-0000-000000000004';
select pg_temp.login(4);
select is(public.judge_criteria('flow'),null::jsonb,'inactive judge gets no rubric');
reset role;
update public.event_judges set active=true where id='b5200000-0000-0000-0000-000000000004';

-- Starting locks the rubric.
select pg_temp.login(1,'oauth');
select throws_ok($$select public.admin_start_judging('e5200000-0000-0000-0000-000000000002')$$,'P0001','Add at least one judging criterion before starting judging','empty rubric blocks start');
select lives_ok($$select public.admin_start_judging('e5200000-0000-0000-0000-000000000001')$$,'judging starts with a rubric');
select throws_ok($$select pg_temp.add('Criterion E')$$,'P0001','Criteria are locked because judging has started','add locked after start');
select throws_ok($$select public.admin_save_judging_criterion('e5200000-0000-0000-0000-000000000001','X','',current_setting('test.a')::uuid)$$,'P0001','Criteria are locked because judging has started','edit locked after start');
select throws_ok($$select public.admin_delete_judging_criterion('e5200000-0000-0000-0000-000000000001',current_setting('test.a')::uuid)$$,'P0001','Criteria are locked because judging has started','delete locked after start');
select throws_ok($$select public.admin_reorder_judging_criteria('e5200000-0000-0000-0000-000000000001',array[current_setting('test.a'),current_setting('test.b'),current_setting('test.c')]::uuid[])$$,'P0001','Criteria are locked because judging has started','reorder locked after start');
select is(pg_temp.names(),'Criterion C,Criterion A2,Criterion B','locked rubric still readable');
reset role;

-- Briefing gate.
insert into public.judging_assignments(id,event_id,judge_id,project_id)
select ('f5200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'e5200000-0000-0000-0000-000000000001',
 'b5200000-0000-0000-0000-000000000003',('a5200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,3)n;
insert into public.judging_assignments(id,event_id,judge_id,project_id) values
 ('f5200000-0000-0000-0000-000000000004','e5200000-0000-0000-0000-000000000001','b5200000-0000-0000-0000-000000000004','a5200000-0000-0000-0000-000000000002');
create function pg_temp.save(n integer,a numeric,b numeric,c numeric,submit boolean default true) returns jsonb language sql as $$
 select public.judge_save_review('flow',('f5200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
  jsonb_build_object(current_setting('test.a'),a,current_setting('test.b'),b,current_setting('test.c'),c),'',submit);
$$;
select pg_temp.login(3);
select is(public.judge_event_access('flow')->>'briefing_acknowledged_at',null::text,'briefing starts unread');
select throws_ok($$select pg_temp.save(1,3,3,4,false)$$,'PT409','Read the judging briefing before scoring','draft blocked before briefing');
select set_config('test.ack',public.judge_acknowledge_briefing('flow')->>'briefing_acknowledged_at',true);
select isnt(current_setting('test.ack'),'','acknowledgement recorded');
select is(public.judge_acknowledge_briefing('flow')->>'briefing_acknowledged_at',current_setting('test.ack'),'acknowledgement is idempotent');
select is(public.judge_events()->0->>'briefing_acknowledged_at',current_setting('test.ack'),'summary exposes acknowledgement');
select throws_ok($$select public.judge_acknowledge_briefing('flow-other')$$,'42501','Judge access unavailable','cannot acknowledge without roster entry');
select lives_ok($$select pg_temp.save(1,3,3,4)$$,'scores after briefing');
reset role;
select pg_temp.login(5);
select throws_ok($$select public.judge_acknowledge_briefing('flow')$$,'42501','Judge access unavailable','participant cannot acknowledge');
reset role;
select pg_temp.login(1,'oauth');
select is((select count(*) from jsonb_array_elements(public.admin_judge_roster('e5200000-0000-0000-0000-000000000001')) j
 where j->>'briefing_acknowledged_at' is not null),1::bigint,'roster shows who read the briefing');
reset role;

-- Results: judge mean of criteria, project mean of judges, exact ties.
update public.event_judges set briefing_acknowledged_at=now() where id='b5200000-0000-0000-0000-000000000004';
select pg_temp.login(3);
select lives_ok($$select pg_temp.save(2,3,3,3)$$,'second review submitted');
select lives_ok($$select pg_temp.save(3,3,3,4.1)$$,'third review submitted');
reset role;
select pg_temp.login(4);
select lives_ok($$select pg_temp.save(4,3,4,4)$$,'other judge submitted');
reset role;
create function pg_temp.result(n integer) returns jsonb language sql as $$
 select p from jsonb_array_elements(public.admin_judging_results('e5200000-0000-0000-0000-000000000001')->'projects') p
 where p->>'project_id'='a5200000-0000-0000-0000-'||lpad(n::text,12,'0');
$$;
select pg_temp.login(1,'oauth');
select is(round((pg_temp.result(1)->>'average_score')::numeric,6),3.333333,'judge score is the mean of criteria');
select is(round((pg_temp.result(2)->>'average_score')::numeric,6),3.333333,'project score is the mean of judge scores');
select is(pg_temp.result(2)->>'completed','2','two reviews counted');
select is(pg_temp.result(1)->>'tied','true','repeating-decimal means tie exactly');
select is(pg_temp.result(2)->>'tied','true','tie independent of review count');
select is(pg_temp.result(3)->>'tied','false','close but different mean not tied');
select is(pg_temp.result(3)->>'insufficient_coverage','true','coverage below target flagged');
select is(public.admin_judging_results('e5200000-0000-0000-0000-000000000001')->'projects'->0->>'project_name','Project 3','highest mean first');
reset role;
select * from finish(true);
rollback;
