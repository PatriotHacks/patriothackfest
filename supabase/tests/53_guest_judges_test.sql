begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,email_confirmed_at)
select ('d5300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'guest-'||n||'@example.test',now() from generate_series(1,11)n;
insert into public.admin_allowlist(email,level) values('guest-1@example.test','organizer'),('guest-2@example.test','reviewer');
insert into public.events(id,slug,name) values('e5300000-0000-0000-0000-000000000001','guest','Guest');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,project_submissions_close_at,judging_close_at,general_reviews_per_project)
values('e5300000-0000-0000-0000-000000000001',true,now()-interval '3 days',now()-interval '2 days',now()+interval '1 day',2);
alter table public.projects disable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at)
select ('a5300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'e5300000-0000-0000-0000-000000000001',
 'd5300000-0000-0000-0000-000000000007','Project '||n,case when n=5 then 'withdrawn' else 'submitted' end,now() from generate_series(1,5)n;
alter table public.projects enable trigger projects_one_team;
insert into public.event_judges(id,event_id,email,user_id,capacity)
select ('b5300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'e5300000-0000-0000-0000-000000000001',
 'guest-'||n||'@example.test',('d5300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,case n when 3 then 3 when 6 then 1 else 4 end
from generate_series(3,6)n;
insert into public.judging_criteria(id,event_id,position,name) values('c5300000-0000-0000-0000-000000000001','e5300000-0000-0000-0000-000000000001',1,'Criterion A');
create function pg_temp.login(n integer,method text default 'otp') returns void language sql as $$
 select set_config('request.jwt.claims',json_build_object('sub','d5300000-0000-0000-0000-'||lpad(n::text,12,'0'),
  'email','guest-'||n||'@example.test','amr',json_build_array(json_build_object('method',method)))::text,true);
 select set_config('role','authenticated',true);
$$;
create function pg_temp.judge(n integer) returns uuid language sql as $$ select ('b5300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
create function pg_temp.project(n integer) returns uuid language sql as $$ select ('a5300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
create function pg_temp.guest(n integer,value boolean) returns jsonb language sql as $$
 select public.admin_set_event_judge_guest('e5300000-0000-0000-0000-000000000001',pg_temp.judge(n),value);
$$;
create function pg_temp.preview(n integer) returns jsonb language sql as $$
 select public.admin_judge_transfer_preview('e5300000-0000-0000-0000-000000000001',pg_temp.judge(n));
$$;
create function pg_temp.open(n integer) returns bigint language sql as $$
 select count(*) from public.judging_assignments where judge_id=pg_temp.judge(n) and not cancelled and submitted_at is null;
$$;
create function pg_temp.held(n integer,p integer) returns uuid language sql as $$
 select id from public.judging_assignments where judge_id=pg_temp.judge(n) and project_id=pg_temp.project(p) and not cancelled;
$$;
create function pg_temp.missing() returns bigint language sql as $$
 select sum(missing) from public.assignment_targets('e5300000-0000-0000-0000-000000000001');
$$;
select no_plan();

-- Guests never receive generated work.
select pg_temp.login(1,'oauth');
select is(pg_temp.guest(6,true),'{"moved":0,"dropped_drafts":0,"missing":0}'::jsonb,'make guest before judging is a no-op transfer');
select is((select j->>'guest' from jsonb_array_elements(public.admin_judge_roster('e5300000-0000-0000-0000-000000000001')) j
 where j->>'id'=pg_temp.judge(6)::text),'true','roster exposes guest');
select public.admin_start_judging('e5300000-0000-0000-0000-000000000001');
select is(public.admin_generate_assignments('e5300000-0000-0000-0000-000000000001'),'{"created":8,"missing":0}'::jsonb,'generation fills every slot');
reset role;
select is((select count(*) from public.judging_assignments where judge_id=pg_temp.judge(6)),0::bigint,'guest excluded from generation');
select is((select count(*) from public.assignment_candidates('e5300000-0000-0000-0000-000000000001',pg_temp.project(1),null) where judge_id=pg_temp.judge(6)),0::bigint,'guest is never a candidate');

-- Make guest: untouched and draft work moves, submitted stays.
select is(array[pg_temp.held(3,1) is not null,pg_temp.held(3,2) is not null,pg_temp.held(3,4) is not null],array[true,true,true],'fixture: judge 3 holds projects 1, 2 and 4');
update public.judging_assignments set submitted_at=now() where id=pg_temp.held(3,1);
insert into public.judging_scores(assignment_id,criterion_id,event_id,score) values
 (pg_temp.held(3,1),'c5300000-0000-0000-0000-000000000001','e5300000-0000-0000-0000-000000000001',4),
 (pg_temp.held(3,2),'c5300000-0000-0000-0000-000000000001','e5300000-0000-0000-0000-000000000001',3);
select set_config('test.draft',pg_temp.held(3,2)::text,true);
select pg_temp.login(1,'oauth');
select is(pg_temp.preview(3),'{"unsubmitted":2,"drafts":1}'::jsonb,'preview counts unsubmitted and drafts');
select is(pg_temp.guest(3,true),'{"moved":2,"dropped_drafts":1,"missing":0}'::jsonb,'make guest moves untouched and draft work');
reset role;
select is((select count(*) from public.judging_assignments where judge_id=pg_temp.judge(3) and not cancelled),1::bigint,'submitted review stays with the guest');
select is(pg_temp.held(3,1) is not null,true,'the kept review is the submitted one');
select is((select count(*) from public.judging_scores where assignment_id=current_setting('test.draft')::uuid),0::bigint,'draft scores discarded');
select is((select cancelled from public.judging_assignments where id=current_setting('test.draft')::uuid),true,'draft assignment cancelled');
select is((select count(*) from public.judging_scores where assignment_id=pg_temp.held(3,1)),1::bigint,'submitted scores kept');
select is(pg_temp.missing(),0::bigint,'replacements cover every context');
select is(pg_temp.held(4,2) is not null and pg_temp.held(5,4) is not null,true,'replacements go to eligible judges without existing pairs');

-- Missing when nobody has room.
select pg_temp.login(1,'oauth');
select is(pg_temp.guest(4,true),'{"moved":1,"dropped_drafts":0,"missing":3}'::jsonb,'unfillable contexts are counted as missing');
select is(public.admin_generate_assignments('e5300000-0000-0000-0000-000000000001'),'{"created":0,"missing":3}'::jsonb,'generation never refills guests');
select is(pg_temp.guest(6,false),'{"moved":0,"dropped_drafts":0,"missing":0}'::jsonb,'removing guest only clears the flag');
reset role;
select is((select count(*) from public.judging_assignments where judge_id=pg_temp.judge(6)),0::bigint,'removing guest assigns nothing');
select is(pg_temp.missing(),3::bigint,'targets still report missing slots');

-- Deactivating transfers the same way.
select is(pg_temp.open(5),4::bigint,'fixture: judge 5 holds four open assignments');
insert into public.judging_scores(assignment_id,criterion_id,event_id,score)
values(pg_temp.held(5,2),'c5300000-0000-0000-0000-000000000001','e5300000-0000-0000-0000-000000000001',2);
update public.judging_assignments set notes='Draft note' where id=pg_temp.held(5,3);
select set_config('test.note',pg_temp.held(5,3)::text,true);
select pg_temp.login(1,'oauth');
select is(pg_temp.preview(5),'{"unsubmitted":4,"drafts":2}'::jsonb,'preview counts note-only drafts');
select is(public.admin_save_event_judge('e5300000-0000-0000-0000-000000000001','guest-5@example.test','general',true,4,'{}',pg_temp.judge(5))->'transfer',
 'null'::jsonb,'saving an active judge transfers nothing');
select is(public.admin_save_event_judge('e5300000-0000-0000-0000-000000000001','guest-5@example.test','general',false,4,'{}',pg_temp.judge(5)),
 jsonb_build_object('id',pg_temp.judge(5),'transfer',jsonb_build_object('moved',1,'dropped_drafts',2,'missing',3)),'deactivate transfers work');
reset role;
select is(pg_temp.open(5),0::bigint,'deactivated judge holds no open work');
select is((select notes from public.judging_assignments where id=current_setting('test.note')::uuid),'','draft notes discarded');
select is((select count(*) from public.judging_assignments where judge_id=pg_temp.judge(6) and not cancelled),1::bigint,'non-guest with room took one');
select is(pg_temp.missing(),6::bigint,'missing grows by the unfillable slots');

-- Authorization.
select pg_temp.login(2,'oauth');
select throws_ok($$select pg_temp.guest(6,true)$$,'42501','Not authorized','reviewer cannot set guest');
select throws_ok($$select pg_temp.preview(6)$$,'42501','Not authorized','reviewer cannot preview');
reset role;
select pg_temp.login(6);
select throws_ok($$select pg_temp.guest(6,true)$$,'42501','Not authorized','judge cannot set guest');
select throws_ok($$select public.transfer_judge_assignments('e5300000-0000-0000-0000-000000000001',pg_temp.judge(6))$$,'42501',null,'transfer is internal');
reset role;
set local role anon;
select throws_ok($$select public.admin_set_event_judge_guest('e5300000-0000-0000-0000-000000000001','b5300000-0000-0000-0000-000000000006',true)$$,'42501',null,'anonymous cannot set guest');
reset role;
select pg_temp.login(1,'oauth');
select throws_ok($$select public.admin_set_event_judge_guest('e5300000-0000-0000-0000-000000000001','b5300000-0000-0000-0000-000000000099',true)$$,'PT404','Judge not found for this event','unknown judge rejected');
reset role;

-- One-time migration path: an already inactive judge with open work.
insert into public.event_judges(id,event_id,email,capacity,active) values
 (pg_temp.judge(10),'e5300000-0000-0000-0000-000000000001','guest-10@example.test',5,false),
 (pg_temp.judge(11),'e5300000-0000-0000-0000-000000000001','guest-11@example.test',5,true);
insert into public.judging_assignments(event_id,judge_id,project_id) values('e5300000-0000-0000-0000-000000000001',pg_temp.judge(10),pg_temp.project(3));
select is(public.transfer_judge_assignments('e5300000-0000-0000-0000-000000000001',pg_temp.judge(10)),
 '{"moved":1,"dropped_drafts":0,"missing":0}'::jsonb,'internal transfer reassigns an inactive judge');
select is(pg_temp.held(11,3) is not null,true,'least-loaded eligible judge receives it');
select is(public.transfer_judge_assignments('e5300000-0000-0000-0000-000000000001',pg_temp.judge(10)),
 '{"moved":0,"dropped_drafts":0,"missing":0}'::jsonb,'transfer is idempotent');

-- Guest portal reads.
select pg_temp.login(3);
select is(public.judge_event_access('guest')->>'guest','true','judge summary exposes guest');
select is((select string_agg(p->>'name',',') from jsonb_array_elements(public.judge_guest_projects('guest')) p),
 'Project 1,Project 2,Project 3,Project 4','guest lists submitted non-withdrawn projects');
select is(public.judge_guest_project('guest',pg_temp.project(2))->'project'->>'name','Project 2','guest reads a project');
select is(public.judge_guest_project('guest',pg_temp.project(2))->'team','[]'::jsonb,'team hidden unless judges_see_team');
select is(public.judge_guest_project('guest',pg_temp.project(5)),null::jsonb,'withdrawn project hidden');
select is(public.judge_guest_projects('other'),null::jsonb,'guest has no access to other events');
select throws_ok($$select public.judge_save_review('guest',current_setting('test.draft')::uuid,'{}'::jsonb,'',false)$$,'42501','Assignment unavailable','moved assignment can no longer be saved');
reset role;
update public.event_competition_settings set judges_see_team=true where event_id='e5300000-0000-0000-0000-000000000001';
select pg_temp.login(3);
select is(jsonb_array_length(public.judge_guest_project('guest',pg_temp.project(2))->'team'),1,'team visible when judges_see_team');
reset role;
select pg_temp.login(6);
select is(public.judge_event_access('guest')->>'guest','false','regular judge is not a guest');
select is(public.judge_guest_projects('guest'),null::jsonb,'non-guest judge gets no project list');
select is(public.judge_guest_project('guest',pg_temp.project(1)),null::jsonb,'non-guest judge gets no project');
reset role;
select pg_temp.login(7);
select is(public.judge_guest_projects('guest'),null::jsonb,'participant gets no project list');
select is(public.judge_guest_project('guest',pg_temp.project(1)),null::jsonb,'participant gets no project');
reset role;
set local role anon;
select throws_ok($$select public.judge_guest_projects('guest')$$,'42501',null,'anonymous list denied');
select throws_ok($$select public.judge_guest_project('guest','a5300000-0000-0000-0000-000000000001')$$,'42501',null,'anonymous project denied');
reset role;
update public.event_judges set active=false where id=pg_temp.judge(4);
select pg_temp.login(4);
select is(public.judge_guest_projects('guest'),null::jsonb,'inactive guest gets nothing');
reset role;
update public.event_judges set active=true where id=pg_temp.judge(4);
update public.event_competition_settings set judging_started_at=null,project_submissions_close_at=now()+interval '1 day',judging_close_at=now()+interval '2 days' where event_id='e5300000-0000-0000-0000-000000000001';
select pg_temp.login(4);
select is(public.judge_guest_projects('guest'),'[]'::jsonb,'no projects before submissions close');
reset role;

select * from finish();
rollback;
