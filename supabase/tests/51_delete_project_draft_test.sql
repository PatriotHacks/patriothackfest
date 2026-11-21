begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer) returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','d5100000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','draft-'||n||'@example.test','amr',json_build_array(json_build_object('method','otp')))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.uid(n integer) returns uuid language sql as $$
  select ('d5100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.p(n integer) returns uuid language sql as $$ select current_setting('test.p'||n)::uuid $$;
create function pg_temp.path(n integer) returns text language sql as $$
  select pg_temp.p(n)||'/c5100000-0000-0000-0000-000000000001/a5100000-0000-0000-0000-000000000001.pdf';
$$;
create function pg_temp.visible_for(p_operation text,p_name text) returns bigint language sql as $$
  select set_config('storage.operation',p_operation,true);
  select count(*) from storage.objects where bucket_id='project-files' and name=p_name;
$$;

insert into auth.users(id,email,email_confirmed_at)
select pg_temp.uid(n),'draft-'||n||'@example.test',now() from generate_series(1,5)n;
insert into public.events(id,slug,name) values ('e5100000-0000-0000-0000-000000000001','draft-test','Drafts');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,judging_close_at)
values ('e5100000-0000-0000-0000-000000000001',true,now()-interval '1 day',now()+interval '4 days');
insert into public.forms(id,event_id,role,title) values
 ('f5100000-0000-0000-0000-000000000001','e5100000-0000-0000-0000-000000000001','participant','Test');
insert into public.applications(id,user_id,event_id,role,form_id,status,submitted_at)
select ('a5100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,pg_temp.uid(n),'e5100000-0000-0000-0000-000000000001',
  'participant','f5100000-0000-0000-0000-000000000001','submitted',now()
from generate_series(1,5)n;
insert into public.application_decisions(application_id,decision)
select id,'accepted' from public.applications where event_id='e5100000-0000-0000-0000-000000000001';
insert into public.project_questions(id,event_id,position,label,type,max_length)
values('c5100000-0000-0000-0000-000000000001','e5100000-0000-0000-0000-000000000001',1,'Deck','file',null);
insert into public.competition_tracks(id,event_id,name)
values('b5100000-0000-0000-0000-000000000001','e5100000-0000-0000-0000-000000000001','Track');

select plan(18);

select pg_temp.login(1);
select set_config('test.p1',public.participant_create_project('e5100000-0000-0000-0000-000000000001')::text,true);
select public.participant_add_project_collaborator(pg_temp.p(1),'draft-2@example.test');
reset role;
select pg_temp.login(3);
select set_config('test.p3',public.participant_create_project('e5100000-0000-0000-0000-000000000001')::text,true);
reset role;
insert into public.project_tracks(project_id,track_id,event_id)
values(pg_temp.p(1),'b5100000-0000-0000-0000-000000000001','e5100000-0000-0000-0000-000000000001');
insert into storage.objects(bucket_id,name,metadata)
values('project-files',pg_temp.path(1),'{"size":1000,"mimetype":"application/pdf"}'),
 ('project-files',pg_temp.path(3),'{"size":1000,"mimetype":"application/pdf"}');

select ok(not has_function_privilege('anon','public.participant_delete_project_draft(uuid)','execute'),'anon cannot delete drafts');

select pg_temp.login(2);
select throws_ok($$select public.participant_delete_project_draft(pg_temp.p(1))$$,'42501',
  'Only the project owner can delete the project','collaborator cannot delete the project');
reset role;

select pg_temp.login(1);
select is(public.participant_delete_project_draft(pg_temp.p(1)),array[pg_temp.path(1)],'owner deletes the draft and gets its file paths');
select throws_ok($$select public.participant_delete_project_draft(pg_temp.p(1))$$,'PT404',
  'Project not found','deleted project is gone');
reset role;
select is((select count(*) from public.projects where id=pg_temp.p(1)),0::bigint,'project row deleted');
select is((select count(*) from public.project_collaborators where project_id=pg_temp.p(1)),0::bigint,'collaborators deleted');
select is((select count(*) from public.project_tracks where project_id=pg_temp.p(1)),0::bigint,'tracks deleted');

-- Files of the deleted project are deletable by the Storage API, nothing else.
select pg_temp.login(1);
select ok(public.project_file_orphaned(pg_temp.path(1)),'deleted project files are orphaned');
select ok(not public.project_file_orphaned(pg_temp.path(3)),'files of live projects are not orphaned');
select ok(not public.project_file_orphaned('not-a-project-path.pdf'),'malformed names are not orphaned');
select is(pg_temp.visible_for('storage.object.delete',pg_temp.path(1)),1::bigint,'orphaned files are visible to deletes');
select is(pg_temp.visible_for('storage.object.sign',pg_temp.path(1)),0::bigint,'orphaned files cannot be signed');
select is(pg_temp.visible_for('storage.object.delete',pg_temp.path(3)),0::bigint,'other teams files stay hidden');
reset role;

select pg_temp.login(3);
select lives_ok($$select public.participant_add_project_collaborator(pg_temp.p(3),'draft-2@example.test')$$,
  'former collaborator joins another team');
select lives_ok($$select public.participant_add_project_collaborator(pg_temp.p(3),'draft-1@example.test')$$,
  'former owner joins another team');
reset role;

select pg_temp.login(4);
select set_config('test.p4',public.participant_create_project('e5100000-0000-0000-0000-000000000001')::text,true);
reset role;
update public.projects set status='submitted',submitted_at=now() where id=pg_temp.p(4);
select pg_temp.login(4);
select throws_ok($$select public.participant_delete_project_draft(pg_temp.p(4))$$,'P0001',
  'Only unsubmitted drafts can be deleted','submitted project cannot be deleted');
reset role;

select pg_temp.login(5);
select set_config('test.p5',public.participant_create_project('e5100000-0000-0000-0000-000000000001')::text,true);
reset role;
update public.event_competition_settings set project_submissions_close_at=now()-interval '1 hour'
where event_id='e5100000-0000-0000-0000-000000000001';
select pg_temp.login(5);
select throws_ok($$select public.participant_delete_project_draft(pg_temp.p(5))$$,'P0001',
  'Project submissions are closed','drafts cannot be deleted after submissions close');
reset role;
select is((select count(*) from public.projects where id=pg_temp.p(5)),1::bigint,'closed draft remains');

select * from finish(true);
rollback;
