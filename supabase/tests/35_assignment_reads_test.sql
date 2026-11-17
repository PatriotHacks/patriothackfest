begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,email_confirmed_at) select ('da200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'a2-'||n||'@example.test',now() from generate_series(1,5)n;
insert into public.admin_allowlist(email,level) values('a2-1@example.test','organizer'),('a2-2@example.test','reviewer');
insert into public.events(id,slug,name) values('ea200000-0000-0000-0000-000000000001','a2-read','A2'),('ea200000-0000-0000-0000-000000000002','a2-other','Other');
insert into public.event_competition_settings(event_id) select id from public.events where slug like 'a2-%';
-- Fixture: one owner with several projects; team rules are tested in 47.
alter table public.projects disable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at)
select ('aa200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'ea200000-0000-0000-0000-000000000001','da200000-0000-0000-0000-000000000003','Project '||n,'submitted',now() from generate_series(1,52)n;
alter table public.projects enable trigger projects_one_team;
insert into public.project_collaborators(project_id,event_id,user_id) values('aa200000-0000-0000-0000-000000000001','ea200000-0000-0000-0000-000000000001','da200000-0000-0000-0000-000000000004');
insert into public.event_judges(id,event_id,email,user_id) values
 ('ba200000-0000-0000-0000-000000000001','ea200000-0000-0000-0000-000000000001','A2-3@example.test',null),
 ('ba200000-0000-0000-0000-000000000002','ea200000-0000-0000-0000-000000000001','changed@example.test','da200000-0000-0000-0000-000000000004'),
 ('ba200000-0000-0000-0000-000000000003','ea200000-0000-0000-0000-000000000001','guest@example.test',null);
create function pg_temp.login(n integer,method text default 'oauth') returns void language sql as $$
 select set_config('request.jwt.claims',json_build_object('sub','da200000-0000-0000-0000-'||lpad(n::text,12,'0'),'email','a2-'||n||'@example.test','amr',json_build_array(json_build_object('method',method)))::text,true);
 select set_config('role','authenticated',true);
$$;
create function pg_temp.overview(p integer default 1) returns jsonb language sql as $$select public.admin_assignment_overview('ea200000-0000-0000-0000-000000000001',p)$$;
select plan(18);
select pg_temp.login(1);
select is(jsonb_array_length(pg_temp.overview()->'coverage'),50,'coverage bounded at 50');
select is(pg_temp.overview()->>'coverage_has_more','true','coverage has next page');
select is(jsonb_array_length(pg_temp.overview(2)->'coverage'),2,'second page complete');
select is(pg_temp.overview()->>'missing','156','event totals not limited to UI page');
select is(jsonb_array_length(public.admin_assignment_candidates('ea200000-0000-0000-0000-000000000001','aa200000-0000-0000-0000-000000000001')),1,'bound collaborator and unbound confirmed owner excluded');
select is(public.admin_assignment_candidates('ea200000-0000-0000-0000-000000000002','aa200000-0000-0000-0000-000000000001'),'[]'::jsonb,'cross-event candidates excluded');
select is(public.admin_assignment_overview('ea200000-0000-0000-0000-000000000002')->'coverage','[]'::jsonb,'other event has no coverage');
select throws_ok($$select pg_temp.overview(0)$$,'22023','Invalid assignment page','invalid page rejected');
select throws_ok($$select public.assignment_targets('ea200000-0000-0000-0000-000000000001')$$,'42501',null,'private helper denied');
select throws_ok($$select * from public.judging_assignments$$,'42501',null,'no direct scorecard read');
reset role;
select pg_temp.login(2);
select throws_ok($$select pg_temp.overview()$$,'42501','Not authorized','reviewer denied');
reset role;
select pg_temp.login(3,'otp');
select throws_ok($$select pg_temp.overview()$$,'42501','Not authorized','participant denied');
reset role;
select pg_temp.login(1,'otp');
select throws_ok($$select pg_temp.overview()$$,'42501','Not authorized','OTP admin email denied');
reset role;
insert into public.judging_assignments(event_id,judge_id,project_id,notes) values('ea200000-0000-0000-0000-000000000001','ba200000-0000-0000-0000-000000000003','aa200000-0000-0000-0000-000000000001','private draft');
update public.event_judges set active=false where id='ba200000-0000-0000-0000-000000000003';
select pg_temp.login(1);
select is(pg_temp.overview()->'assignments'->0->>'status','in_progress','notes-only work protected');
select ok(not (pg_temp.overview()->'assignments'->0 ? 'notes'),'private notes omitted');
select is(pg_temp.overview()->>'missing','155','inactive existing work still counts coverage');
select is(pg_temp.overview()->'judges'->2->>'workload','1','inactive work still counts load');
reset role;
set local role anon;
select throws_ok($$select pg_temp.overview()$$,'42501',null,'anonymous denied');
select * from finish(true);
rollback;
