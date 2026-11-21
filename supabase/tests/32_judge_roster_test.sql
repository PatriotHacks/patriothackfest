begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(p_email text,p_method text default 'oauth') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub',(select id from public.profiles where email=p_email),'email',p_email,'amr',json_build_array(json_build_object('method',p_method)))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.save_judge(p_kind text default 'sponsor',p_tracks uuid[] default array['cf100000-0000-0000-0000-000000000001'::uuid],p_active boolean default true,p_capacity integer default 20,p_email text default 'guest@example.test')
returns uuid language sql as $$
  select (public.admin_save_event_judge('ef100000-0000-0000-0000-000000000001',p_email,p_kind,p_active,p_capacity,p_tracks,nullif(current_setting('test.judge',true),'')::uuid)->>'id')::uuid;
$$;
insert into auth.users(id,email) values
 ('df100000-0000-0000-0000-000000000001','roster-owner@example.test'),
 ('df100000-0000-0000-0000-000000000002','roster-organizer@example.test'),
 ('df100000-0000-0000-0000-000000000003','roster-reviewer@example.test'),
 ('df100000-0000-0000-0000-000000000004','roster-participant@example.test');
insert into public.admin_allowlist(email,level) values ('roster-owner@example.test','owner'),('roster-organizer@example.test','organizer'),('roster-reviewer@example.test','reviewer');
insert into public.events(id,slug,name) values
 ('ef100000-0000-0000-0000-000000000001','roster-one','Roster one'),
 ('ef100000-0000-0000-0000-000000000002','roster-two','Roster two');
insert into public.event_competition_settings(event_id) select id from public.events where slug like 'roster-%';
insert into public.competition_tracks(id,event_id,name,active) values
 ('cf100000-0000-0000-0000-000000000001','ef100000-0000-0000-0000-000000000001','A',true),
 ('cf100000-0000-0000-0000-000000000002','ef100000-0000-0000-0000-000000000001','B',true),
 ('cf100000-0000-0000-0000-000000000003','ef100000-0000-0000-0000-000000000001','Inactive',false),
 ('cf100000-0000-0000-0000-000000000004','ef100000-0000-0000-0000-000000000002','Foreign',true);

