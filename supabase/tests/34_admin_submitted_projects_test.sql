begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer,p_method text default 'oauth') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','de100000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','project-viewer-'||n||'@example.test','amr',json_build_array(json_build_object('method',p_method)))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.list(p_page integer default 1) returns jsonb language sql as $$
  select public.admin_submitted_projects('ee100000-0000-0000-0000-000000000001',p_page);
$$;
create function pg_temp.detail(n integer default 53) returns jsonb language sql as $$
  select public.admin_submitted_project_detail('ee100000-0000-0000-0000-000000000001',('ae100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid);
$$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select ('de100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'project-viewer-'||n||'@example.test',now(),jsonb_build_object('full_name','Person '||n)
from generate_series(1,5)n;
insert into public.admin_allowlist(email,level) values
 ('project-viewer-1@example.test','owner'),('project-viewer-2@example.test','organizer'),('project-viewer-3@example.test','reviewer');
insert into public.events(id,slug,name) values
 ('ee100000-0000-0000-0000-000000000001','visibility-one','Visibility one'),
 ('ee100000-0000-0000-0000-000000000002','visibility-two','Visibility two');
insert into public.event_competition_settings(event_id) select id from public.events where slug like 'visibility-%';
-- Fixture: one owner with several projects; team rules are tested in 47.
alter table public.projects disable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at)
select ('ae100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'ee100000-0000-0000-0000-000000000001',
 'de100000-0000-0000-0000-000000000004','Project '||n,
 case when n=54 then 'draft' when n=55 then 'withdrawn' else 'submitted' end,
 case when n=54 then null else now()-interval '1 hour' end
from generate_series(1,55)n;
alter table public.projects enable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at) values
 ('ae200000-0000-0000-0000-000000000001','ee100000-0000-0000-0000-000000000002','de100000-0000-0000-0000-000000000004','Other event','submitted',now());
insert into public.project_collaborators(project_id,event_id,user_id) values
 ('ae100000-0000-0000-0000-000000000053','ee100000-0000-0000-0000-000000000001','de100000-0000-0000-0000-000000000005');
insert into public.competition_tracks(id,event_id,name,active) values
 ('ce100000-0000-0000-0000-000000000001','ee100000-0000-0000-0000-000000000001','Inactive sponsor',false),
 ('ce100000-0000-0000-0000-000000000002','ee100000-0000-0000-0000-000000000001','Active sponsor',true);
insert into public.project_tracks(project_id,track_id,event_id)
select 'ae100000-0000-0000-0000-000000000053',id,event_id from public.competition_tracks where event_id='ee100000-0000-0000-0000-000000000001';
insert into public.event_judges(event_id,email,user_id) values
 ('ee100000-0000-0000-0000-000000000001','project-viewer-5@example.test','de100000-0000-0000-0000-000000000005');
select set_config('test.projects_before',(select md5(jsonb_agg(to_jsonb(p) order by id)::text) from public.projects p where event_id='ee100000-0000-0000-0000-000000000001'),true);

select plan(40);
select pg_temp.login(1);
select is(jsonb_array_length(pg_temp.list()->'projects'),50,'owner reads a bounded first page even while event disabled');
select is(pg_temp.list()->>'has_more','true','one extra row detects another page');
select is(pg_temp.list()->'projects'->0->>'id','ae100000-0000-0000-0000-000000000053','submission timestamp ties broken by project ID descending');
select is(pg_temp.detail()->'owner'->>'full_name','Person 4','owner display name returned without needing membership');
select is((pg_temp.detail()->'owner')-array['id','full_name'],'{}'::jsonb,'owner includes only identity/display name, not email or other profile fields');
select ok(not(pg_temp.detail()->'project' ? 'answers'),'no admissions answers in project payload');
select is(pg_temp.detail()->'collaborators'->0->>'full_name','Person 5','detail includes collaborator display names');
select is((pg_temp.detail()->'collaborators'->0)-array['id','full_name'],'{}'::jsonb,'no collaborator directory/contact or other profile data');
select ok(pg_temp.detail()->'tracks' @> '[{"name":"Inactive sponsor","active":false}]'::jsonb,'inactive selected tracks retained in detail');
select ok(pg_temp.list()->'projects'->0->'tracks' @> '[{"name":"Inactive sponsor","active":false}]'::jsonb,'inactive selected tracks retained in summary');
select is(pg_temp.detail(52)->'tracks','[]'::jsonb,'general-only project has empty sponsor tracks');
select is(pg_temp.detail(54),null::jsonb,'draft details excluded');
select is(pg_temp.detail(55),null::jsonb,'withdrawn detail excluded despite retained submitted timestamp');
select is(public.admin_submitted_project_detail('ee100000-0000-0000-0000-000000000002','ae100000-0000-0000-0000-000000000053'),null::jsonb,'wrong-event detail is not found');
select is(pg_temp.detail(999),null::jsonb,'missing project is not found');
select throws_ok($$select * from public.projects$$,'42501',null,'organizer still cannot read raw project table');
select throws_ok($$select * from public.project_collaborators$$,'42501',null,'organizer still cannot browse collaborator table');
reset role;
select pg_temp.login(2);
select is(jsonb_array_length(pg_temp.list(2)->'projects'),3,'organizer reads remaining second-page submissions');
select is(pg_temp.list(2)->>'has_more','false','last page has no next page');
select is(pg_temp.list(2)->'projects'->0->>'id','ae100000-0000-0000-0000-000000000003','second page ordering stable');
select is((select count(distinct p->>'id') from jsonb_array_elements((pg_temp.list()->'projects')||(pg_temp.list(2)->'projects')) p),53::bigint,'all submissions appear once; multiple projects per owner retained');
select is(pg_temp.list(3),' {"projects":[],"has_more":false}'::jsonb,'out-of-range page is empty');
select is(pg_temp.list(2147483647),' {"projects":[],"has_more":false}'::jsonb,'large valid page does not overflow offset arithmetic');
select throws_ok($$select pg_temp.list(0)$$,'22023','Invalid project page','zero page rejected');
select throws_ok($$select pg_temp.list(-1)$$,'22023','Invalid project page','negative page rejected');
select throws_ok($$select pg_temp.list(null)$$,'22023','Invalid project page','null page rejected');
select throws_ok($$select public.admin_submitted_projects('ee100000-0000-0000-0000-000000000001',2147483648::integer)$$,'22003',null,'overflow page parameter rejected by database integer type');
select is(jsonb_array_length(public.admin_submitted_projects('ee100000-0000-0000-0000-000000000002')->'projects'),1,'event list isolated');
reset role;
update public.event_competition_settings set enabled=true,project_submissions_open_at=now()-interval '3 days',
 project_submissions_close_at=now()-interval '2 days',judging_started_at=now()-interval '1 day',judging_close_at=now()-interval '1 hour'
where event_id='ee100000-0000-0000-0000-000000000001';
select pg_temp.login(2);
select is(jsonb_array_length(pg_temp.list()->'projects'),50,'closing/start/expired judging do not hide submissions from organizers');
reset role;
select pg_temp.login(3);
select throws_ok($$select pg_temp.list()$$,'42501','Not authorized','admissions reviewer cannot list projects');
select throws_ok($$select pg_temp.detail()$$,'42501','Not authorized','admissions reviewer cannot open detail');
reset role;
select pg_temp.login(4,'otp');
select throws_ok($$select pg_temp.list()$$,'42501','Not authorized','participant cannot use organizer list even if project owner');
select throws_ok($$select pg_temp.detail()$$,'42501','Not authorized','participant cannot use organizer detail');
reset role;
select pg_temp.login(5,'otp');
select throws_ok($$select pg_temp.list()$$,'42501','Not authorized','rostered judge cannot browse organizer submissions');
select throws_ok($$select pg_temp.detail()$$,'42501','Not authorized','rostered judge cannot use organizer detail');
reset role;
select pg_temp.login(1,'otp');
select throws_ok($$select pg_temp.list()$$,'42501','Not authorized','owner allowlisted email with OTP is not admin OAuth');
reset role;
set local role anon;
select throws_ok($$select public.admin_submitted_projects('ee100000-0000-0000-0000-000000000001')$$,'42501',null,'anonymous list execution denied');
select throws_ok($$select public.admin_submitted_project_detail('ee100000-0000-0000-0000-000000000001','ae100000-0000-0000-0000-000000000053')$$,'42501',null,'anonymous detail execution denied');
reset role;
select is((select md5(jsonb_agg(to_jsonb(p) order by id)::text) from public.projects p where event_id='ee100000-0000-0000-0000-000000000001'),current_setting('test.projects_before'),'organizer reads never mutate project data/status/timestamps');
select ok(not has_table_privilege('authenticated','public.projects','UPDATE'),'no direct project write privilege introduced');
select * from finish(true);
rollback;
