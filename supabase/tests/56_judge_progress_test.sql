begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer,method text default 'oauth') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object(
    'sub','d5600000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','prog-'||n||'@example.test',
    'amr',json_build_array(json_build_object('method',method)),
    'app_metadata',json_build_object('provider',case when method='oauth' then 'google' else 'email' end))::text,true);
  select set_config('role','authenticated',true);
$$;
insert into auth.users(id,email,email_confirmed_at)
select ('d5600000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'prog-'||n||'@example.test',now() from generate_series(1,4)n;
insert into public.admin_allowlist(email,level) values('prog-1@example.test','organizer'),('prog-2@example.test','reviewer');
insert into public.events(id,slug,name) values('e5600000-0000-0000-0000-000000000001','progress','Progress');
insert into public.event_competition_settings(event_id) values('e5600000-0000-0000-0000-000000000001');
alter table public.projects disable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at)
select ('a5600000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'e5600000-0000-0000-0000-000000000001',
  'd5600000-0000-0000-0000-000000000004','Project '||n,'submitted',now() from generate_series(1,5)n;
alter table public.projects enable trigger projects_one_team;
-- 1 active, 2 active guest, 3 inactive with open work, 4 inactive all submitted, 5 active unassigned, 6 active only cancelled
insert into public.event_judges(id,event_id,email,active,guest)
select ('b5600000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'e5600000-0000-0000-0000-000000000001',
  'judge-'||n||'@example.test',n not in (3,4),n=2 from generate_series(1,6)n;
insert into public.judging_criteria(id,event_id,position,name) values
  ('c5600000-0000-0000-0000-000000000001','e5600000-0000-0000-0000-000000000001',1,'Criterion');
create function pg_temp.assign(j integer,p integer,submitted boolean default false,notes text default '',cancelled boolean default false)
returns uuid language sql as $$
  insert into public.judging_assignments(event_id,judge_id,project_id,submitted_at,notes,cancelled)
  values('e5600000-0000-0000-0000-000000000001',('b5600000-0000-0000-0000-'||lpad(j::text,12,'0'))::uuid,
    ('a5600000-0000-0000-0000-'||lpad(p::text,12,'0'))::uuid,case when submitted then now() end,notes,cancelled)
  returning id;
$$;
select pg_temp.assign(1,1,true);
select pg_temp.assign(1,2,false,'draft note');
insert into public.judging_scores(assignment_id,criterion_id,event_id,score)
select pg_temp.assign(1,3),'c5600000-0000-0000-0000-000000000001','e5600000-0000-0000-0000-000000000001',3;
select pg_temp.assign(1,4);
select pg_temp.assign(1,5,false,'',true);
select pg_temp.assign(2,1);
select pg_temp.assign(3,2);
select pg_temp.assign(4,3,true);
select pg_temp.assign(6,4,false,'',true);
create function pg_temp.progress() returns jsonb language sql as $$
  select public.admin_judge_progress('e5600000-0000-0000-0000-000000000001')
$$;
select plan(7);

select pg_temp.login(1);
select is(jsonb_array_length(pg_temp.progress()),2,'only active non-guest judges with work and inactive judges with open work');
select is(pg_temp.progress()->0,jsonb_build_object('judge_id','b5600000-0000-0000-0000-000000000001',
  'email','judge-1@example.test','active',true,'completed',1,'in_progress',2,'not_started',1),
  'splits completed, drafts and untouched; cancelled excluded');
select is(pg_temp.progress()->1,jsonb_build_object('judge_id','b5600000-0000-0000-0000-000000000003',
  'email','judge-3@example.test','active',false,'completed',0,'in_progress',0,'not_started',1),
  'inactive judge with open work is listed');
select is(public.admin_judge_progress('e5600000-0000-0000-0000-000000000009'),'[]'::jsonb,'unknown event is empty');
reset role;

select pg_temp.login(2);
select throws_ok($$select pg_temp.progress()$$,'42501','Not authorized','reviewer denied');
reset role;

select pg_temp.login(4,'otp');
select throws_ok($$select pg_temp.progress()$$,'42501','Not authorized','participant denied');
reset role;

set local role anon;
select throws_ok($$select public.admin_judge_progress('e5600000-0000-0000-0000-000000000001')$$,'42501',null,
  'anonymous execute denied');
reset role;

select * from finish();
rollback;
