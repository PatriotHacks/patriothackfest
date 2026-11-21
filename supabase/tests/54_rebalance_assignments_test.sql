begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,email_confirmed_at)
select ('d5400000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'reb-'||n||'@example.test',now() from generate_series(1,13)n;
insert into public.admin_allowlist(email,level) values('reb-1@example.test','organizer'),('reb-2@example.test','reviewer');
insert into public.events(id,slug,name) values
 ('e5400000-0000-0000-0000-000000000001','rebalance','Rebalance'),
 ('e5400000-0000-0000-0000-000000000002','rebalance-even','Rebalance even');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,project_submissions_close_at,judging_close_at,general_reviews_per_project)
select id,true,now()-interval '3 days',now()-interval '2 days',now()+interval '1 day',1 from public.events where slug like 'rebalance%';
create function pg_temp.id(prefix text,n integer) returns uuid language sql as $$ select (prefix||'-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
alter table public.projects disable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at)
select pg_temp.id('a5400000',n),pg_temp.id('e5400000',case when n>10 then 2 else 1 end),
 pg_temp.id('d5400000',case when n=4 then 8 else 9 end),'Project '||n,'submitted',now()
from generate_series(1,16)n where n not between 9 and 10;
alter table public.projects enable trigger projects_one_team;
-- Event 1: judge 3 is overloaded; 5 is a guest, 6 inactive, 7 has room for one,
-- 8 is on project 4's team and was previously paired with project 5.
insert into public.event_judges(id,event_id,email,user_id,capacity,active,guest)
select pg_temp.id('b5400000',n),pg_temp.id('e5400000',case when n>10 then 2 else 1 end),'reb-'||n||'@example.test',
 pg_temp.id('d5400000',n),case n when 7 then 1 else 10 end,n<>6,n=5
from generate_series(3,13)n where n not between 9 and 10;
create function pg_temp.assign(j integer,p integer,cancelled boolean default false) returns void language sql as $$
 insert into public.judging_assignments(id,event_id,judge_id,project_id,cancelled)
 values(pg_temp.id('f5400000',j*100+p),pg_temp.id('e5400000',case when p>10 then 2 else 1 end),pg_temp.id('b5400000',j),pg_temp.id('a5400000',p),cancelled);
$$;
select pg_temp.assign(3,p) from generate_series(1,6)p;
select pg_temp.assign(4,p) from generate_series(7,8)p;
select pg_temp.assign(8,5,true);
insert into public.judging_criteria(id,event_id,position,name) values('c5400000-0000-0000-0000-000000000001','e5400000-0000-0000-0000-000000000001',1,'Criterion A');
update public.judging_assignments set submitted_at=now() where id=pg_temp.id('f5400000',301);
insert into public.judging_scores(assignment_id,criterion_id,event_id,score)
values(pg_temp.id('f5400000',302),'c5400000-0000-0000-0000-000000000001','e5400000-0000-0000-0000-000000000001',3);
update public.judging_assignments set notes='Draft note' where id=pg_temp.id('f5400000',303);

create function pg_temp.login(n integer) returns void language sql as $$
 select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('d5400000',n),
  'email','reb-'||n||'@example.test','amr',json_build_array(json_build_object('method','oauth')))::text,true);
 select set_config('role','authenticated',true);
$$;
create function pg_temp.preview(e integer) returns jsonb language sql as $$
 select public.admin_rebalance_assignments_preview(pg_temp.id('e5400000',e));
$$;
create function pg_temp.apply(e integer) returns jsonb language sql as $$
 select public.admin_rebalance_assignments(pg_temp.id('e5400000',e));
$$;
create function pg_temp.load(j integer) returns bigint language sql as $$
 select count(*) from public.judging_assignments where judge_id=pg_temp.id('b5400000',j) and not cancelled;
$$;
create function pg_temp.holds(j integer,p integer) returns boolean language sql as $$
 select exists(select 1 from public.judging_assignments where judge_id=pg_temp.id('b5400000',j)
  and project_id=pg_temp.id('a5400000',p) and not cancelled);
$$;
create function pg_temp.transfer(f integer,t integer,n integer) returns jsonb language sql as $$
 select jsonb_build_object('from_judge_id',pg_temp.id('b5400000',f),'from_email','reb-'||f||'@example.test',
  'to_judge_id',pg_temp.id('b5400000',t),'to_email','reb-'||t||'@example.test','count',n);
$$;
select no_plan();

