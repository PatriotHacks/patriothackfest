begin;
create extension if not exists pgtap with schema extensions;

create function pg_temp.login(p_user integer)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', 'db000000-0000-0000-0000-' || lpad(p_user::text, 12, '0'),
    'email', 'project-user-' || p_user || '@example.test',
    'amr', json_build_array(json_build_object('method', 'otp'))
  )::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users(id, email, raw_user_meta_data)
select ('db000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  'project-user-' || n || '@example.test', jsonb_build_object('full_name', 'Person ' || n)
from generate_series(1,5) n;
insert into public.events(id, slug, name) values
  ('eb000000-0000-0000-0000-000000000001','project-test-1','Projects one'),
  ('eb000000-0000-0000-0000-000000000002','project-test-2','Projects two');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,judging_close_at)
select id, true, now() + interval '1 day', now() + interval '4 days' from public.events where slug like 'project-test-%';
insert into public.forms(id,event_id,role,title)
values ('fb000000-0000-0000-0000-000000000001','eb000000-0000-0000-0000-000000000001','participant','Test');
insert into public.applications(id,user_id,event_id,role,form_id,submitted_at,status)
select ('ab000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  ('db000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  'eb000000-0000-0000-0000-000000000001','participant','fb000000-0000-0000-0000-000000000001',
  now(), 'submitted'::public.application_status
from generate_series(1,5) n;
insert into public.application_decisions(application_id,decision)
select id, case when user_id = 'db000000-0000-0000-0000-000000000003' then 'rejected'::public.decision else 'accepted'::public.decision end
from public.applications where event_id = 'eb000000-0000-0000-0000-000000000001';

-- Test submission history independently from the accepted decision.
update public.applications set status='draft',submitted_at=null where id in (
  select id from public.applications where user_id = (select id from auth.users where email = 'project-user-4@example.test')
);

select plan(24);
select pg_temp.login(1);
select is((select count(*) from public.application_decisions),0::bigint,'unreleased admissions decisions remain hidden');
select is((select count(*) from public.participant_project_events()),1::bigint,'unreleased acceptance enables only the eligible event');
select throws_ok($$select public.project_user_is_eligible('eb000000-0000-0000-0000-000000000001','db000000-0000-0000-0000-000000000002')$$,'42501',null,'private helper cannot inspect other eligibility');
select set_config('test.project',public.participant_create_project('eb000000-0000-0000-0000-000000000001')::text,true);
select lives_ok($$select public.participant_create_project('eb000000-0000-0000-0000-000000000001')$$,'multiple projects allowed before opening');
select is((select count(*) from public.participant_projects('eb000000-0000-0000-0000-000000000001')),2::bigint,'owner can read own roster-only drafts');
select is(public.participant_project_detail(current_setting('test.project')::uuid,'eb000000-0000-0000-0000-000000000001')->'project'->>'name','','pre-opening project content empty');
select is(public.participant_project_detail(current_setting('test.project')::uuid,'eb000000-0000-0000-0000-000000000002'),null::jsonb,'wrong event detail is not found');
select throws_ok($$select public.participant_create_project('eb000000-0000-0000-0000-000000000002')$$,'42501','A submitted and accepted application for this event is required','no cross-event eligibility');
reset role;
select pg_temp.login(2);
select is(public.participant_project_detail(current_setting('test.project')::uuid,'eb000000-0000-0000-0000-000000000001'),null::jsonb,'unrelated accepted user cannot read project');
reset role;
insert into public.project_collaborators(project_id,event_id,user_id) values
  (current_setting('test.project')::uuid,'eb000000-0000-0000-0000-000000000001','db000000-0000-0000-0000-000000000002');
select pg_temp.login(2);
select is((select count(*) from public.participant_projects('eb000000-0000-0000-0000-000000000001')),1::bigint,'collaborator reads associated project');
select ok(not (public.participant_project_detail(current_setting('test.project')::uuid,'eb000000-0000-0000-0000-000000000001')->'collaborators'->0 ? 'email'),'roster does not expose email directory');
reset role;
select pg_temp.login(3);
select throws_ok($$select public.participant_create_project('eb000000-0000-0000-0000-000000000001')$$,'42501','A submitted and accepted application for this event is required','rejected applicant cannot create');
reset role;
select pg_temp.login(4);
select throws_ok($$select public.participant_create_project('eb000000-0000-0000-0000-000000000001')$$,'42501','A submitted and accepted application for this event is required','accepted but unsubmitted cannot create');
reset role;
update public.applications set declined_at=now() where user_id='db000000-0000-0000-0000-000000000005';
select pg_temp.login(5);
select lives_ok($$select public.participant_create_project('eb000000-0000-0000-0000-000000000001')$$,'submitted and accepted still qualifies despite declined status');
reset role;
update public.applications set declined_at=null,status='withdrawn',withdrawn_at=now() where user_id='db000000-0000-0000-0000-000000000005';
select pg_temp.login(5);
select lives_ok($$select public.participant_create_project('eb000000-0000-0000-0000-000000000001')$$,'submitted and accepted still qualifies despite withdrawn status');
reset role;
update public.event_competition_settings set enabled=false where event_id='eb000000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select throws_ok($$select public.participant_create_project('eb000000-0000-0000-0000-000000000001')$$,'P0001','Project submissions are disabled','disabled event cannot create');
select is((select count(*) from public.participant_projects('eb000000-0000-0000-0000-000000000001')),2::bigint,'disabled event does not hide owned projects');
select is((select count(*) from public.participant_project_events()),1::bigint,'associated disabled event remains discoverable');
reset role;
update public.event_competition_settings set enabled=true,project_submissions_open_at=now()-interval '2 days',project_submissions_close_at=clock_timestamp()
where event_id='eb000000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select throws_ok($$select public.participant_create_project('eb000000-0000-0000-0000-000000000001')$$,'P0001','Project submissions are closed','exact closing boundary rejects creation');
reset role;
update public.event_competition_settings set judging_started_at=now() where event_id='eb000000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select throws_ok($$select public.participant_create_project('eb000000-0000-0000-0000-000000000001')$$,'P0001','Projects are locked because judging has started','judging permanently blocks creation');
select throws_ok($$select * from public.projects$$,'42501',null,'raw project table remains inaccessible');
reset role;
set local role anon;
select throws_ok($$select public.participant_project_events()$$,'42501',null,'anonymous read RPC denied');
select throws_ok($$select public.participant_create_project('eb000000-0000-0000-0000-000000000001')$$,'42501',null,'anonymous create RPC denied');
reset role;
select is((select count(*) from public.projects where event_id='eb000000-0000-0000-0000-000000000002'),0::bigint,'other event unchanged');
select * from finish(true);
rollback;
