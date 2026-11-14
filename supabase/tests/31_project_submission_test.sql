begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer) returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','dd100000-0000-0000-0000-'||lpad(n::text,12,'0'),'amr','[{"method":"otp"}]'::jsonb)::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.save(p_content jsonb default '{}',p_tracks uuid[] default '{}',p_submit boolean default false)
returns timestamptz language sql as $$
  select public.participant_save_project(current_setting('test.project')::uuid,p_content,p_tracks,p_submit,
    (public.participant_project_detail(current_setting('test.project')::uuid,'ed100000-0000-0000-0000-000000000001')->'project'->>'updated_at')::timestamptz);
$$;
insert into auth.users(id,email)
select ('dd100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'submission-'||n||'@example.test' from generate_series(1,2)n;
insert into public.events(id,slug,name) values
 ('ed100000-0000-0000-0000-000000000001','submission-test','Submission'),
 ('ed100000-0000-0000-0000-000000000002','submission-other','Other');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,judging_close_at)
select id,true,now()+interval '1 day',now()+interval '4 days' from public.events where slug like 'submission-%';
insert into public.forms(id,event_id,role,title) values('fd100000-0000-0000-0000-000000000001','ed100000-0000-0000-0000-000000000001','participant','Test');
insert into public.applications(id,user_id,event_id,role,form_id,status,submitted_at)
select ('ad100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('dd100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'ed100000-0000-0000-0000-000000000001','participant','fd100000-0000-0000-0000-000000000001','submitted',now() from generate_series(1,2)n;
insert into public.application_decisions(application_id,decision) select id,'accepted' from public.applications where event_id='ed100000-0000-0000-0000-000000000001';
insert into public.competition_tracks(id,event_id,name,active) values
 ('cd100000-0000-0000-0000-000000000001','ed100000-0000-0000-0000-000000000001','A',true),
 ('cd100000-0000-0000-0000-000000000002','ed100000-0000-0000-0000-000000000001','B',true),
 ('cd100000-0000-0000-0000-000000000003','ed100000-0000-0000-0000-000000000001','Inactive',false),
 ('cd100000-0000-0000-0000-000000000004','ed100000-0000-0000-0000-000000000002','Foreign',true);
select set_config('test.content','{"name":" Demo ","summary":"Summary","description":"Description","demo_url":"https://example.com"}',true);
select plan(43);
select pg_temp.login(1);
select set_config('test.project',public.participant_create_project('ed100000-0000-0000-0000-000000000001')::text,true);
select throws_ok($$select pg_temp.save()$$,'P0001','Project submissions have not opened yet','cannot save even empty content before opening');
select throws_ok($$select pg_temp.save(current_setting('test.content')::jsonb,'{}',true)$$,'P0001','Project submissions have not opened yet','cannot submit early');
select lives_ok($$select public.participant_add_project_collaborator(current_setting('test.project')::uuid,'submission-2@example.test')$$,'roster allowed before opening');
reset role;
update public.event_competition_settings set project_submissions_open_at=clock_timestamp() where event_id='ed100000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select lives_ok($$select pg_temp.save('{"name":"Partial"}')$$,'exact opening allows incomplete draft');
select throws_ok($$select pg_temp.save('{}','{}',true)$$,'PT422',null,'complete submission required');
select throws_ok($$select pg_temp.save('{"name":42}')$$,'PT422',null,'content types checked in database');
select throws_ok($$select pg_temp.save('{"owner_user_id":"bad"}')$$,'PT422',null,'cannot inject owner/status fields');
select throws_ok($$select pg_temp.save(jsonb_build_object('name',repeat('x',121)))$$,'PT422',null,'length limits checked');
select throws_ok($$select pg_temp.save('{"demo_url":"javascript:alert(1)"}')$$,'PT422',null,'unsafe URL rejected');
select throws_ok($$select pg_temp.save('{"demo_url":"https://"}')$$,'PT422',null,'URL needs host');
select throws_ok($$select pg_temp.save('{"demo_url":"https://example.com:invalid"}')$$,'PT422',null,'non-numeric port rejected in direct RPC');
select throws_ok($$select pg_temp.save('{"demo_url":"https://example.com:99999"}')$$,'PT422',null,'out of range port rejected');
select throws_ok($$select pg_temp.save(jsonb_build_object('demo_url','https://example.com' || chr(92) || 'path'))$$,'PT422',null,'URL backslashes rejected');
select lives_ok($$select pg_temp.save('{"demo_url":"http://[::1]:3000/demo"}')$$,'IPv6 demo link with port is valid');
select throws_ok($$select pg_temp.save(current_setting('test.content')::jsonb,array['cd100000-0000-0000-0000-000000000003'::uuid])$$,'PT422',null,'inactive track rejected');
select throws_ok($$select pg_temp.save(current_setting('test.content')::jsonb,array['cd100000-0000-0000-0000-000000000004'::uuid])$$,'PT422',null,'foreign track rejected');
select lives_ok($$select pg_temp.save(current_setting('test.content')::jsonb,array['cd100000-0000-0000-0000-000000000001'::uuid,'cd100000-0000-0000-0000-000000000002'::uuid],true)$$,'latest content and multiple tracks submit together');
select is(public.participant_project_detail(current_setting('test.project')::uuid,'ed100000-0000-0000-0000-000000000001')->'project'->>'name','Demo','content trimmed and stored');
select is(jsonb_array_length(public.participant_project_detail(current_setting('test.project')::uuid,'ed100000-0000-0000-0000-000000000001')->'selected_tracks'),2,'both tracks stored');
reset role;
update public.competition_tracks set active=false where id='cd100000-0000-0000-0000-000000000002';
select pg_temp.login(1);
select ok(public.participant_project_detail(current_setting('test.project')::uuid,'ed100000-0000-0000-0000-000000000001')->'selected_tracks' @> '[{"id":"cd100000-0000-0000-0000-000000000002","active":false}]'::jsonb,'deactivated selected track remains visible');
select throws_ok($$select pg_temp.save(current_setting('test.content')::jsonb,array['cd100000-0000-0000-0000-000000000002'::uuid])$$,'PT422',null,'must explicitly remove deactivated selection before saving');
select is(jsonb_array_length(public.participant_project_detail(current_setting('test.project')::uuid,'ed100000-0000-0000-0000-000000000001')->'selected_tracks'),2,'invalid track save preserves existing selections atomically');
select set_config('test.first_submission',public.participant_project_detail(current_setting('test.project')::uuid,'ed100000-0000-0000-0000-000000000001')->'project'->>'submitted_at',true);
select throws_ok($$select pg_temp.save('{"name":"Invalid change"}')$$,'PT422',null,'submitted project cannot become incomplete through draft save');
select is(public.participant_project_detail(current_setting('test.project')::uuid,'ed100000-0000-0000-0000-000000000001')->'project'->>'name','Demo','failed validation rolls back content');
select lives_ok($$select pg_temp.save(current_setting('test.content')::jsonb,'{}',true)$$,'repeat submit succeeds with no sponsor tracks');
select is(public.participant_project_detail(current_setting('test.project')::uuid,'ed100000-0000-0000-0000-000000000001')->'project'->>'submitted_at',current_setting('test.first_submission'),'first submission timestamp preserved');
select throws_ok($$select public.participant_save_project(current_setting('test.project')::uuid,'{}','{}',false,'2000-01-01')$$,'PT409','This project changed. Reload before saving again.','stale content save rejected');
reset role;
select pg_temp.login(2);
select throws_ok($$select pg_temp.save(current_setting('test.content')::jsonb)$$,'PT404','Project not found','collaborator cannot edit');
select throws_ok($$select public.participant_withdraw_project(current_setting('test.project')::uuid)$$,'PT404','Project not found','collaborator cannot withdraw');
reset role;
update public.application_decisions set decision='rejected' where application_id='ad100000-0000-0000-0000-000000000002';
select pg_temp.login(1);
select throws_ok($$select pg_temp.save(current_setting('test.content')::jsonb)$$,'P0001','A collaborator is no longer eligible for this event. Remove them before submitting or saving changes.','current collaborators rechecked for submitted changes');
select lives_ok($$select public.participant_remove_project_collaborator(current_setting('test.project')::uuid,'dd100000-0000-0000-0000-000000000002')$$,'owner can resolve ineligible collaborator');
select lives_ok($$select pg_temp.save(current_setting('test.content')::jsonb)$$,'submitted content editable with no scheduled closing');
select set_config('test.withdrawn',public.participant_create_project('ed100000-0000-0000-0000-000000000001')::text,true);
select lives_ok($$select public.participant_withdraw_project(current_setting('test.withdrawn')::uuid)$$,'owner can withdraw before closing');
select is(public.participant_project_detail(current_setting('test.withdrawn')::uuid,'ed100000-0000-0000-0000-000000000001')->'project'->>'status','withdrawn','withdrawn project remains readable');
select throws_ok($$select public.participant_save_project(current_setting('test.withdrawn')::uuid,'{}')$$,'P0001','This project has been withdrawn','withdrawn project cannot be restored');
reset role;
update public.event_competition_settings set project_submissions_open_at=now()-interval '1 day',project_submissions_close_at=clock_timestamp()
where event_id='ed100000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select throws_ok($$select pg_temp.save(current_setting('test.content')::jsonb)$$,'P0001','Project submissions are closed','exact closing rejects saves');
select throws_ok($$select public.participant_withdraw_project(current_setting('test.project')::uuid)$$,'P0001','Project submissions are closed','withdrawal blocked after closing');
reset role;
update public.event_competition_settings set judging_started_at=now() where event_id='ed100000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select throws_ok($$select pg_temp.save(current_setting('test.content')::jsonb)$$,'P0001','Projects are locked because judging has started','judging locks content');
reset role;
update public.event_competition_settings set judging_close_at=now()+interval '8 days' where event_id='ed100000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select throws_ok($$select pg_temp.save(current_setting('test.content')::jsonb)$$,'P0001','Projects are locked because judging has started','judging extension never reopens content');
select throws_ok($$update public.projects set status='draft'$$,'42501',null,'cannot change status directly');
reset role;
set local role anon;
select throws_ok($$select public.participant_save_project(current_setting('test.project')::uuid,'{}')$$,'42501',null,'anonymous save denied');
select throws_ok($$select public.participant_withdraw_project(current_setting('test.project')::uuid)$$,'42501',null,'anonymous withdrawal denied');
reset role;
select is((select count(*) from public.applications where event_id='ed100000-0000-0000-0000-000000000001' and status='submitted'),2::bigint,'project withdrawal does not withdraw applications');
select * from finish(true);
rollback;
