begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(p_sub uuid,p_email text) returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub',p_sub,'email',p_email,'amr',json_build_array(json_build_object('method','oauth')))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.organizer() returns void language sql as $$
  select pg_temp.login('df500000-0000-0000-0000-000000000099','withdraw-organizer@example.test');
$$;
insert into auth.users(id,email,email_confirmed_at)
select ('df500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'withdraw-'||n||'@example.test',now() from generate_series(1,5)n;
insert into auth.users(id,email,email_confirmed_at) values
 ('df500000-0000-0000-0000-000000000098','withdraw-reviewer@example.test',now()),
 ('df500000-0000-0000-0000-000000000099','withdraw-organizer@example.test',now());
insert into public.admin_allowlist(email,level) values
 ('withdraw-reviewer@example.test','reviewer'),
 ('withdraw-organizer@example.test','organizer');
insert into public.events(id,slug,name) values('ef500000-0000-0000-0000-000000000001','withdraw-one','Withdraw one');
insert into public.event_competition_settings(event_id) values('ef500000-0000-0000-0000-000000000001');
insert into public.forms(id,event_id,role,title) values
 ('f5500000-0000-0000-0000-000000000001','ef500000-0000-0000-0000-000000000001','participant','Participant');
insert into public.applications(id,user_id,event_id,role,form_id,status,submitted_at,withdrawn_at) values
 ('a5500000-0000-0000-0000-000000000001','df500000-0000-0000-0000-000000000001','ef500000-0000-0000-0000-000000000001','participant','f5500000-0000-0000-0000-000000000001','submitted',now(),null),
 ('a5500000-0000-0000-0000-000000000002','df500000-0000-0000-0000-000000000002','ef500000-0000-0000-0000-000000000001','participant','f5500000-0000-0000-0000-000000000001','draft',null,null),
 ('a5500000-0000-0000-0000-000000000003','df500000-0000-0000-0000-000000000003','ef500000-0000-0000-0000-000000000001','participant','f5500000-0000-0000-0000-000000000001','withdrawn',null,now()),
 ('a5500000-0000-0000-0000-000000000004','df500000-0000-0000-0000-000000000004','ef500000-0000-0000-0000-000000000001','participant','f5500000-0000-0000-0000-000000000001','submitted',now(),null);
insert into public.application_decisions(application_id,decision) values('a5500000-0000-0000-0000-000000000001','accepted');

select plan(13);

select pg_temp.login('df500000-0000-0000-0000-000000000098','withdraw-reviewer@example.test');
select throws_ok($$select public.admin_withdraw_application('a5500000-0000-0000-0000-000000000001')$$,'42501','Organizer access required','reviewer cannot withdraw');
select throws_ok($$select public.admin_restore_application('a5500000-0000-0000-0000-000000000003')$$,'42501','Organizer access required','reviewer cannot restore');

select pg_temp.organizer();
select throws_ok($$select public.admin_withdraw_application('a5500000-0000-0000-0000-000000000002')$$,'P0001','Only submitted applications can be withdrawn','draft cannot be withdrawn');
select throws_ok($$select public.admin_restore_application('a5500000-0000-0000-0000-000000000001')$$,'P0001','Only withdrawn applications can be restored','submitted cannot be restored');
select throws_ok($$select public.admin_restore_application('a5500000-0000-0000-0000-000000000003')$$,'P0001','This application was withdrawn before it was submitted','never-submitted application cannot be restored');
select lives_ok($$select public.admin_withdraw_application('a5500000-0000-0000-0000-000000000001')$$,'organizer withdraws submitted application');
select throws_ok($$select public.admin_withdraw_application('a5500000-0000-0000-0000-000000000001')$$,'P0001','Only submitted applications can be withdrawn','cannot withdraw twice');

reset role;
select ok((select status='withdrawn' and withdrawn_at is not null from public.applications where id='a5500000-0000-0000-0000-000000000001'),'withdraw sets status and withdrawn_at');
select is((select decision::text from public.application_decisions where application_id='a5500000-0000-0000-0000-000000000001'),'accepted','withdraw keeps the decision');

select pg_temp.organizer();
select lives_ok($$select public.admin_save_event_judge('ef500000-0000-0000-0000-000000000001','withdraw-1@example.test','general',true,20,'{}',null)$$,'withdrawn participant can be added as a judge');
select throws_ok($$select public.admin_restore_application('a5500000-0000-0000-0000-000000000001')$$,'P0001','This applicant is an active judge for this event. Deactivate them as a judge before restoring.','active judge blocks restore');

reset role;
update public.event_judges set active=false where email='withdraw-1@example.test';
select pg_temp.organizer();
select lives_ok($$select public.admin_restore_application('a5500000-0000-0000-0000-000000000001')$$,'restore succeeds once the judge is inactive');

reset role;
select ok((select status='submitted' and withdrawn_at is null and submitted_at is not null from public.applications where id='a5500000-0000-0000-0000-000000000001'),'restore returns application to submitted');
select * from finish(true);
rollback;