select plan(30);
select pg_temp.login('roster-reviewer@example.test');
select throws_ok($$select public.admin_judge_roster('ef100000-0000-0000-0000-000000000001')$$,'42501','Not authorized','reviewer cannot read roster');
select throws_ok($$select pg_temp.save_judge()$$,'42501','Not authorized','reviewer cannot save roster');
reset role;
select pg_temp.login('roster-participant@example.test','otp');
select throws_ok($$select pg_temp.save_judge()$$,'42501','Not authorized','participant cannot manage judges');
reset role;
select pg_temp.login('roster-owner@example.test','otp');
select throws_ok($$select pg_temp.save_judge()$$,'42501','Not authorized','owner email without OAuth cannot manage judges');
reset role;
select pg_temp.login('roster-organizer@example.test');
select is(public.admin_judge_roster('ef100000-0000-0000-0000-000000000001'),'[]'::jsonb,'empty roster readable to organizer');
select set_config('test.judge',public.admin_save_event_judge('ef100000-0000-0000-0000-000000000001',' Guest@Example.Test ','sponsor',true,20,array['cf100000-0000-0000-0000-000000000001'::uuid])->>'id',true);
select is(public.admin_judge_roster('ef100000-0000-0000-0000-000000000001')->0->>'email','guest@example.test','email normalized without requiring registered account');
select is(public.admin_judge_roster('ef100000-0000-0000-0000-000000000001')->0->>'bound','false','new judge is not bound to an arbitrary user');
select throws_ok($$select public.admin_save_event_judge('ef100000-0000-0000-0000-000000000001','GUEST@example.test','general',true,20)$$,'P0001','This email or account is already on the event judge roster','duplicate emails rejected case-insensitively');
select throws_ok($$select pg_temp.save_judge('general')$$,'P0001','General judges cannot have sponsor tracks','general scopes rejected');
select throws_ok($$select pg_temp.save_judge('sponsor','{}')$$,'P0001','Select at least one sponsor track','sponsor needs a track');
select throws_ok($$select pg_temp.save_judge('sponsor',array['cf100000-0000-0000-0000-000000000004'::uuid])$$,'P0001','New sponsor scopes must be active tracks for this event','cross-event scopes rejected');
select throws_ok($$select pg_temp.save_judge('sponsor',array['cf100000-0000-0000-0000-000000000003'::uuid])$$,'P0001','New sponsor scopes must be active tracks for this event','new inactive scopes rejected');
select throws_ok($$select pg_temp.save_judge(p_capacity=>0)$$,'P0001','Capacity must be between 1 and 1000','capacity lower bound');
select throws_ok($$select pg_temp.save_judge(p_capacity=>1001)$$,'P0001','Capacity must be between 1 and 1000','capacity upper bound');
select throws_ok($$select pg_temp.save_judge(p_email=>'bad')$$,'P0001','Enter a valid judge email','invalid email rejected');
select throws_ok($$select public.admin_save_event_judge('ef100000-0000-0000-0000-000000000002','guest@example.test','general',true,20,'{}',current_setting('test.judge')::uuid)$$,'PT404','Judge not found for this event','judge cannot move between events');
select lives_ok($$select pg_temp.save_judge('sponsor',array['cf100000-0000-0000-0000-000000000001'::uuid,'cf100000-0000-0000-0000-000000000002'::uuid])$$,'multiple scopes can be saved');
select is(public.admin_judge_roster('ef100000-0000-0000-0000-000000000002'),'[]'::jsonb,'other event roster isolated');
reset role;
-- Privileged fixtures only: actual assignment creation is Person A2.
insert into public.projects(id,event_id,owner_user_id) values('af100000-0000-0000-0000-000000000001','ef100000-0000-0000-0000-000000000001','df100000-0000-0000-0000-000000000004');
insert into public.project_tracks(project_id,track_id,event_id) values('af100000-0000-0000-0000-000000000001','cf100000-0000-0000-0000-000000000001','ef100000-0000-0000-0000-000000000001');
insert into public.judging_assignments(event_id,judge_id,project_id,track_id,cancelled) values('ef100000-0000-0000-0000-000000000001',current_setting('test.judge')::uuid,'af100000-0000-0000-0000-000000000001','cf100000-0000-0000-0000-000000000001',true);
-- A manually populated legacy row may use different casing; that is not an identity change.
update public.event_judges set email='GUEST@example.test' where id=current_setting('test.judge')::uuid;
update public.competition_tracks set active=false where id='cf100000-0000-0000-0000-000000000001';
update public.event_competition_settings set judging_started_at=now() where event_id='ef100000-0000-0000-0000-000000000001';
select pg_temp.login('roster-owner@example.test');
select lives_ok($$select pg_temp.save_judge(p_active=>false,p_capacity=>1)$$,'can deactivate after judging starts and retain inactive historical scope');
select is(public.admin_judge_roster('ef100000-0000-0000-0000-000000000001')->0->>'active','false','deactivated status persisted');
select ok((public.admin_judge_roster('ef100000-0000-0000-0000-000000000001')->0->'scopes') @> '[{"id":"cf100000-0000-0000-0000-000000000001","active":false,"referenced":true}]'::jsonb,'referenced inactive scope visible');
select throws_ok($$select pg_temp.save_judge('general','{}')$$,'P0001','Cannot change judge type after assignments exist','kind change cannot invalidate assignment');
select throws_ok($$select pg_temp.save_judge('sponsor',array['cf100000-0000-0000-0000-000000000002'::uuid],true)$$,'P0001','Cannot remove a sponsor track referenced by an assignment','even cancelled assignment protects scope');
select throws_ok($$select pg_temp.save_judge(p_email=>'replacement@example.test')$$,'P0001','Cannot change an unbound judge email after assignments exist','unbound identity frozen after assignment');
select is(public.admin_judge_roster('ef100000-0000-0000-0000-000000000001')->0->>'active','false','failed saves do not partially reactivate judge');
select throws_ok($$update public.event_judges set active=true$$,'42501',null,'direct mutations cannot bypass RPC');
select throws_ok($$select * from public.judge_track_scopes$$,'42501',null,'scope table remains private');
reset role;
select is((select count(*) from public.judging_assignments where judge_id=current_setting('test.judge')::uuid),1::bigint,'assignment survives roster edits');
set local role anon;
select throws_ok($$select public.admin_judge_roster('ef100000-0000-0000-0000-000000000001')$$,'42501',null,'anonymous roster reads denied');
select throws_ok($$select pg_temp.save_judge()$$,'42501',null,'anonymous writes denied');
select * from finish(true);
rollback;
