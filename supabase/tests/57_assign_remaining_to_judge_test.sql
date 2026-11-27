begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.id(prefix text,n integer) returns uuid language sql as $$ select (prefix||'-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
insert into auth.users(id,email,email_confirmed_at)
select pg_temp.id('d5700000',n),'arj-'||n||'@example.test',now() from generate_series(1,11)n;
insert into public.admin_allowlist(email,level) values('arj-1@example.test','organizer'),('arj-2@example.test','reviewer');
insert into public.events(id,slug,name) values
 ('e5700000-0000-0000-0000-000000000001','assign-remaining','Assign remaining'),
 ('e5700000-0000-0000-0000-000000000002','assign-remaining-other','Assign remaining other');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,project_submissions_close_at,judging_close_at,general_reviews_per_project)
select id,true,now()-interval '3 days',now()-interval '2 days',now()+interval '1 day',1 from public.events where slug like 'assign-remaining%';
insert into public.competition_tracks(id,event_id,name) values('c5700000-0000-0000-0000-000000000001','e5700000-0000-0000-0000-000000000001','Sponsor');
alter table public.projects disable trigger projects_one_team;
-- Judge 3 (the target) owns project 6.
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at)
select pg_temp.id('a5700000',n),pg_temp.id('e5700000',1),pg_temp.id('d5700000',case when n=6 then 3 else 11 end),'Project '||n,'submitted',now()
from generate_series(1,8)n;
alter table public.projects enable trigger projects_one_team;
insert into public.project_tracks(project_id,track_id,event_id)
values(pg_temp.id('a5700000',4),'c5700000-0000-0000-0000-000000000001','e5700000-0000-0000-0000-000000000001');
-- 3 target (capacity 3), 4 and 5 general sources, 6 sponsor, 7 guest, 8 inactive, 10 another event's judge.
insert into public.event_judges(id,event_id,email,user_id,kind,capacity,active,guest)
select pg_temp.id('b5700000',n),pg_temp.id('e5700000',case when n=10 then 2 else 1 end),'arj-'||n||'@example.test',
 pg_temp.id('d5700000',n),case when n=6 then 'sponsor' else 'general' end,case when n=3 then 3 else 20 end,n<>8,n=7
from generate_series(3,10)n where n<>9;
insert into public.judge_track_scopes(judge_id,track_id,event_id)
values(pg_temp.id('b5700000',6),'c5700000-0000-0000-0000-000000000001','e5700000-0000-0000-0000-000000000001');
create function pg_temp.assign(j integer,p integer,cancelled boolean default false,track uuid default null) returns void language sql as $$
 insert into public.judging_assignments(id,event_id,judge_id,project_id,track_id,cancelled)
 values(pg_temp.id('f5700000',j*100+p),pg_temp.id('e5700000',1),pg_temp.id('b5700000',j),pg_temp.id('a5700000',p),track,cancelled);
$$;
select pg_temp.assign(3,1);
select pg_temp.assign(3,7,true);
select pg_temp.assign(3,8,true);
select pg_temp.assign(4,p) from generate_series(2,6)p;
select pg_temp.assign(5,p) from unnest(array[1,2,7,8])p;
select pg_temp.assign(6,4,false,'c5700000-0000-0000-0000-000000000001');
select pg_temp.assign(8,5);
update public.judging_assignments set submitted_at=now() where id in (pg_temp.id('f5700000',402),pg_temp.id('f5700000',805));
update public.judging_assignments set notes='Draft note' where id in (pg_temp.id('f5700000',403),pg_temp.id('f5700000',308));

create function pg_temp.login(n integer) returns void language sql as $$
 select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('d5700000',n),
  'email','arj-'||n||'@example.test','amr',json_build_array(json_build_object('method','oauth')))::text,true);
 select set_config('role','authenticated',true);
$$;
create function pg_temp.preview(j integer,e integer default 1) returns jsonb language sql as $$
 select public.admin_assign_remaining_to_judge_preview(pg_temp.id('e5700000',e),pg_temp.id('b5700000',j));
$$;
create function pg_temp.apply(j integer,e integer default 1) returns jsonb language sql as $$
 select public.admin_assign_remaining_to_judge(pg_temp.id('e5700000',e),pg_temp.id('b5700000',j));
$$;
create function pg_temp.holds(j integer,p integer) returns boolean language sql as $$
 select exists(select 1 from public.judging_assignments where judge_id=pg_temp.id('b5700000',j)
  and project_id=pg_temp.id('a5700000',p) and not cancelled);
$$;
create function pg_temp.cancelled(j integer,p integer) returns boolean language sql as $$
 select cancelled from public.judging_assignments where id=pg_temp.id('f5700000',j*100+p);
$$;
create function pg_temp.source(j integer,n integer) returns jsonb language sql as $$
 select jsonb_build_object('judge_id',pg_temp.id('b5700000',j),'email','arj-'||j||'@example.test','count',n);
$$;
select no_plan();

