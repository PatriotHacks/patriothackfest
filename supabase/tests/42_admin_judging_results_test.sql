begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.login(n integer, method text default 'oauth') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', 'd4300000-0000-0000-0000-' || lpad(n::text,12,'0'),
    'email', 'a3-' || n || '@example.test',
    'amr', json_build_array(json_build_object('method',method)))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.results(track integer default null, page integer default 1) returns jsonb language sql as $$
  select public.admin_judging_results('e4300000-0000-0000-0000-000000000001',
    case when track is not null then ('c4300000-0000-0000-0000-' || lpad(track::text,12,'0'))::uuid end,page);
$$;
create function pg_temp.project(n integer, track integer default null) returns jsonb language sql as $$
  select p from jsonb_array_elements((pg_temp.results(track)->'projects') || (pg_temp.results(track,2)->'projects')) p
  where p->>'project_id' = 'a4300000-0000-0000-0000-' || lpad(n::text,12,'0');
$$;
insert into auth.users(id,email,email_confirmed_at)
select ('d4300000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,'a3-' || n || '@example.test',now() from generate_series(1,5)n;
insert into public.admin_allowlist(email,level) values
  ('a3-1@example.test','owner'),('a3-2@example.test','organizer'),('a3-3@example.test','reviewer');
insert into public.events(id,slug,name) values
  ('e4300000-0000-0000-0000-000000000001','a3-results','A3 results'),
  ('e4300000-0000-0000-0000-000000000002','a3-other','A3 other'),
  ('e4300000-0000-0000-0000-000000000003','a3-unconfigured','A3 unconfigured');
insert into public.event_competition_settings(event_id)
select id from public.events where slug in ('a3-results','a3-other');
-- Fixture: one owner with several projects; team rules are tested in 47.
alter table public.projects disable trigger projects_one_team;
insert into public.projects(id,event_id,owner_user_id,name,status,submitted_at)
select ('a4300000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  'e4300000-0000-0000-0000-000000000001','d4300000-0000-0000-0000-000000000004',
  'Project ' || lpad(n::text,3,'0'),case when n=5 then 'draft' when n=6 then 'withdrawn' else 'submitted' end,
  case when n<>5 then now() end from generate_series(1,57)n;
alter table public.projects enable trigger projects_one_team;
insert into public.projects(event_id,owner_user_id,name,status,submitted_at) values
  ('e4300000-0000-0000-0000-000000000002','d4300000-0000-0000-0000-000000000004','Other event','submitted',now());
insert into public.competition_tracks(id,event_id,name,reviews_per_project,active)
select ('c4300000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  case when n=5 then 'e4300000-0000-0000-0000-000000000002'::uuid else 'e4300000-0000-0000-0000-000000000001'::uuid end,
  'Track ' || n,case when n=1 then 2 else 1 end,n<>4 from generate_series(1,5)n;
insert into public.project_tracks(project_id,track_id,event_id)
select p.id,t.id,p.event_id from public.projects p cross join public.competition_tracks t
where p.event_id=t.event_id and p.event_id='e4300000-0000-0000-0000-000000000001'
  and p.name in ('Project 001','Project 002','Project 005','Project 006') and t.name in ('Track 1','Track 2');
insert into public.event_judges(id,event_id,email,kind,user_id)
select ('b4300000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  'e4300000-0000-0000-0000-000000000001',
  case when n=5 then 'a3-5@example.test' else 'a3-judge-' || n || '@example.test' end,
  case when n=203 then 'sponsor' else 'general' end,
  case when n=5 then 'd4300000-0000-0000-0000-000000000005'::uuid end from generate_series(1,203)n;
insert into public.judge_track_scopes(judge_id,track_id,event_id)
select 'b4300000-0000-0000-0000-000000000203',id,event_id from public.competition_tracks where name in ('Track 1','Track 2');
insert into public.judging_criteria(id,event_id,position,name)
select ('94300000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,'e4300000-0000-0000-0000-000000000001',n,'Criterion ' || n
from generate_series(1,4)n;
create function pg_temp.score(assignment uuid, event uuid, scores numeric[]) returns void language sql as $$
  insert into public.judging_scores(assignment_id,criterion_id,event_id,score)
  select assignment,('94300000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,event,scores[n] from generate_series(1,4)n;
$$;
-- General reviews: ties with different counts, draft/cancelled exclusions, and
-- enough tied projects to span pages. Project 004 intentionally has no review.
with a as (
  insert into public.judging_assignments(event_id,judge_id,project_id,submitted_at,cancelled)
  select p.event_id,j.id,p.id,
    case when p.name='Project 003' and j.email='a3-judge-2@example.test' then null else now() end,
    p.name='Project 003' and j.email='a3-judge-3@example.test'
  from public.projects p cross join public.event_judges j
  where p.event_id=j.event_id and (
    (j.email='a3-judge-1@example.test' and p.name not in ('Project 004','Project 056','Project 057'))
    or (j.email='a3-judge-2@example.test' and p.name in ('Project 002','Project 003'))
    or (j.email='a3-judge-3@example.test' and p.name='Project 003'))
  returning id,event_id,project_id,judge_id
)
select pg_temp.score(a.id,a.event_id,array_fill(
  case when p.name in ('Project 001','Project 002') or j.email in ('a3-judge-2@example.test','a3-judge-3@example.test') then 5
    when p.name='Project 003' then 4 else 3 end::numeric,array[4]))
from a join public.projects p on p.id=a.project_id join public.event_judges j on j.id=a.judge_id;
-- Two unequal means both display as 4.00; these must NOT be marked tied.
with a as (
  insert into public.judging_assignments(event_id,judge_id,project_id,submitted_at)
  select p.event_id,j.id,p.id,now()
  from public.projects p cross join public.event_judges j
  where p.event_id=j.event_id and ((p.name='Project 056' and j.id<='b4300000-0000-0000-0000-000000000201')
    or (p.name='Project 057' and j.id<='b4300000-0000-0000-0000-000000000202'))
  returning id,event_id,judge_id
)
select pg_temp.score(a.id,a.event_id,array[4,4,4,case when j.email='a3-judge-1@example.test' then 5 else 4 end])
from a join public.event_judges j on j.id=a.judge_id;
with a as (
  insert into public.judging_assignments(event_id,judge_id,project_id,track_id,submitted_at)
  select pt.event_id,'b4300000-0000-0000-0000-000000000203',pt.project_id,pt.track_id,now()
  from public.project_tracks pt
  returning id,event_id,project_id,track_id
)
select pg_temp.score(a.id,a.event_id,array_fill(
  case when t.name='Track 2' then 5 when p.name='Project 001' then 2 else 3 end::numeric,array[4]))
from a join public.projects p on p.id=a.project_id join public.competition_tracks t on t.id=a.track_id;
update public.event_judges set active=false where email='a3-judge-1@example.test';

select no_plan();
select pg_temp.login(1);
select is(jsonb_array_length(pg_temp.results()->'projects'),50,'owner sees bounded results while disabled and before start');
select is(pg_temp.results()->>'has_more','true','detect next page');
select is(pg_temp.results()->>'target','3','general target');
select is(pg_temp.results()->>'track_id',null::text,'general context is null');
select is(pg_temp.project(1)->>'completed','1','inactive judge submitted review still counts');
select is((pg_temp.project(1)->>'average_score')::numeric,5::numeric,'criterion scores are averaged');
select is(pg_temp.project(1)->>'tied','true','tie detected');
select is(pg_temp.project(2)->>'tied','true','different count with same mean is still tied');
select is(pg_temp.project(2)->>'completed','2','submitted reviews counted');
select is(pg_temp.project(3)->>'completed','1','complete-score drafts and cancelled submissions do not count');
select is((pg_temp.project(3)->>'average_score')::numeric,4::numeric,'draft/cancelled scores excluded');
select is(pg_temp.project(3)->>'tied','false','unique mean not tied');
select is(pg_temp.project(4)->>'average_score',null::text,'no reviews means null, not zero');
select is(pg_temp.project(4)->>'completed','0','zero completed reviews');
select is(pg_temp.project(4)->>'insufficient_coverage','true','zero coverage flagged');
select is(pg_temp.project(4)->>'tied','false','unscored projects are not tied');
select is(pg_temp.project(5),null::jsonb,'project draft excluded');
select is(pg_temp.project(6),null::jsonb,'withdrawn project excluded despite submitted reviews');
select is(pg_temp.results()->'projects'->0->>'project_name','Project 001','stable presentation order within tie');
select is(pg_temp.results()->'projects'->2->>'project_name','Project 056','unrounded means sorted descending');
select is(pg_temp.results()->'projects'->3->>'project_name','Project 057','near mean remains separately sorted');
select is(pg_temp.project(56)->>'tied','false','display-rounded equality is not a tie');
select is(pg_temp.project(57)->>'tied','false','second near mean is not tied');
select is(round((pg_temp.project(56)->>'average_score')::numeric,2),round((pg_temp.project(57)->>'average_score')::numeric,2),'near means intentionally display identically');
select is(pg_temp.project(56)->>'completed','201','above-target reviews all count');
select is(pg_temp.project(56)->>'insufficient_coverage','false','above-target is sufficient');
select is(pg_temp.results()->'projects'->49->>'tied','true','tie on first-page boundary');
select is(pg_temp.results(null,2)->'projects'->0->>'tied','true','tie on next page includes earlier page');
select is(jsonb_array_length(pg_temp.results(null,2)->'projects'),5,'last page has remaining eligible projects');
select is(pg_temp.results(null,2)->'projects'->4->>'project_name','Project 004','null averages last');
select is(pg_temp.results(null,2)->>'has_more','false','last page ends');
select is(pg_temp.results(null,3)->'projects','[]'::jsonb,'empty later page');
select is(pg_temp.results(null,2147483647)->'projects','[]'::jsonb,'maximum page offset does not overflow');
select throws_ok($$select pg_temp.results(null,0)$$,'22023','Invalid results page','zero page rejected');
select throws_ok($$select pg_temp.results(null,-1)$$,'22023','Invalid results page','negative page rejected');
select throws_ok($$select pg_temp.results(null,null)$$,'22023','Invalid results page','null page rejected');
select throws_ok($$select pg_temp.results(4)$$,'22023','Results track unavailable for this event','inactive track rejected');
select throws_ok($$select pg_temp.results(5)$$,'22023','Results track unavailable for this event','foreign-event track rejected');
select throws_ok($$select pg_temp.results(99)$$,'22023','Results track unavailable for this event','unknown track rejected');
select is(pg_temp.results(1)->>'target','2','track-specific target');
select is(pg_temp.results(1)->>'track_name','Track 1','context metadata');
select is(jsonb_array_length(pg_temp.results(1)->'projects'),2,'only eligible opted-in projects');
select is((pg_temp.project(1,1)->>'average_score')::numeric,2::numeric,'track one does not reuse general scores');
select is((pg_temp.project(1,2)->>'average_score')::numeric,5::numeric,'track two remains separate');
select is(pg_temp.project(1,1)->>'insufficient_coverage','true','track undercoverage');
select is(pg_temp.project(1,2)->>'insufficient_coverage','false','track target met');
select is(pg_temp.results(1)->'projects'->0->>'project_name','Project 002','track sorted by own average');
select is(pg_temp.results(3)->'projects','[]'::jsonb,'empty active track');
select is(jsonb_array_length(public.admin_judging_results('e4300000-0000-0000-0000-000000000002')->'projects'),1,'other event isolated');
select is(public.admin_judging_results('e4300000-0000-0000-0000-000000000003')->>'target',null::text,'unconfigured event has no invented target');
select is(public.admin_judging_results('e4300000-0000-0000-0000-000000000003')->'projects','[]'::jsonb,'unconfigured event empty');
select is((pg_temp.project(1)-array['project_id','project_name','completed','average_score','insufficient_coverage','tied']),'{}'::jsonb,'minimal aggregate payload; no individual scores, notes or identities');
select throws_ok($$select * from public.judging_assignments$$,'42501',null,'no raw review directory access');
reset role;
update public.event_competition_settings set general_reviews_per_project=1,enabled=true,
  project_submissions_open_at=now()-interval '3 days',project_submissions_close_at=now()-interval '2 days',
  judging_started_at=now()-interval '1 day',judging_close_at=now()-interval '1 hour'
where event_id='e4300000-0000-0000-0000-000000000001';
select pg_temp.login(1);
select is(pg_temp.results()->>'target','1','current changed target used');
select is(pg_temp.project(1)->>'insufficient_coverage','false','coverage follows current target');
select is(pg_temp.project(2)->>'completed','2','above-target count not capped');
select is(jsonb_array_length(pg_temp.results()->'projects'),50,'owner reads after expired deadline and start');
reset role;
select pg_temp.login(2);
select throws_ok($$select pg_temp.results()$$,'42501','Not authorized','organizer denied');
reset role;
select pg_temp.login(3);
select throws_ok($$select pg_temp.results()$$,'42501','Not authorized','reviewer denied');
reset role;
select pg_temp.login(4,'otp');
select throws_ok($$select pg_temp.results()$$,'42501','Not authorized','participant owner denied');
reset role;
select pg_temp.login(5,'otp');
select throws_ok($$select pg_temp.results()$$,'42501','Not authorized','rostered judge denied');
reset role;
select pg_temp.login(1,'otp');
select throws_ok($$select pg_temp.results()$$,'42501','Not authorized','admin email without OAuth denied');
reset role;
set local role anon;
select throws_ok($$select public.admin_judging_results('e4300000-0000-0000-0000-000000000001')$$,'42501',null,'anonymous execute denied');
reset role;
select ok(not has_table_privilege('authenticated','public.judging_assignments','SELECT'),'default-deny review privileges unchanged');
-- Integration with C's real write RPC and A1's extension operation, not just
-- precomputed fixtures. No browser/Auth/PostgREST behavior is implied by this.
insert into public.judging_assignments(id,event_id,judge_id,project_id) values (
  'f4300000-0000-0000-0000-000000000001','e4300000-0000-0000-0000-000000000001',
  'b4300000-0000-0000-0000-000000000005','a4300000-0000-0000-0000-000000000004');
create function pg_temp.save(submit boolean default false) returns jsonb language sql as $$
  select public.judge_save_review('a3-results','f4300000-0000-0000-0000-000000000001',
    '{"94300000-0000-0000-0000-000000000001":5,"94300000-0000-0000-0000-000000000002":5,"94300000-0000-0000-0000-000000000003":5,"94300000-0000-0000-0000-000000000004":5}', '', submit);
$$;
update public.event_judges set briefing_acknowledged_at=now() where id='b4300000-0000-0000-0000-000000000005';
select pg_temp.login(5,'otp');
select throws_ok($$select pg_temp.save()$$,'PT410',null,'expired real score save rejected');
reset role;
select pg_temp.login(2);
select lives_ok($$select public.admin_save_competition_settings(
  'e4300000-0000-0000-0000-000000000001',true,now()-interval '3 days',now()-interval '2 days',now()+interval '1 day',1)
$$,'organizer can extend expired judging through settings RPC');
reset role;
select pg_temp.login(5,'otp');
select lives_ok($$select pg_temp.save()$$,'judge saves full-score draft after extension');
reset role;
select pg_temp.login(1);
select is(pg_temp.project(4)->>'completed','0','real saved draft does not change results count');
select is(pg_temp.project(4)->>'average_score',null::text,'real saved draft does not change mean');
reset role;
select pg_temp.login(5,'otp');
select lives_ok($$select pg_temp.save(true)$$,'judge submits real persisted scorecard');
select lives_ok($$select pg_temp.save(true)$$,'repeat submit keeps one review');
reset role;
select pg_temp.login(1);
select is(pg_temp.project(4)->>'completed','1','real submission counts exactly once');
select is((pg_temp.project(4)->>'average_score')::numeric,5::numeric,'real submitted scores appear in average');
select is(pg_temp.project(4)->>'insufficient_coverage','false','real submission meets current target');
select is(pg_temp.project(4)->>'tied','true','new submitted average joins existing tie');
select is((pg_temp.project(1,1)->>'average_score')::numeric,2::numeric,'general submission leaves sponsor results unchanged');
reset role;
select * from finish(true);
rollback;
