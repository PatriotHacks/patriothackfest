begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer) returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','dc100000-0000-0000-0000-'||lpad(n::text,12,'0'),'amr','[{"method":"otp"}]'::jsonb)::text,true);
  select set_config('role','authenticated',true);
$$;
insert into auth.users(id,email,raw_user_meta_data)
select ('dc100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'collaborator-'||n||'@example.test',jsonb_build_object('full_name','Collaborator '||n)
from generate_series(1,3)n;
insert into public.events(id,slug,name) values ('ec100000-0000-0000-0000-000000000001','collaborator-test','Collaborators');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,judging_close_at)
values ('ec100000-0000-0000-0000-000000000001',true,now()+interval '1 day',now()+interval '4 days');
insert into public.forms(id,event_id,role,title) values ('fc100000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000001','participant','Test');
insert into public.applications(id,user_id,event_id,role,form_id,status,submitted_at)
select ('ac100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('dc100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
  'ec100000-0000-0000-0000-000000000001','participant','fc100000-0000-0000-0000-000000000001','submitted',now()
from generate_series(1,3)n;
insert into public.application_decisions(application_id,decision)
select id,case when user_id='dc100000-0000-0000-0000-000000000003' then 'rejected'::public.decision else 'accepted'::public.decision end
from public.applications where event_id='ec100000-0000-0000-0000-000000000001';

select plan(17);
select pg_temp.login(1);
select set_config('test.project',public.participant_create_project('ec100000-0000-0000-0000-000000000001')::text,true);
select lives_ok($$select public.participant_add_project_collaborator(current_setting('test.project')::uuid,'  COLLABORATOR-2@example.test  ')$$,'exact email is case insensitive and permits pre-opening roster setup');
select is(jsonb_array_length(public.participant_project_detail(current_setting('test.project')::uuid,'ec100000-0000-0000-0000-000000000001')->'collaborators'),1,'added person appears in roster');
select throws_ok($$select public.participant_add_project_collaborator(current_setting('test.project')::uuid,'collaborator-2@example.test')$$,'P0001','This participant is already a collaborator','duplicate membership rejected');
select throws_ok($$select public.participant_add_project_collaborator(current_setting('test.project')::uuid,'missing@example.test')$$,'P0001','Cannot add this collaborator. Use the email of an eligible registered participant.','missing address has generic error');
select throws_ok($$select public.participant_add_project_collaborator(current_setting('test.project')::uuid,'collaborator-3@example.test')$$,'P0001','Cannot add this collaborator. Use the email of an eligible registered participant.','ineligible address has same generic error');
select throws_ok($$select public.participant_add_project_collaborator(current_setting('test.project')::uuid,'collaborator-1@example.test')$$,'P0001','Cannot add this collaborator. Use the email of an eligible registered participant.','owner cannot add self');
reset role;
select pg_temp.login(2);
select ok(public.participant_project_detail(current_setting('test.project')::uuid,'ec100000-0000-0000-0000-000000000001') is not null,'collaborator reads project');
select throws_ok($$select public.participant_remove_project_collaborator(current_setting('test.project')::uuid,'dc100000-0000-0000-0000-000000000001')$$,'PT404','Project not found','collaborator cannot manage roster');
select is((select count(*) from public.profiles),1::bigint,'no broader profile read grant');
reset role;
select pg_temp.login(1);
select lives_ok($$select public.participant_remove_project_collaborator(current_setting('test.project')::uuid,'dc100000-0000-0000-0000-000000000002')$$,'owner removes collaborator');
reset role;
select pg_temp.login(2);
select is(public.participant_project_detail(current_setting('test.project')::uuid,'ec100000-0000-0000-0000-000000000001'),null::jsonb,'removal immediately removes read access');
reset role;
select pg_temp.login(1);
select lives_ok($$select public.participant_add_project_collaborator(current_setting('test.project')::uuid,'collaborator-2@example.test')$$,'can re-add removed collaborator');
reset role;
update public.event_competition_settings set project_submissions_open_at=now()-interval '2 days',project_submissions_close_at=clock_timestamp()
where event_id='ec100000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select throws_ok($$select public.participant_remove_project_collaborator(current_setting('test.project')::uuid,'dc100000-0000-0000-0000-000000000002')$$,'P0001','Project submissions are closed','closing prevents removal');
select throws_ok($$select public.participant_add_project_collaborator(current_setting('test.project')::uuid,'missing@example.test')$$,'P0001','Project submissions are closed','closing checked before email lookup');
reset role;
update public.event_competition_settings set judging_started_at=now() where event_id='ec100000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select throws_ok($$select public.participant_remove_project_collaborator(current_setting('test.project')::uuid,'dc100000-0000-0000-0000-000000000002')$$,'P0001','Projects are locked because judging has started','judging blocks roster changes');
select throws_ok($$delete from public.project_collaborators$$,'42501',null,'cannot bypass roster RPC');
reset role;
set local role anon;
select throws_ok($$select public.participant_add_project_collaborator(current_setting('test.project')::uuid,'collaborator-2@example.test')$$,'42501',null,'anonymous add denied');
select * from finish(true);
rollback;