-- Gates.
select pg_temp.login(1);
select throws_ok($$select pg_temp.preview(1)$$,'P0001','Start judging before managing assignments','preview requires judging to have started');
select throws_ok($$select pg_temp.apply(1)$$,'P0001','Start judging before managing assignments','apply requires judging to have started');
reset role;
update public.event_competition_settings set judging_started_at=now() where event_id in (pg_temp.id('e5400000',1),pg_temp.id('e5400000',2));
select pg_temp.login(2);
select throws_ok($$select pg_temp.preview(1)$$,'42501','Not authorized','reviewer cannot preview');
select throws_ok($$select pg_temp.apply(1)$$,'42501','Not authorized','reviewer cannot rebalance');
reset role;
select pg_temp.login(3);
select throws_ok($$select pg_temp.apply(1)$$,'42501','Not authorized','judge cannot rebalance');
select throws_ok($$select public.rebalance_judge_assignments(pg_temp.id('e5400000',1))$$,'42501',null,'rebalance planner is internal');
reset role;
set local role anon;
select throws_ok($$select public.admin_rebalance_assignments('e5400000-0000-0000-0000-000000000001')$$,'42501',null,'anonymous cannot rebalance');
reset role;

-- A new judge joins mid-judging and receives an even share.
select pg_temp.assign(11,p) from generate_series(11,13)p;
select pg_temp.assign(12,p) from generate_series(14,16)p;
select pg_temp.login(1);
select is(pg_temp.preview(2),jsonb_build_object('moved',2,'spread',0,'transfers',jsonb_build_array(pg_temp.transfer(11,13,1),pg_temp.transfer(12,13,1))),
 'preview plans an even split for the new judge');
reset role;
select is((select count(*) from public.judging_assignments where cancelled),1::bigint,'preview changes nothing');
select pg_temp.login(1);
select is(pg_temp.apply(2),jsonb_build_object('moved',2,'spread',0,'transfers',jsonb_build_array(pg_temp.transfer(11,13,1),pg_temp.transfer(12,13,1))),
 'apply matches the preview');
reset role;
select is(array[pg_temp.load(11),pg_temp.load(12),pg_temp.load(13)],array[2,2,2]::bigint[],'loads are equal');
select is((select count(*) from public.judging_assignments where event_id=pg_temp.id('e5400000',2) and cancelled),2::bigint,'moved rows are cancelled, not rewritten');
select is((select sum(missing) from public.assignment_targets(pg_temp.id('e5400000',2))),0::bigint,'coverage is unchanged');

-- Locked work, eligibility and capacity limit the moves.
select pg_temp.login(1);
select set_config('test.plan',pg_temp.preview(1)::text,true);
select is(current_setting('test.plan')::jsonb,jsonb_build_object('moved',4,'spread',2,'transfers',jsonb_build_array(
 pg_temp.transfer(3,4,1),pg_temp.transfer(3,7,1),pg_temp.transfer(3,8,1),pg_temp.transfer(4,8,1))),
 'preview reports the moves and the remaining spread');
select is(pg_temp.apply(1),current_setting('test.plan')::jsonb,'apply matches the preview');
reset role;
select is(array[pg_temp.load(3),pg_temp.load(4),pg_temp.load(7),pg_temp.load(8)],array[3,2,1,2]::bigint[],'loads after rebalance');
select is(array[pg_temp.holds(3,1),pg_temp.holds(3,2),pg_temp.holds(3,3)],array[true,true,true],'submitted, scored and noted work stays');
select is((select count(*) from public.judging_scores where assignment_id=pg_temp.id('f5400000',302)),1::bigint,'draft scores kept');
select is(pg_temp.holds(7,4),true,'capacity-one judge took exactly one');
select is(array[pg_temp.holds(8,4),pg_temp.holds(8,5)],array[false,false],'team member and prior pair never receive the project');
select is(array[pg_temp.holds(8,6),pg_temp.holds(8,7),pg_temp.holds(4,5)],array[true,true,true],'eligible judges receive the work');
select is(array[pg_temp.load(5),pg_temp.load(6)],array[0,0]::bigint[],'guest and inactive judges get nothing');
select is((select cancelled from public.judging_assignments where id=pg_temp.id('f5400000',304)),true,'original pair is kept as history');
select is((select sum(missing) from public.assignment_targets(pg_temp.id('e5400000',1))),0::bigint,'coverage is unchanged');
select pg_temp.login(1);
select is(pg_temp.apply(1),'{"moved":0,"spread":2,"transfers":[]}'::jsonb,'a second run moves nothing');
reset role;

select * from finish();
rollback;
