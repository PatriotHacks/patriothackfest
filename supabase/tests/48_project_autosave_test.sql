begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer) returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','d4800000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','auto-'||n||'@example.test','amr',json_build_array(json_build_object('method','otp')))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.pid() returns uuid language sql as $$ select 'a4800000-0000-0000-0000-000000000001'::uuid $$;
create function pg_temp.q(n integer) returns text language sql as $$
  select 'c4800000-0000-0000-0000-00000000000'||n;
$$;
create function pg_temp.patch(p_answers jsonb default '{}',p_name text default null,p_tracks uuid[] default null) returns jsonb language sql as $$
  select public.participant_patch_project(pg_temp.pid(),p_name,p_answers,p_tracks);
$$;
create function pg_temp.errors(p_answers jsonb default '{}',p_name text default null,p_tracks uuid[] default null) returns jsonb language plpgsql as $$
declare v_detail text;
begin
  perform pg_temp.patch(p_answers,p_name,p_tracks);
  return '{}'::jsonb;
exception when sqlstate 'PT422' then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail::jsonb;
end;
$$;
create function pg_temp.submit_errors() returns jsonb language plpgsql as $$
declare v_detail text;
begin
  perform public.participant_submit_project(pg_temp.pid(),public.participant_project_version(pg_temp.pid()));
  return '{}'::jsonb;
exception when sqlstate 'PT422' then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail::jsonb;
end;
$$;
create function pg_temp.stored() returns jsonb language sql as $$
  select answers from public.projects where id=pg_temp.pid();
$$;
create function pg_temp.path(p_question integer,p_file integer,p_project uuid default null) returns text language sql as $$
  select coalesce(p_project,pg_temp.pid())||'/'||pg_temp.q(p_question)||'/c4800000-0000-4000-8000-00000000000'||p_file||'.pdf';
$$;
create function pg_temp.file(p_path text) returns jsonb language sql as $$
  select jsonb_build_object('path',p_path,'name','deck.pdf','size',1,'type','application/pdf');
$$;

