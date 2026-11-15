begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,email_confirmed_at) select ('da500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'a2-edge-'||n||'@example.test',now() from generate_series(1,3)n;
insert into public.admin_allowlist(email,level) values('a2-edge-1@example.test','organizer');
insert into public.events(id,slug,name) values('ea500000-0000-0000-0000-000000000001','a2-edges','A2 edges');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,project_submissions_close_at,judging_close_at,general_reviews_per_project)
values('ea500000-0000-0000-0000-000000000001',true,now()-interval '2 days',now()-interval '1 day',now()+interval '1 day',2);
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at) select ('aa500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'ea500000-0000-0000-0000-000000000001','da500000-0000-0000-0000-000000000002','Project '||n,case when n=2 then 'draft' when n=3 then 'withdrawn' else 'submitted' end,now() from generate_series(1,3)n;
insert into public.project_collaborators(project_id,event_id,user_id) values('aa500000-0000-0000-0000-000000000001','ea500000-0000-0000-0000-000000000001','da500000-0000-0000-0000-000000000003');
insert into public.competition_tracks(id,event_id,name,active) select ('ca500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'ea500000-0000-0000-0000-000000000001','Track '||n,n<3 from generate_series(1,3)n;
insert into public.project_tracks(project_id,track_id,event_id) select 'aa500000-0000-0000-0000-000000000001',id,event_id from public.competition_tracks where event_id='ea500000-0000-0000-0000-000000000001';
insert into public.event_judges(id,event_id,email,kind,active,capacity) values
 ('ba500000-0000-0000-0000-000000000001','ea500000-0000-0000-0000-000000000001','edge-general@example.test','general',true,1),
 ('ba500000-0000-0000-0000-000000000002','ea500000-0000-0000-0000-000000000001','edge-shared@example.test','sponsor',true,2),
 ('ba500000-0000-0000-0000-000000000003','ea500000-0000-0000-0000-000000000001','edge-other@example.test','sponsor',true,2),
 ('ba500000-0000-0000-0000-000000000004','ea500000-0000-0000-0000-000000000001','edge-inactive@example.test','general',false,20),
 ('ba500000-0000-0000-0000-000000000005','ea500000-0000-0000-0000-000000000001','A2-EDGE-2@example.test','general',true,20),
 ('ba500000-0000-0000-0000-000000000006','ea500000-0000-0000-0000-000000000001','A2-EDGE-3@example.test','general',true,20);
insert into public.judge_track_scopes(judge_id,track_id,event_id) values
 ('ba500000-0000-0000-0000-000000000002','ca500000-0000-0000-0000-000000000001','ea500000-0000-0000-0000-000000000001'),
 ('ba500000-0000-0000-0000-000000000002','ca500000-0000-0000-0000-000000000002','ea500000-0000-0000-0000-000000000001'),
 ('ba500000-0000-0000-0000-000000000003','ca500000-0000-0000-0000-000000000002','ea500000-0000-0000-0000-000000000001');
create function pg_temp.candidates(n integer default null) returns jsonb language sql as $$select public.admin_assignment_candidates('ea500000-0000-0000-0000-000000000001','aa500000-0000-0000-0000-000000000001',case when n is not null then ('ca500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid end)$$;
create function pg_temp.add(j integer,t integer default null) returns uuid language sql as $$select public.admin_add_assignment('ea500000-0000-0000-0000-000000000001','aa500000-0000-0000-0000-000000000001',('ba500000-0000-0000-0000-'||lpad(j::text,12,'0'))::uuid,case when t is not null then ('ca500000-0000-0000-0000-'||lpad(t::text,12,'0'))::uuid end)$$;
create function pg_temp.reassign(j integer) returns uuid language sql as $$select public.admin_reassign_assignment('ea500000-0000-0000-0000-000000000001',current_setting('test.source')::uuid,('ba500000-0000-0000-0000-'||lpad(j::text,12,'0'))::uuid)$$;
select plan(24);
select set_config('request.jwt.claims','{"sub":"da500000-0000-0000-0000-000000000001","email":"a2-edge-1@example.test","amr":[{"method":"oauth"}]}',true);
set local role authenticated;
select is(jsonb_array_length(pg_temp.candidates()),1,'inactive and both unbound owner/collaborator email conflicts excluded');
select is(jsonb_array_length(pg_temp.candidates(1)),1,'only scoped sponsor pool');
select is(jsonb_array_length(pg_temp.candidates(2)),2,'multi-track sponsor pool');
select is(pg_temp.candidates(3),'[]'::jsonb,'inactive opted-in track has no new candidates');
select is(jsonb_array_length(public.admin_assignment_overview('ea500000-0000-0000-0000-000000000001')->'coverage'),3,'only submitted general and active opted-in contexts');
select is(public.admin_assignment_candidates('ea500000-0000-0000-0000-000000000001','aa500000-0000-0000-0000-000000000002'),'[]'::jsonb,'draft candidates denied');
select is(public.admin_assignment_candidates('ea500000-0000-0000-0000-000000000001','aa500000-0000-0000-0000-000000000003'),'[]'::jsonb,'withdrawn candidates denied');
select public.admin_start_judging('ea500000-0000-0000-0000-000000000001');
select throws_ok($$select pg_temp.add(2)$$,'P0001','Judge is no longer eligible for this assignment','sponsor never receives unrelated general project');
select throws_ok($$select pg_temp.add(3,1)$$,'P0001','Judge is no longer eligible for this assignment','wrong track rejected manually');
select throws_ok($$select pg_temp.add(4)$$,'P0001','Judge is no longer eligible for this assignment','inactive manual destination denied');
select set_config('test.source',pg_temp.add(2,1)::text,true);
select lives_ok($$select pg_temp.add(2,2)$$,'same project can have independent sponsor contexts');
select is(jsonb_array_length(pg_temp.candidates(2)),1,'shared judge capacity consumed across tracks');
select throws_ok($$select pg_temp.reassign(1)$$,'P0001','Judge is no longer eligible for this assignment','general judge cannot replace sponsor review');
reset role;
select ok(not (select cancelled from public.judging_assignments where id=current_setting('test.source')::uuid),'failed wrong-kind move does not cancel source');
select is((select count(*) from public.judging_assignments where judge_id='ba500000-0000-0000-0000-000000000002' and not cancelled),2::bigint,'capacity shared across contexts');
select is(public.admin_assignment_overview('ea500000-0000-0000-0000-000000000001',1,1,null,'submitted')->'assignments','[]'::jsonb,'status filter excludes unfinished work');
set local role authenticated;
select set_config('test.general',pg_temp.add(1)::text,true);
reset role;
-- New judge added after start, then target reduced below existing coverage.
insert into public.event_judges(id,event_id,email) values('ba500000-0000-0000-0000-000000000007','ea500000-0000-0000-0000-000000000001','edge-extra@example.test');
set local role authenticated;
select pg_temp.add(7);
reset role;
insert into public.event_judges(id,event_id,email) values('ba500000-0000-0000-0000-000000000008','ea500000-0000-0000-0000-000000000001','edge-replacement@example.test');
update public.event_competition_settings set general_reviews_per_project=1 where event_id='ea500000-0000-0000-0000-000000000001';
select set_config('test.source',current_setting('test.general'),true);
set local role authenticated;
select lives_ok($$select pg_temp.reassign(8)$$,'reassignment can preserve over-target work without adding coverage');
reset role;
select is((select count(*) from public.judging_assignments where track_id is null and not cancelled and event_id='ea500000-0000-0000-0000-000000000001'),2::bigint,'over-target coverage unchanged');
update public.event_judges set active=false,capacity=1 where id='ba500000-0000-0000-0000-000000000002';
set local role authenticated;
select is(public.admin_generate_assignments('ea500000-0000-0000-0000-000000000001'),'{"created":0,"missing":0}'::jsonb,'deactivation and capacity reduction preserve existing work');
select throws_ok($$select public.admin_assignment_overview('ea500000-0000-0000-0000-000000000001',1,1,null,'bogus')$$,'22023','Invalid assignment status','invalid status rejected');
select throws_ok($$select public.admin_assignment_overview('ea500000-0000-0000-0000-000000000001',1,0)$$,'22023','Invalid assignment page','invalid assignment page rejected');
reset role;
select ok(not has_function_privilege('authenticated','public.assignment_candidates(uuid,uuid,uuid)','EXECUTE'),'eligibility helper private');
select ok(not has_function_privilege('authenticated','public.lock_assignment_event(uuid)','EXECUTE'),'lock helper private');
select is((public.admin_assignment_overview('ea500000-0000-0000-0000-000000000001')->>'missing')::integer,0,'missing count clamped at zero for over-target work');
select * from finish(true);
rollback;
