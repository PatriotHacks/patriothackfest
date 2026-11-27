begin;
create extension if not exists pgtap with schema extensions;
-- 1 organizer, 2 signed-in participant, 3-9 project owners
create function pg_temp.login(n integer,method text default 'otp') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object(
    'sub','d6000000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','gallery-'||n||'@example.test',
    'amr',json_build_array(json_build_object('method',method)))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.project(n integer) returns uuid language sql as $$
  select ('a6000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.question(n integer) returns uuid language sql as $$
  select ('c6000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.award(n integer) returns uuid language sql as $$
  select ('f6000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.project_ids(p_gallery jsonb) returns uuid[] language sql as $$
  select array_agg((x->>'id')::uuid order by n) from jsonb_array_elements(p_gallery->'projects') with ordinality g(x,n)
$$;

insert into auth.users(id,email,email_confirmed_at)
select ('d6000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'gallery-'||n||'@example.test',now() from generate_series(1,9)n;
update public.profiles set full_name='Member '||right(id::text,1) where email like 'gallery-%@example.test';
insert into public.admin_allowlist(email,level) values('gallery-1@example.test','organizer');
insert into public.events(id,slug,name,starts_at) values
  ('e6000000-0000-4000-8000-000000000001','gallery','Gallery','2026-11-15'),
  ('e6000000-0000-4000-8000-000000000002','gallery-old','Gallery Old','2025-11-15'),
  ('e6000000-0000-4000-8000-000000000003','gallery-hidden','Gallery Hidden','2027-11-15');
insert into public.event_competition_settings(event_id,gallery_published) values
  ('e6000000-0000-4000-8000-000000000001',false),
  ('e6000000-0000-4000-8000-000000000002',true),
  ('e6000000-0000-4000-8000-000000000003',false);
insert into public.competition_tracks(id,event_id,name,sponsor,active) values
  ('b6000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','Health','Acme',true),
  ('b6000000-0000-4000-8000-000000000002','e6000000-0000-4000-8000-000000000001','Retired',null,false);
insert into public.project_questions(id,event_id,position,label,type,max_length,gallery_public) values
  (pg_temp.question(1),'e6000000-0000-4000-8000-000000000001',1,'Tagline','short_text',200,false),
  (pg_temp.question(2),'e6000000-0000-4000-8000-000000000001',2,'Story','long_text',5000,true),
  (pg_temp.question(3),'e6000000-0000-4000-8000-000000000001',3,'Deck','file',null,true),
  (pg_temp.question(4),'e6000000-0000-4000-8000-000000000001',4,'Repository','url',null,false);

alter table public.projects disable trigger projects_one_team;
alter table public.project_collaborators disable trigger collaborators_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at,answers,gallery_sort_key)
select pg_temp.project(n),'e6000000-0000-4000-8000-000000000001',('d6000000-0000-0000-0000-'||lpad((n+2)::text,12,'0'))::uuid,
  'Project '||n,case n when 6 then 'draft' when 7 then 'withdrawn' else 'submitted' end,case when n<>6 then now() end,
  case when n=2 then '{}'::jsonb else jsonb_build_object(pg_temp.question(1)::text,'Tagline '||n,pg_temp.question(2)::text,'Story '||n,
    pg_temp.question(3)::text,jsonb_build_object('path','secret.pdf','name','deck.pdf','size',1,'type','application/pdf'),
    pg_temp.question(4)::text,'https://example.test/'||n) end,
  (array[0.5,0.1,0.9,0.3,0.7,0.2,0.0])[n]
from generate_series(1,7)n;
insert into public.project_collaborators(project_id,event_id,user_id)
values(pg_temp.project(1),'e6000000-0000-4000-8000-000000000001','d6000000-0000-0000-0000-000000000009');
insert into public.project_tracks(project_id,track_id,event_id) values
  (pg_temp.project(4),'b6000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001'),
  (pg_temp.project(4),'b6000000-0000-4000-8000-000000000002','e6000000-0000-4000-8000-000000000001');
alter table public.projects enable trigger projects_one_team;
alter table public.project_collaborators enable trigger collaborators_one_team;

select plan(52);

-- Unpublished events are invisible to visitors.
set local role anon;
select is(jsonb_array_length(public.gallery_events()),1,'anon sees only published events');
select is(public.gallery_projects('gallery'),null,'unpublished gallery is null');
select is(public.gallery_project('gallery',pg_temp.project(1)),null,'unpublished project is null');
select is(public.gallery_projects('missing'),null,'unknown event is null');
select throws_ok($$select * from public.awards$$,'42501',null,'anon cannot read awards');
select throws_ok($$select * from public.project_awards$$,'42501',null,'anon cannot read project awards');
select throws_ok($$select public.admin_awards('e6000000-0000-4000-8000-000000000001')$$,'42501',null,
  'anon cannot list admin awards');
select throws_ok($$select public.admin_set_gallery_published('e6000000-0000-4000-8000-000000000001',true)$$,'42501',null,
  'anon cannot publish');
reset role;

-- Only organizers write.
select pg_temp.login(2,'oauth');
select throws_ok($$select public.admin_set_gallery_published('e6000000-0000-4000-8000-000000000001',true)$$,
  '42501','Not authorized','participant cannot publish');
select throws_ok($$select public.admin_set_project_question_gallery('e6000000-0000-4000-8000-000000000001',
  pg_temp.question(1),true,true)$$,'42501','Not authorized','participant cannot change question visibility');
select throws_ok($$select public.admin_save_award('e6000000-0000-4000-8000-000000000001','Best',1)$$,
  '42501','Not authorized','participant cannot create awards');
select throws_ok($$select public.admin_assign_award('e6000000-0000-4000-8000-000000000001',pg_temp.award(1),pg_temp.project(1))$$,
  '42501','Not authorized','participant cannot assign awards');
select throws_ok($$insert into public.awards(event_id,name,rank) values('e6000000-0000-4000-8000-000000000001','Best',1)$$,
  '42501',null,'participant cannot insert awards directly');
reset role;
select pg_temp.login(1,'otp');
select throws_ok($$select public.admin_set_gallery_published('e6000000-0000-4000-8000-000000000001',true)$$,
  '42501','Not authorized','organizer email without OAuth denied');
reset role;

select pg_temp.login(1,'oauth');
select lives_ok($$select public.admin_set_gallery_published('e6000000-0000-4000-8000-000000000001',true)$$,'organizer publishes');
select lives_ok($$select public.admin_set_project_question_gallery('e6000000-0000-4000-8000-000000000001',
  pg_temp.question(1),true,true)$$,'organizer marks the summary question');
select throws_ok($$select public.admin_set_project_question_gallery('e6000000-0000-4000-8000-000000000001',
  pg_temp.question(3),true,false)$$,'22023',null,'file questions cannot be public');
select throws_ok($$select public.admin_set_project_question_gallery('e6000000-0000-4000-8000-000000000001',
  pg_temp.question(2),false,true)$$,'22023',null,'summary must be public');
select throws_ok($$select public.admin_set_project_question_gallery('e6000000-0000-4000-8000-000000000001',
  pg_temp.question(4),true,true)$$,'22023',null,'summary must be a text question');
select lives_ok($$select public.admin_set_project_question_gallery('e6000000-0000-4000-8000-000000000001',
  pg_temp.question(2),true,true)$$,'summary moves to another question');
select is((select array_agg(q.id) from public.admin_project_questions('e6000000-0000-4000-8000-000000000001') q
  where q.gallery_summary),array[pg_temp.question(2)],'one summary after moving it');
select lives_ok($$select public.admin_set_project_question_gallery('e6000000-0000-4000-8000-000000000001',
  pg_temp.question(1),true,true)$$,'summary moves back');

select lives_ok($$select public.admin_save_award('e6000000-0000-4000-8000-000000000001',' Grand prize ',1)$$,'organizer creates an award');
select throws_ok($$select public.admin_save_award('e6000000-0000-4000-8000-000000000001','',1)$$,'22023',null,'award name required');
select throws_ok($$select public.admin_save_award('e6000000-0000-4000-8000-000000000001','Bad',0)$$,'22023',null,'rank must be positive');
select throws_ok($$select public.admin_save_award('e6000000-0000-4000-8000-000000000001','Old track',1,
  'b6000000-0000-4000-8000-000000000002')$$,'22023',null,'new awards need an active track');
reset role;
update public.awards set id=pg_temp.award(1) where name='Grand prize';
insert into public.awards(id,event_id,name,rank,track_id) values
  (pg_temp.award(2),'e6000000-0000-4000-8000-000000000001','Runner up',2,null),
  (pg_temp.award(3),'e6000000-0000-4000-8000-000000000001','Best health hack',2,'b6000000-0000-4000-8000-000000000001');
insert into public.project_awards(award_id,project_id,event_id)
values(pg_temp.award(1),pg_temp.project(7),'e6000000-0000-4000-8000-000000000001');

select pg_temp.login(1,'oauth');
select lives_ok($$select public.admin_assign_award('e6000000-0000-4000-8000-000000000001',pg_temp.award(1),pg_temp.project(3));
  select public.admin_assign_award('e6000000-0000-4000-8000-000000000001',pg_temp.award(2),pg_temp.project(3));
  select public.admin_assign_award('e6000000-0000-4000-8000-000000000001',pg_temp.award(2),pg_temp.project(5));
  select public.admin_assign_award('e6000000-0000-4000-8000-000000000001',pg_temp.award(3),pg_temp.project(4))$$,
  'organizer assigns awards');
select throws_ok($$select public.admin_assign_award('e6000000-0000-4000-8000-000000000001',pg_temp.award(1),pg_temp.project(6))$$,
  '22023',null,'draft projects cannot win');
select throws_ok($$select public.admin_assign_award('e6000000-0000-4000-8000-000000000001',pg_temp.award(3),pg_temp.project(1))$$,
  '22023',null,'track awards need a project in the track');
select throws_ok($$select public.admin_assign_award('e6000000-0000-4000-8000-000000000002',pg_temp.award(1),pg_temp.project(1))$$,
  'PT404',null,'awards stay within their event');
select is(jsonb_array_length(public.admin_awards('e6000000-0000-4000-8000-000000000001')->'projects'),5,
  'admin award candidates are the submitted projects');
reset role;

select throws_ok($$insert into public.project_questions(event_id,position,label,type,max_length,gallery_public,gallery_summary)
  values('e6000000-0000-4000-8000-000000000001',9,'Second','short_text',100,true,true)$$,'23505',null,
  'one summary question per event');
select throws_ok($$update public.project_questions set gallery_summary=true where id=pg_temp.question(3)$$,'23514',null,
  'a file question cannot be the summary');
select throws_ok($$insert into public.project_awards(award_id,project_id,event_id)
  values(pg_temp.award(2),'a6000000-0000-4000-8000-999999999999','e6000000-0000-4000-8000-000000000001')$$,'23503',null,
  'project awards need a project of the award event');

-- Visitors read the published gallery.
set local role anon;
select is((select array_agg(x->>'slug' order by n) from jsonb_array_elements(public.gallery_events()) with ordinality e(x,n)),
  array['gallery','gallery-old'],'published events newest first');
select is((select array_agg(k order by k) from jsonb_object_keys(public.gallery_events()->0) k),
  array['name','slug','starts_at'],'event entries expose slug, name and start');
select is(pg_temp.project_ids(public.gallery_projects('gallery')),
  array[pg_temp.project(3),pg_temp.project(4),pg_temp.project(5),pg_temp.project(2),pg_temp.project(1)],
  'winners by best rank then sort key, then everyone else by sort key; drafts and withdrawn excluded');
select is((select array_agg(k order by k) from jsonb_object_keys(public.gallery_projects('gallery')->'projects'->0) k),
  array['awards','id','name','summary','tracks'],'project cards expose no scores, sort keys or owners');
select is(public.gallery_projects('gallery')->'projects'->4->>'summary','Tagline 1','summary is the summary answer');
select is(public.gallery_projects('gallery')->'projects'->3->'summary','null'::jsonb,'summary is null without an answer');
select is((select array_agg(x->>'name' order by n) from jsonb_array_elements(public.gallery_projects('gallery')->'awards')
  with ordinality a(x,n)),array['Grand prize','Best health hack','Runner up'],'awards sorted by rank');
select is(public.gallery_projects('gallery')->'projects'->0->'awards',jsonb_build_array(
  jsonb_build_object('id',pg_temp.award(1),'name','Grand prize','rank',1),
  jsonb_build_object('id',pg_temp.award(2),'name','Runner up','rank',2)),'project awards sorted by rank');
select is(public.gallery_projects('gallery')->'tracks',jsonb_build_array(
  jsonb_build_object('id','b6000000-0000-4000-8000-000000000001','name','Health','sponsor','Acme')),'only active tracks');
select is(public.gallery_projects('gallery')->'projects'->1->'tracks',jsonb_build_array(
  jsonb_build_object('id','b6000000-0000-4000-8000-000000000001','name','Health')),'project tracks are active tracks');
select is((select array_agg(x->>'label' order by n) from jsonb_array_elements(
  public.gallery_project('gallery',pg_temp.project(1))->'answers') with ordinality a(x,n)),array['Tagline','Story'],
  'only public answers, never files, in question order');
select is(public.gallery_project('gallery',pg_temp.project(1))->'team','["Member 3", "Member 9"]'::jsonb,'team names, owner first');
select is((select array_agg(k order by k) from jsonb_object_keys(public.gallery_project('gallery',pg_temp.project(1))) k),
  array['answers','awards','event','project','team','tracks'],'project detail keys');
select is(public.gallery_project('gallery',pg_temp.project(6)),null,'draft project is null');
select is(public.gallery_project('gallery',pg_temp.project(7)),null,'withdrawn project is null');
select is(public.gallery_project('gallery-old',pg_temp.project(1)),null,'project from another event is null');
reset role;

-- Gallery flags stay editable once judging starts; other question edits do not.
update public.event_competition_settings set judging_started_at=now() where event_id='e6000000-0000-4000-8000-000000000001';
select pg_temp.login(1,'oauth');
select lives_ok($$select public.admin_set_project_question_gallery('e6000000-0000-4000-8000-000000000001',
  pg_temp.question(4),true,false)$$,'gallery flags editable after judging starts');
reset role;
select throws_ok($$update public.project_questions set label='Changed' where id=pg_temp.question(4)$$,
  'P0001','Project content and tracks are locked after judging starts','other question edits stay frozen');

select * from finish();
rollback;
