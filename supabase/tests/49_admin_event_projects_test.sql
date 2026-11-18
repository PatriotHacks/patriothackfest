begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer,p_method text default 'oauth') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','d4900000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','event-projects-'||n||'@example.test','amr',json_build_array(json_build_object('method',p_method)))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.p(n integer) returns uuid language sql as $$
  select ('a4900000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.q(n integer) returns text language sql as $$
  select 'c4900000-0000-0000-0000-00000000000'||n;
$$;
create function pg_temp.list(p_status text default null,p_event integer default 1) returns jsonb language sql as $$
  select public.admin_event_projects(('e4900000-0000-0000-0000-00000000000'||p_event)::uuid,p_status);
$$;
create function pg_temp.item(n integer) returns jsonb language sql as $$
  select p from jsonb_array_elements(pg_temp.list()->'projects') p where p->>'id'=pg_temp.p(n)::text;
$$;
create function pg_temp.detail(n integer) returns jsonb language sql as $$
  select public.admin_project_detail('e4900000-0000-0000-0000-000000000001',pg_temp.p(n));
$$;
create function pg_temp.path(n integer) returns text language sql as $$
  select pg_temp.p(n)||'/'||pg_temp.q(4)||'/c4900000-0000-4000-8000-00000000000'||n||'.pdf';
$$;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select ('d4900000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'event-projects-'||n||'@example.test',now(),jsonb_build_object('full_name','Person '||n)
from generate_series(1,4)n;
insert into public.admin_allowlist(email,level) values
 ('event-projects-1@example.test','owner'),('event-projects-2@example.test','organizer'),('event-projects-3@example.test','reviewer');
insert into public.events(id,slug,name) values
 ('e4900000-0000-0000-0000-000000000001','event-projects-one','Event projects one'),
 ('e4900000-0000-0000-0000-000000000002','event-projects-two','Event projects two');
insert into public.event_competition_settings(event_id) select id from public.events where slug like 'event-projects-%';
insert into public.project_questions(id,event_id,position,label,type,required,max_length,options,archived_at) values
 (pg_temp.q(1)::uuid,'e4900000-0000-0000-0000-000000000001',1,'Story','short_text',true,100,null,null),
 (pg_temp.q(2)::uuid,'e4900000-0000-0000-0000-000000000001',2,'Platform','single_choice',true,null,
   '[{"id":"c4900000-0000-4000-8000-0000000000a1","label":"Web"},{"id":"c4900000-0000-4000-8000-0000000000a2","label":"Mobile"}]',null),
 (pg_temp.q(3)::uuid,'e4900000-0000-0000-0000-000000000001',3,'Stack','multiple_choice',true,null,
   '[{"id":"c4900000-0000-4000-8000-0000000000b1","label":"Go"},{"id":"c4900000-0000-4000-8000-0000000000b2","label":"Rust"}]',null),
 (pg_temp.q(4)::uuid,'e4900000-0000-0000-0000-000000000001',4,'Deck','file',true,null,null,null),
 (pg_temp.q(5)::uuid,'e4900000-0000-0000-0000-000000000001',5,'Demo','url',false,null,null,null),
 (pg_temp.q(6)::uuid,'e4900000-0000-0000-0000-000000000001',6,'Old','short_text',true,100,null,now());
-- Fixture: one owner with several projects; team rules are tested in 47.
alter table public.projects disable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at,updated_at,answers) values
 (pg_temp.p(1),'e4900000-0000-0000-0000-000000000001','d4900000-0000-0000-0000-000000000004','Blank draft','draft',null,now()-interval '1 hour',
   jsonb_build_object(pg_temp.q(1),'   ',pg_temp.q(2),'c4900000-0000-4000-8000-0000000000a1',pg_temp.q(3),'[]'::jsonb,
     pg_temp.q(4),jsonb_build_object('path',pg_temp.path(1),'name','deck.pdf','size',1,'type','application/pdf'),pg_temp.q(6),'Old answer')),
 (pg_temp.p(2),'e4900000-0000-0000-0000-000000000001','d4900000-0000-0000-0000-000000000004','Partial draft','draft',now()-interval '1 day',now()-interval '2 hours',
   jsonb_build_object(pg_temp.q(1),'Hello',pg_temp.q(2),'null'::jsonb,pg_temp.q(3),'["c4900000-0000-4000-8000-0000000000b1"]'::jsonb,
     pg_temp.q(5),'https://example.test',pg_temp.q(6),'Old answer')),
 (pg_temp.p(3),'e4900000-0000-0000-0000-000000000001','d4900000-0000-0000-0000-000000000004','Complete','submitted',now()-interval '90 minutes',now(),
   jsonb_build_object(pg_temp.q(1),'Story',pg_temp.q(2),'c4900000-0000-4000-8000-0000000000a2',pg_temp.q(3),'["c4900000-0000-4000-8000-0000000000b2"]'::jsonb,
     pg_temp.q(4),jsonb_build_object('path',pg_temp.path(3),'name','deck.pdf','size',1,'type','application/pdf'))),
 (pg_temp.p(4),'e4900000-0000-0000-0000-000000000001','d4900000-0000-0000-0000-000000000004','Gone','withdrawn',now()-interval '1 day',now()-interval '5 hours','{}'),
 (pg_temp.p(5),'e4900000-0000-0000-0000-000000000002','d4900000-0000-0000-0000-000000000004','Other event','draft',null,now(),'{}');
alter table public.projects enable trigger projects_one_team;

select plan(32);
select pg_temp.login(3);
select throws_ok($$select pg_temp.list()$$,'42501','Not authorized','reviewer cannot list event projects');
select throws_ok($$select pg_temp.detail(1)$$,'42501','Not authorized','reviewer cannot open project detail');
select ok(not public.project_file_readable(pg_temp.path(1)),'reviewer cannot sign draft files');
reset role;
select pg_temp.login(4,'otp');
select throws_ok($$select pg_temp.list()$$,'42501','Not authorized','participant cannot list even their own projects');
select throws_ok($$select pg_temp.detail(1)$$,'42501','Not authorized','participant cannot use organizer detail');
reset role;
set local role anon;
select throws_ok($$select public.admin_event_projects('e4900000-0000-0000-0000-000000000001')$$,'42501',null,'anonymous list execution denied');
select throws_ok($$select public.admin_project_detail('e4900000-0000-0000-0000-000000000001',pg_temp.p(1))$$,'42501',null,'anonymous detail execution denied');
reset role;
select pg_temp.login(1);
select is(jsonb_array_length(pg_temp.list()->'projects'),4,'owner lists every status');
reset role;
select pg_temp.login(2);
select is((select jsonb_agg(p->>'name') from jsonb_array_elements(pg_temp.list()->'projects') p),
  '["Blank draft","Complete","Partial draft","Gone"]'::jsonb,'sorted by submission time for submitted projects and update time otherwise');
select is((select count(*) from jsonb_array_elements(pg_temp.list()->'projects') p where p->>'status'='draft'),2::bigint,'drafts included');
select is(pg_temp.list()->'counts','{"draft":2,"submitted":1,"withdrawn":1}'::jsonb,'status counts cover the whole event');
select is(pg_temp.list()->>'has_more','false','single page has no next page');
select is((select jsonb_agg(p->>'name') from jsonb_array_elements(pg_temp.list('draft')->'projects') p),
  '["Blank draft","Partial draft"]'::jsonb,'draft filter');
select is((select jsonb_agg(p->>'name') from jsonb_array_elements(pg_temp.list('submitted')->'projects') p),
  '["Complete"]'::jsonb,'submitted filter');
select is((select jsonb_agg(p->>'name') from jsonb_array_elements(pg_temp.list('withdrawn')->'projects') p),
  '["Gone"]'::jsonb,'withdrawn filter');
select is(pg_temp.list('withdrawn')->'counts','{"draft":2,"submitted":1,"withdrawn":1}'::jsonb,'counts ignore the status filter');
select throws_ok($$select pg_temp.list('archived')$$,'22023','Invalid project status','unknown status rejected');
select throws_ok($$select public.admin_event_projects('e4900000-0000-0000-0000-000000000001',null,0)$$,'22023','Invalid project page','zero page rejected');
select is(pg_temp.list()->>'required_count','4','required count excludes optional and archived questions');
select is(pg_temp.item(1)->>'answered_count','2','blank text and empty arrays are unanswered; choice value and file count');
select is(pg_temp.item(2)->>'answered_count','2','null choice, optional and archived answers do not count');
select is(pg_temp.item(3)->>'answered_count','4','complete project answers every required question');
select is(pg_temp.item(4)->>'answered_count','0','empty answers count zero');
select is(pg_temp.list(null,2)->'projects'->0->>'name','Other event','event list isolated');
select is(pg_temp.list(null,2)->>'required_count','0','required count is per event');
select is(pg_temp.detail(1)->'project'->>'status','draft','draft detail readable');
select ok(pg_temp.detail(1)->'answers' @> jsonb_build_array(jsonb_build_object('question_id',pg_temp.q(1),'answer','   ')),'draft detail returns typed answers');
select ok(not (pg_temp.detail(1)->'answers' @> jsonb_build_array(jsonb_build_object('question_id',pg_temp.q(6)))),'draft detail omits archived questions');
select is(public.admin_project_detail('e4900000-0000-0000-0000-000000000002',pg_temp.p(1)),null::jsonb,'wrong-event detail is not found');
select ok(public.project_file_readable(pg_temp.path(1)),'organizer can sign draft files');
reset role;
update public.project_questions set archived_at=now() where id=pg_temp.q(4)::uuid;
select pg_temp.login(2);
select is(pg_temp.list()->>'required_count','3','archiving a required question lowers the total');
select is(pg_temp.item(3)->>'answered_count','3','answers to archived questions stop counting');
select * from finish(true);
rollback;
