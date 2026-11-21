begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,email_confirmed_at) values('da300000-0000-0000-0000-000000000001','a2-gen-admin@example.test',now()),('da300000-0000-0000-0000-000000000002','a2-gen-owner@example.test',now());
insert into public.admin_allowlist(email,level) values('a2-gen-admin@example.test','organizer');
insert into public.events(id,slug,name) values('ea300000-0000-0000-0000-000000000001','a2-generation','A2 generation');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,project_submissions_close_at,judging_close_at,general_reviews_per_project)
values('ea300000-0000-0000-0000-000000000001',true,now()-interval '2 days',now()-interval '1 day',now()+interval '1 day',2);
-- Fixture: one owner with several projects; team rules are tested in 47.
alter table public.projects disable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at)
select ('aa300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'ea300000-0000-0000-0000-000000000001','da300000-0000-0000-0000-000000000002','Project '||n,case when n=3 then 'draft' when n=4 then 'withdrawn' else 'submitted' end,now() from generate_series(1,4)n;
alter table public.projects enable trigger projects_one_team;
insert into public.competition_tracks(id,event_id,name) values('ca300000-0000-0000-0000-000000000001','ea300000-0000-0000-0000-000000000001','Popular'),('ca300000-0000-0000-0000-000000000002','ea300000-0000-0000-0000-000000000001','Scarce');
insert into public.project_tracks(project_id,track_id,event_id) select 'aa300000-0000-0000-0000-000000000001',id,event_id from public.competition_tracks where event_id='ea300000-0000-0000-0000-000000000001';
insert into public.event_judges(id,event_id,email,kind,capacity) values
 ('ba300000-0000-0000-0000-000000000001','ea300000-0000-0000-0000-000000000001','general1@example.test','general',2),
 ('ba300000-0000-0000-0000-000000000002','ea300000-0000-0000-0000-000000000001','general2@example.test','general',1),
 ('ba300000-0000-0000-0000-000000000003','ea300000-0000-0000-0000-000000000001','sponsor1@example.test','sponsor',1),
 ('ba300000-0000-0000-0000-000000000004','ea300000-0000-0000-0000-000000000001','sponsor2@example.test','sponsor',1),
 ('ba300000-0000-0000-0000-000000000005','ea300000-0000-0000-0000-000000000001','A2-GEN-OWNER@example.test','general',20);
insert into public.judge_track_scopes(judge_id,track_id,event_id) values
 ('ba300000-0000-0000-0000-000000000003','ca300000-0000-0000-0000-000000000001','ea300000-0000-0000-0000-000000000001'),
 ('ba300000-0000-0000-0000-000000000003','ca300000-0000-0000-0000-000000000002','ea300000-0000-0000-0000-000000000001'),
 ('ba300000-0000-0000-0000-000000000004','ca300000-0000-0000-0000-000000000001','ea300000-0000-0000-0000-000000000001');
create function pg_temp.generate() returns jsonb language sql as $$select public.admin_generate_assignments('ea300000-0000-0000-0000-000000000001')$$;
insert into public.judging_criteria(event_id,position,name) values('ea300000-0000-0000-0000-000000000001',1,'Criterion A');
select plan(15);
select set_config('request.jwt.claims','{"sub":"da300000-0000-0000-0000-000000000001","email":"a2-gen-admin@example.test","amr":[{"method":"oauth"}]}',true);
set local role authenticated;
select throws_ok($$select pg_temp.generate()$$,'P0001','Start judging before managing assignments','must start first');
select public.admin_start_judging('ea300000-0000-0000-0000-000000000001');
select is(pg_temp.generate(),'{"created":5,"missing":1}'::jsonb,'generates sponsor/general queues with honest capacity shortage');
select is(pg_temp.generate(),'{"created":0,"missing":1}'::jsonb,'repeat generation preserves queues');
reset role;
select is((select judge_id from public.judging_assignments where track_id='ca300000-0000-0000-0000-000000000002'),'ba300000-0000-0000-0000-000000000003'::uuid,'scarce pool receives shared judge first');
select is((select judge_id from public.judging_assignments where track_id='ca300000-0000-0000-0000-000000000001'),'ba300000-0000-0000-0000-000000000004'::uuid,'other sponsor uses remaining pool');
select is((select count(*) from public.judging_assignments where project_id in ('aa300000-0000-0000-0000-000000000003','aa300000-0000-0000-0000-000000000004')),0::bigint,'drafts and withdrawn excluded');
select is((select count(*) from public.judging_assignments where judge_id='ba300000-0000-0000-0000-000000000005'),0::bigint,'unbound self-review excluded');
select is((select count(*) from public.judging_assignments where judge_id='ba300000-0000-0000-0000-000000000001'),2::bigint,'least load and ID tie-break fill general capacity');
update public.judging_assignments set submitted_at=now() where judge_id='ba300000-0000-0000-0000-000000000002';
update public.event_judges set capacity=2 where id='ba300000-0000-0000-0000-000000000002';
set local role authenticated;
select is(pg_temp.generate(),'{"created":1,"missing":0}'::jsonb,'capacity increase fills only missing work');
reset role;
select is((select count(*) from public.judging_assignments where judge_id='ba300000-0000-0000-0000-000000000002'),2::bigint,'completed assignment consumes capacity');
update public.judging_assignments set cancelled=true where judge_id='ba300000-0000-0000-0000-000000000001' and project_id='aa300000-0000-0000-0000-000000000002';
set local role authenticated;
select is(pg_temp.generate(),'{"created":0,"missing":1}'::jsonb,'cancelled pair never regenerated');
reset role;
select is((select count(*) from public.judging_assignments where submitted_at is not null),1::bigint,'completed review preserved');
update public.event_competition_settings set general_reviews_per_project=1 where event_id='ea300000-0000-0000-0000-000000000001';
set local role authenticated;
select is(pg_temp.generate(),'{"created":0,"missing":0}'::jsonb,'target reduction does not delete existing rows');
reset role;
select is((select count(*) from public.judging_assignments),6::bigint,'all historical pairs retained');
set local role anon;
select throws_ok($$select pg_temp.generate()$$,'42501',null,'anonymous cannot generate');
select * from finish(true);
rollback;
