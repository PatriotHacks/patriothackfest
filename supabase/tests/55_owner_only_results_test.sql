begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer,method text default 'oauth') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object(
    'sub','d5500000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','own-'||n||'@example.test',
    'amr',json_build_array(json_build_object('method',method)),
    'app_metadata',json_build_object('provider',case when method='oauth' then 'google' else 'email' end))::text,true);
  select set_config('role','authenticated',true);
$$;
insert into auth.users(id,email,email_confirmed_at)
select ('d5500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'own-'||n||'@example.test',now() from generate_series(1,5)n;
insert into public.admin_allowlist(email,level) values
  ('own-1@example.test','owner'),('own-2@example.test','organizer'),('own-3@example.test','reviewer');
insert into public.events(id,slug,name) values('e5500000-0000-0000-0000-000000000001','owner-results','Owner results');
insert into public.event_competition_settings(event_id) values('e5500000-0000-0000-0000-000000000001');
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at) values
  ('a5500000-0000-0000-0000-000000000001','e5500000-0000-0000-0000-000000000001',
   'd5500000-0000-0000-0000-000000000004','Scored','submitted',now());
insert into public.event_judges(id,event_id,email,user_id) values
  ('b5500000-0000-0000-0000-000000000001','e5500000-0000-0000-0000-000000000001',
   'own-5@example.test','d5500000-0000-0000-0000-000000000005');
insert into public.judging_criteria(id,event_id,position,name) values
  ('c5500000-0000-0000-0000-000000000001','e5500000-0000-0000-0000-000000000001',1,'Criterion');
insert into public.judging_assignments(id,event_id,judge_id,project_id,submitted_at,notes) values
  ('f5500000-0000-0000-0000-000000000001','e5500000-0000-0000-0000-000000000001',
   'b5500000-0000-0000-0000-000000000001','a5500000-0000-0000-0000-000000000001',now(),'Private note');
insert into public.judging_scores(assignment_id,criterion_id,event_id,score) values
  ('f5500000-0000-0000-0000-000000000001','c5500000-0000-0000-0000-000000000001',
   'e5500000-0000-0000-0000-000000000001',4.5);
create function pg_temp.results() returns jsonb language sql as $$
  select public.admin_judging_results('e5500000-0000-0000-0000-000000000001')
$$;
select plan(10);

select pg_temp.login(1);
select is((pg_temp.results()->'projects'->0->>'average_score')::numeric,4.5,'owner reads average score');
select is(pg_temp.results()->'projects'->0->>'project_name','Scored','owner reads ranked project');
reset role;

select pg_temp.login(2);
select throws_ok($$select pg_temp.results()$$,'42501','Not authorized','organizer denied results');
select lives_ok($$select public.admin_assignment_overview('e5500000-0000-0000-0000-000000000001')$$,
  'organizer still reads assignment coverage');
select lives_ok($$select public.admin_judge_roster('e5500000-0000-0000-0000-000000000001')$$,
  'organizer still reads judge roster');
reset role;

select pg_temp.login(3);
select throws_ok($$select pg_temp.results()$$,'42501','Not authorized','reviewer denied results');
reset role;

select pg_temp.login(4,'otp');
select throws_ok($$select pg_temp.results()$$,'42501','Not authorized','participant denied results');
reset role;

select pg_temp.login(5,'otp');
select throws_ok($$select pg_temp.results()$$,'42501','Not authorized','judge denied results');
reset role;

select pg_temp.login(1,'otp');
select throws_ok($$select pg_temp.results()$$,'42501','Not authorized','owner email without OAuth denied');
reset role;

set local role anon;
select throws_ok($$select public.admin_judging_results('e5500000-0000-0000-0000-000000000001')$$,'42501',null,
  'anonymous execute denied');
reset role;

select * from finish();
rollback;