insert into auth.users(id,email,email_confirmed_at)
select ('d4800000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'auto-'||n||'@example.test',now() from generate_series(1,3)n;
insert into public.events(id,slug,name) values ('e4800000-0000-0000-0000-000000000001','auto-test','Autosave');
insert into public.event_competition_settings(event_id,enabled,project_submissions_open_at,judging_close_at)
values ('e4800000-0000-0000-0000-000000000001',true,now()-interval '1 day',now()+interval '4 days');
insert into public.forms(id,event_id,role,title) values ('f4800000-0000-0000-0000-000000000001','e4800000-0000-0000-0000-000000000001','participant','Test');
insert into public.applications(id,user_id,event_id,role,form_id,status,submitted_at)
select ('a4800000-0000-0000-0000-00000000010'||n)::uuid,('d4800000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
  'e4800000-0000-0000-0000-000000000001','participant','f4800000-0000-0000-0000-000000000001','submitted',now()
from generate_series(1,3)n;
insert into public.application_decisions(application_id,decision)
select id,'accepted' from public.applications where event_id='e4800000-0000-0000-0000-000000000001';
insert into public.projects(id,event_id,owner_user_id,updated_at) values
 (pg_temp.pid(),'e4800000-0000-0000-0000-000000000001','d4800000-0000-0000-0000-000000000001','2000-01-01');
insert into public.project_collaborators(project_id,event_id,user_id) values
 (pg_temp.pid(),'e4800000-0000-0000-0000-000000000001','d4800000-0000-0000-0000-000000000002');
insert into public.project_questions(id,event_id,position,label,type,required,max_length,options,archived_at) values
 (pg_temp.q(1)::uuid,'e4800000-0000-0000-0000-000000000001',1,'Story','short_text',true,10,null,null),
 (pg_temp.q(2)::uuid,'e4800000-0000-0000-0000-000000000001',2,'Demo','url',false,null,null,null),
 (pg_temp.q(3)::uuid,'e4800000-0000-0000-0000-000000000001',3,'Platform','single_choice',false,null,
   '[{"id":"c4800000-0000-4000-8000-0000000000a1","label":"Web"},{"id":"c4800000-0000-4000-8000-0000000000a2","label":"Mobile"}]',null),
 (pg_temp.q(4)::uuid,'e4800000-0000-0000-0000-000000000001',4,'Stack','multiple_choice',false,null,
   '[{"id":"c4800000-0000-4000-8000-0000000000b1","label":"Go"},{"id":"c4800000-0000-4000-8000-0000000000b2","label":"Rust"}]',null),
 (pg_temp.q(5)::uuid,'e4800000-0000-0000-0000-000000000001',5,'Deck','file',false,null,null,null),
 (pg_temp.q(6)::uuid,'e4800000-0000-0000-0000-000000000001',6,'Old','short_text',false,100,null,now());
insert into public.competition_tracks(id,event_id,name,active) values
 ('b4800000-0000-0000-0000-000000000001','e4800000-0000-0000-0000-000000000001','Health',true),
 ('b4800000-0000-0000-0000-000000000002','e4800000-0000-0000-0000-000000000001','Retired',false);
insert into storage.objects(bucket_id,name,metadata) values
 ('project-files',pg_temp.path(5,1),'{"size":2048,"mimetype":"application/pdf"}'),
 ('project-files',pg_temp.path(5,2),'{"size":4096,"mimetype":"application/pdf"}'),
 ('project-files',pg_temp.path(5,3),'{"size":10,"mimetype":"image/png"}');

select plan(45);

-- Access.
select pg_temp.login(3);
select throws_ok($$select pg_temp.patch('{}','Mine')$$,'PT404','Project not found','non-member cannot patch');
select is(public.participant_project_version(pg_temp.pid()),null::timestamptz,'non-member sees no version');
reset role;
select pg_temp.login(1);
select ok((pg_temp.patch('{}','  Rocket  ')->>'updated_at')::timestamptz > '2000-01-01','owner patch bumps updated_at');
select ok(public.participant_project_version(pg_temp.pid()) > '2000-01-01','member sees the new version');
reset role;
select is((select name from public.projects where id=pg_temp.pid()),'Rocket','name is trimmed');

-- Per-key merge.
select pg_temp.login(2);
select is(pg_temp.patch(jsonb_build_object(pg_temp.q(1),' Hello '))->'answers',jsonb_build_object(pg_temp.q(1),'Hello'),'collaborator patch returns normalized values');
reset role;
select pg_temp.login(1);
select lives_ok(format($$select pg_temp.patch(%L)$$,jsonb_build_object(pg_temp.q(2),'https://demo.example.test')),'owner patches another question');
reset role;
select is(pg_temp.stored(),jsonb_build_object(pg_temp.q(1),'Hello',pg_temp.q(2),'https://demo.example.test'),'patches merge per key');
select is((select name from public.projects where id=pg_temp.pid()),'Rocket','answer patch keeps the name');
select pg_temp.login(2);
select is(pg_temp.patch(jsonb_build_object(pg_temp.q(2),null))->'answers',jsonb_build_object(pg_temp.q(2),null),'cleared key returns null');
select lives_ok(format($$select pg_temp.patch(%L)$$,jsonb_build_object(pg_temp.q(1),'  ')),'blank text clears too');
reset role;
select is(pg_temp.stored(),'{}'::jsonb,'cleared keys are removed');

-- Validation covers only the patched keys; required waits for submission.
update public.projects set answers=jsonb_build_object(pg_temp.q(2),'not a url') where id=pg_temp.pid();
select pg_temp.login(1);
select is(pg_temp.errors(jsonb_build_object(pg_temp.q(3),'c4800000-0000-4000-8000-0000000000a1')),'{}'::jsonb,'stored invalid answers do not block other keys');
select is(pg_temp.errors('{}',''),'{}'::jsonb,'required questions and name wait for submission');
select is(pg_temp.errors(jsonb_build_object(pg_temp.q(1),'Far too long text')),
  jsonb_build_object('answers.'||pg_temp.q(1),'Use 10 characters or fewer'),'text length checked');
select is(pg_temp.errors(jsonb_build_object(pg_temp.q(2),'ftp://x')),
  jsonb_build_object('answers.'||pg_temp.q(2),'Enter an HTTP or HTTPS URL'),'url checked');
select is(pg_temp.errors(jsonb_build_object(pg_temp.q(3),7)),
  jsonb_build_object('answers.'||pg_temp.q(3),'Choose one of the options'),'choice type checked');
select is(pg_temp.errors(jsonb_build_object(pg_temp.q(6),'x')),
  '{"form":"The project questions changed. Reload the page before saving."}'::jsonb,'archived question rejected');
select is(pg_temp.errors('{}',repeat('x',121)),'{"name":"Use 120 characters or fewer"}'::jsonb,'name length checked');
select is(pg_temp.errors('[]'),'{"form":"Invalid question answers"}'::jsonb,'answers must be an object');
select is(pg_temp.patch(jsonb_build_object(pg_temp.q(3),'c4800000-0000-4000-8000-0000000000ff',
  pg_temp.q(4),'["c4800000-0000-4000-8000-0000000000ff","c4800000-0000-4000-8000-0000000000b2"]'::jsonb))->'answers',
  jsonb_build_object(pg_temp.q(3),null,pg_temp.q(4),'["c4800000-0000-4000-8000-0000000000b2"]'::jsonb),
  'removed options are normalized away');

-- Tracks.
select is(pg_temp.errors('{}',null,'{b4800000-0000-0000-0000-000000000002}'),
  '{"track_ids":"Choose active tracks for this event; remove unavailable selections"}'::jsonb,'inactive tracks rejected');
select lives_ok($$select pg_temp.patch('{}',null,'{b4800000-0000-0000-0000-000000000001}')$$,'active tracks saved');
reset role;
select is((select count(*) from public.project_tracks where project_id=pg_temp.pid()),1::bigint,'track selection stored');
select pg_temp.login(1);
select lives_ok($$select pg_temp.patch(jsonb_build_object(pg_temp.q(1),'Hi'))$$,'omitted tracks are untouched');
reset role;
select is((select count(*) from public.project_tracks where project_id=pg_temp.pid()),1::bigint,'track selection kept');
select pg_temp.login(1);

-- Files use real storage metadata and report replaced paths.
select is(pg_temp.errors(jsonb_build_object(pg_temp.q(5),pg_temp.file(pg_temp.path(5,1,'a4800000-0000-0000-0000-000000000009')))),
  jsonb_build_object('answers.'||pg_temp.q(5),'Upload the file again'),'file path must belong to the project');
select is(pg_temp.errors(jsonb_build_object(pg_temp.q(5),pg_temp.file(pg_temp.path(5,3)))),
  jsonb_build_object('answers.'||pg_temp.q(5),'Upload a PDF file'),'file type comes from storage');
select is(pg_temp.patch(jsonb_build_object(pg_temp.q(5),pg_temp.file(pg_temp.path(5,1))))->'answers'->pg_temp.q(5)->'size',
  '2048'::jsonb,'file size comes from storage');
select is(pg_temp.patch(jsonb_build_object(pg_temp.q(1),'Hey'))->'removed_paths','[]'::jsonb,'other keys remove nothing');
select is(pg_temp.patch(jsonb_build_object(pg_temp.q(5),pg_temp.file(pg_temp.path(5,2))))->'removed_paths',
  jsonb_build_array(pg_temp.path(5,1)),'replaced file is reported');
select is(pg_temp.patch(jsonb_build_object(pg_temp.q(5),pg_temp.file(pg_temp.path(5,2))))->'removed_paths','[]'::jsonb,'unchanged file is kept');
select is(pg_temp.patch(jsonb_build_object(pg_temp.q(5),null))->'removed_paths',jsonb_build_array(pg_temp.path(5,2)),'cleared file is reported');
reset role;

-- Submission uses the stored name, tracks, and answers.
select pg_temp.login(3);
select throws_ok($$select public.participant_submit_project(pg_temp.pid(),now())$$,'PT404','Project not found','non-member cannot submit');
reset role;
select pg_temp.login(1);
select throws_ok($$select public.participant_submit_project(pg_temp.pid(),'2000-01-01')$$,'PT409',
  'This project changed. Reload before saving again.','stale submit rejected');
select lives_ok($$select pg_temp.patch('{}','')$$,'teammate blanks the name');
select is(pg_temp.submit_errors(),jsonb_build_object('name','This field is required',
  'answers.'||pg_temp.q(2),'Enter an HTTP or HTTPS URL'),'stored name and answers are validated in full');
reset role;
insert into public.project_tracks(project_id,track_id,event_id)
values (pg_temp.pid(),'b4800000-0000-0000-0000-000000000002','e4800000-0000-0000-0000-000000000001');
select pg_temp.login(2);
select lives_ok(format($$select pg_temp.patch(%L,'Rocket')$$,jsonb_build_object(pg_temp.q(2),null)),'teammate fixes the content');
select is(pg_temp.submit_errors(),'{"track_ids":"Choose active tracks for this event; remove unavailable selections"}'::jsonb,
  'stored tracks are validated');
reset role;
delete from public.project_tracks where track_id='b4800000-0000-0000-0000-000000000002';
select pg_temp.login(2);
select is(pg_temp.submit_errors(),'{}'::jsonb,'collaborator submits the stored draft');
reset role;
select is((select row(status,name)::text from public.projects where id=pg_temp.pid()),'(submitted,Rocket)','stored content submitted');
select is((select array_agg(track_id) from public.project_tracks where project_id=pg_temp.pid()),
  '{b4800000-0000-0000-0000-000000000001}'::uuid[],'stored tracks kept');

-- Drafts only, inside the submission window, before judging.
select pg_temp.login(1);
select throws_ok($$select pg_temp.patch('{}','X')$$,'PT409','This project was submitted. Reload the page to keep editing.','submitted projects are not patched');
reset role;
update public.projects set status='draft',submitted_at=null where id=pg_temp.pid();
update public.event_competition_settings set project_submissions_close_at=now()-interval '1 minute' where event_id='e4800000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select throws_ok($$select pg_temp.patch('{}','X')$$,'P0001','Project submissions are closed','closed window rejected');
reset role;
update public.event_competition_settings set judging_started_at=now() where event_id='e4800000-0000-0000-0000-000000000001';
select pg_temp.login(2);
select throws_ok($$select pg_temp.patch('{}','X')$$,'P0001','Projects are locked because judging has started','judging lock rejected');
reset role;
select * from finish(true);
rollback;