-- Gates.
select pg_temp.login(1);
select throws_ok($$select pg_temp.preview(3)$$,'P0001','Start judging before managing assignments','preview requires judging to have started');
select throws_ok($$select pg_temp.apply(3)$$,'P0001','Start judging before managing assignments','apply requires judging to have started');
reset role;
update public.event_competition_settings set judging_started_at=now() where event_id in (pg_temp.id('e5700000',1),pg_temp.id('e5700000',2));
select pg_temp.login(2);
select throws_ok($$select pg_temp.preview(3)$$,'42501','Not authorized','reviewer cannot preview');
select throws_ok($$select pg_temp.apply(3)$$,'42501','Not authorized','reviewer cannot apply');
reset role;
select pg_temp.login(3);
select throws_ok($$select pg_temp.apply(3)$$,'42501','Not authorized','judge cannot apply');
select throws_ok($$select public.assign_remaining_to_judge(pg_temp.id('e5700000',1),pg_temp.id('b5700000',3))$$,'42501',null,'planner is internal');
select throws_ok($$select public.assignment_ineligibility(pg_temp.id('b5700000',3),pg_temp.id('a5700000',1),null)$$,'42501',null,'eligibility helper is internal');
reset role;
set local role anon;
select throws_ok($$select public.admin_assign_remaining_to_judge('e5700000-0000-0000-0000-000000000001','b5700000-0000-0000-0000-000000000003')$$,'42501',null,'anonymous cannot apply');
reset role;

-- Target validation.
select pg_temp.login(1);
select throws_ok($$select pg_temp.preview(10)$$,'PT404','Judge not found for this event','target must belong to the event');
select throws_ok($$select pg_temp.apply(7)$$,'P0001','Only active, non-guest judges can receive assignments','guest target is refused');
select throws_ok($$select pg_temp.apply(8)$$,'P0001','Only active, non-guest judges can receive assignments','inactive target is refused');

-- Preview and apply.
select set_config('test.plan',pg_temp.preview(3)::text,true);
select is(current_setting('test.plan')::jsonb,jsonb_build_object('moved',2,
 'skipped',jsonb_build_object('conflict',1,'ineligible_track',1,'capacity',2,'previously_held',2),
 'sources',jsonb_build_array(pg_temp.source(4,1),pg_temp.source(5,1))),'preview reports moves, skips and sources');
reset role;
select is((select count(*) from public.judging_assignments where event_id=pg_temp.id('e5700000',1) and cancelled),2::bigint,'preview changes nothing');
select pg_temp.login(1);
select is(pg_temp.apply(3),current_setting('test.plan')::jsonb,'apply matches the preview');
reset role;

select is(array[pg_temp.holds(3,4),pg_temp.cancelled(4,4)],array[true,true],'untouched work moves by cancelling the source');
select is(array[pg_temp.holds(3,5),pg_temp.holds(3,2),pg_temp.cancelled(4,5),pg_temp.cancelled(5,2)],array[false,false,false,false],
 'capacity keeps projects with more submitted reviews in place');
select is(array[pg_temp.cancelled(3,7),pg_temp.cancelled(5,7)],array[false,true],'cancelled untouched pair is reactivated');
select is((select count(*) from public.judging_assignments where judge_id=pg_temp.id('b5700000',3) and project_id=pg_temp.id('a5700000',7)),1::bigint,
 'reactivation inserts no new row');
select is(array[pg_temp.cancelled(3,8),pg_temp.cancelled(5,8)],array[true,false],'previously held pair with work is skipped');
select is(array[pg_temp.cancelled(3,1),pg_temp.cancelled(5,1)],array[false,false],'existing pair of the target is skipped');
select is(array[pg_temp.cancelled(4,2),pg_temp.cancelled(4,3)],array[false,false],'submitted and in-progress work never moves');
select is(pg_temp.cancelled(4,6),false,'team member never receives the project');
select is(pg_temp.cancelled(6,4),false,'sponsor-track work stays with the sponsor judge');
select is((select count(*) from public.judging_assignments where judge_id=pg_temp.id('b5700000',3) and not cancelled),3::bigint,
 'target load stops at capacity');
select is((select sum(missing) from public.assignment_targets(pg_temp.id('e5700000',1))),0::bigint,'coverage is unchanged');
select pg_temp.login(1);
select is((pg_temp.apply(3)->>'moved')::integer,0,'a second run moves nothing at capacity');
reset role;

-- Capacity freed: lowest submitted counts still come first, judge 4 is drained.
update public.event_judges set capacity=10 where id=pg_temp.id('b5700000',3);
select pg_temp.login(1);
select is(pg_temp.apply(3),jsonb_build_object('moved',2,
 'skipped',jsonb_build_object('conflict',1,'ineligible_track',1,'capacity',0,'previously_held',2),
 'sources',jsonb_build_array(pg_temp.source(4,1),pg_temp.source(5,1))),'freed capacity takes the rest');
reset role;
select is(array[pg_temp.holds(3,5),pg_temp.holds(3,2),pg_temp.holds(4,2)],array[true,true,true],'remaining eligible work moved');

select * from finish();
rollback;
