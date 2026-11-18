begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,email_confirmed_at)
select ('dc200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'c2-read-'||n||'@example.test',now() from generate_series(1,5)n;
insert into public.events(id,slug,name) values
 ('ec200000-0000-0000-0000-000000000001','c2-reads','C2 reads'),
 ('ec200000-0000-0000-0000-000000000002','c2-other','C2 other');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,project_submissions_close_at,judging_close_at)
select id,true,now()-interval '3 days',now()-interval '2 days',now()+interval '1 day' from public.events where slug like 'c2-%';
-- Fixture: one owner with several projects; team rules are tested in 47.
alter table public.projects disable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at)
select ('ac200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'ec200000-0000-0000-0000-000000000001',
 'dc200000-0000-0000-0000-000000000001','Project '||n,case when n=3 then 'draft' when n=4 then 'withdrawn' else 'submitted' end,now() from generate_series(1,4)n;
alter table public.projects enable trigger projects_one_team;
insert into public.competition_tracks(id,event_id,name) values
 ('cc200000-0000-0000-0000-000000000001','ec200000-0000-0000-0000-000000000001','Track one'),
 ('cc200000-0000-0000-0000-000000000002','ec200000-0000-0000-0000-000000000001','Track two');
insert into public.project_tracks(project_id,track_id,event_id) select 'ac200000-0000-0000-0000-000000000001',id,event_id from public.competition_tracks where event_id='ec200000-0000-0000-0000-000000000001';
insert into public.event_judges(id,event_id,email,user_id,kind)
select ('bc200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'ec200000-0000-0000-0000-000000000001',
 'c2-read-'||n||'@example.test',('dc200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,case when n=3 then 'sponsor' else 'general' end from generate_series(1,4)n;
insert into public.judge_track_scopes(judge_id,track_id,event_id) select 'bc200000-0000-0000-0000-000000000003',id,event_id from public.competition_tracks where event_id='ec200000-0000-0000-0000-000000000001';
insert into public.judging_assignments(id,event_id,judge_id,project_id,cancelled)
select ('fc200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'ec200000-0000-0000-0000-000000000001',
 'bc200000-0000-0000-0000-000000000002',('ac200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,n=2 from generate_series(1,4)n;
insert into public.judging_assignments(event_id,judge_id,project_id) values
 ('ec200000-0000-0000-0000-000000000001','bc200000-0000-0000-0000-000000000001','ac200000-0000-0000-0000-000000000001'),
 ('ec200000-0000-0000-0000-000000000001','bc200000-0000-0000-0000-000000000004','ac200000-0000-0000-0000-000000000001');
insert into public.judging_assignments(event_id,judge_id,project_id,track_id) select event_id,'bc200000-0000-0000-0000-000000000003',project_id,track_id from public.project_tracks where project_id='ac200000-0000-0000-0000-000000000001';
create function pg_temp.login(n integer,p_method text default 'otp') returns void language sql as $$
 select set_config('request.jwt.claims',json_build_object('sub','dc200000-0000-0000-0000-'||lpad(n::text,12,'0'),'email','c2-read-'||n||'@example.test','amr',json_build_array(json_build_object('method',p_method)))::text,true);
 select set_config('role','authenticated',true);
$$;
create function pg_temp.detail() returns jsonb language sql as $$select public.judge_assignment('c2-reads','fc200000-0000-0000-0000-000000000001')$$;
select no_plan();
select pg_temp.login(2);
select is(public.judge_queue('c2-reads')->>'total','0','no project reads before judging starts');
select is(pg_temp.detail(),null::jsonb,'detail unavailable before start');
reset role;
update public.event_competition_settings set judging_started_at=now() where event_id='ec200000-0000-0000-0000-000000000001';
select pg_temp.login(2);
select is(public.judge_queue('c2-reads')->>'total','1','only own noncancelled submitted project assignments count');
select is(public.judge_queue('c2-reads')->>'completed','0','real unfinished count');
select is(pg_temp.detail()->'project'->>'name','Project 1','assigned content visible');
select is(pg_temp.detail()->'assignment'->>'notes','','own scorecard visible');
select ok(not ((pg_temp.detail()->'project') ? 'owner_user_id'),'no profile identifiers in project response');
select throws_ok($$select * from public.judging_assignments$$,'42501',null,'no raw scorecard directory');
select is(public.judge_queue('c2-other'),null::jsonb,'cross-event denied');
select is(public.judge_assignment('c2-other','fc200000-0000-0000-0000-000000000001'),null::jsonb,'cannot relabel assignment event');
select is(public.judge_assignment('c2-reads','fc200000-0000-0000-0000-000000000002'),null::jsonb,'cancelled hidden');
select is(public.judge_assignment('c2-reads','fc200000-0000-0000-0000-000000000003'),null::jsonb,'draft hidden');
select is(public.judge_assignment('c2-reads','fc200000-0000-0000-0000-000000000004'),null::jsonb,'withdrawn hidden');
reset role;
select pg_temp.login(4);
select is(pg_temp.detail(),null::jsonb,'another judge cannot read this scorecard even on same project');
reset role;
select pg_temp.login(1);
select is(public.judge_queue('c2-reads')->>'total','0','owner cannot self-review even with malformed assignment');
reset role;
select pg_temp.login(3);
select is(public.judge_queue('c2-reads')->>'total','2','two sponsor contexts count separately');
select ok((public.judge_queue('c2-reads')->'assignments') @> '[{"track_name":"Track one"}]'::jsonb,'sponsor context labeled');
select throws_ok($$select public.current_judge_assignments('ec200000-0000-0000-0000-000000000001')$$,'42501',null,'helper remains private');
reset role;
update public.event_judges set active=false where id='bc200000-0000-0000-0000-000000000002';
select pg_temp.login(2);
select is(public.judge_queue('c2-reads'),null::jsonb,'revoked session loses queue');
select is(pg_temp.detail(),null::jsonb,'revoked session loses details');
reset role;
update public.event_judges set active=true where id='bc200000-0000-0000-0000-000000000002';
update public.event_competition_settings set judging_close_at=now()-interval '1 hour' where event_id='ec200000-0000-0000-0000-000000000001';
select pg_temp.login(2);
select is(public.judge_queue('c2-reads')->>'total','1','expired queue still readable');
select isnt(pg_temp.detail(),null::jsonb,'expired saved scorecard still readable');
reset role;
-- Temporarily unfreeze only this transactional fixture to install a conflict.
update public.event_competition_settings set judging_started_at=null where event_id='ec200000-0000-0000-0000-000000000001';
insert into public.project_collaborators(project_id,event_id,user_id) values('ac200000-0000-0000-0000-000000000001','ec200000-0000-0000-0000-000000000001','dc200000-0000-0000-0000-000000000002');
update public.event_competition_settings set judging_started_at=now() where event_id='ec200000-0000-0000-0000-000000000001';
select pg_temp.login(2);
select is(public.judge_queue('c2-reads')->>'total','0','collaborator conflict denied');
reset role;
select pg_temp.login(3,'oauth');
select is(public.judge_queue('c2-reads'),null::jsonb,'wrong authentication method denied');
reset role;
update auth.users set email_confirmed_at=null where id='dc200000-0000-0000-0000-000000000003';
select pg_temp.login(3);
select is(public.judge_queue('c2-reads'),null::jsonb,'unconfirmed current email denied');
reset role;
select pg_temp.login(5);
select is(public.judge_queue('c2-reads'),null::jsonb,'unlisted user denied');
reset role;
set local role anon;
select throws_ok($$select public.judge_queue('c2-reads')$$,'42501',null,'anonymous reads denied');
reset role;
select * from finish(true);
rollback;
