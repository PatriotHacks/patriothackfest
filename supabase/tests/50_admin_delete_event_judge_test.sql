begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.organizer() returns void language sql as $$
  select set_config('request.jwt.claims','{"sub":"df500000-0000-0000-0000-000000000099","email":"delete-organizer@example.test","amr":[{"method":"oauth"}]}',true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.reviewer() returns void language sql as $$
  select set_config('request.jwt.claims','{"sub":"df500000-0000-0000-0000-000000000098","email":"delete-reviewer@example.test","amr":[{"method":"oauth"}]}',true);
  select set_config('role','authenticated',true);
$$;
insert into auth.users(id,email,email_confirmed_at) values
 ('df500000-0000-0000-0000-000000000099','delete-organizer@example.test',now()),
 ('df500000-0000-0000-0000-000000000098','delete-reviewer@example.test',now());
insert into public.admin_allowlist(email,level) values
 ('delete-organizer@example.test','organizer'),('delete-reviewer@example.test','reviewer');
insert into public.events(id,slug,name) values
 ('ef500000-0000-0000-0000-000000000001','delete-one','Delete one'),
 ('ef500000-0000-0000-0000-000000000002','delete-two','Delete two');
insert into public.event_competition_settings(event_id) select id from public.events where slug like 'delete-%';
insert into public.competition_tracks(id,event_id,name) values
 ('c5000000-0000-0000-0000-000000000001','ef500000-0000-0000-0000-000000000001','Sponsor');
insert into public.event_judges(id,event_id,email,kind) values
 ('d5000000-0000-0000-0000-000000000001','ef500000-0000-0000-0000-000000000001','sponsor@example.test','sponsor'),
 ('d5000000-0000-0000-0000-000000000002','ef500000-0000-0000-0000-000000000001','general@example.test','general');
insert into public.judge_track_scopes(judge_id,track_id,event_id) values
 ('d5000000-0000-0000-0000-000000000001','c5000000-0000-0000-0000-000000000001','ef500000-0000-0000-0000-000000000001');

select plan(7);
select pg_temp.reviewer();
select throws_ok($$select public.admin_delete_event_judge('ef500000-0000-0000-0000-000000000001','d5000000-0000-0000-0000-000000000002')$$,'42501','Not authorized','reviewers cannot delete judges');
select pg_temp.organizer();
select throws_ok($$select public.admin_delete_event_judge('ef500000-0000-0000-0000-000000000002','d5000000-0000-0000-0000-000000000002')$$,'PT404','Judge not found for this event','judge must belong to the event');
select is(public.admin_delete_event_judge('ef500000-0000-0000-0000-000000000001','d5000000-0000-0000-0000-000000000001'),'{}'::text[],'sponsor judge with track scopes is deleted and has no documents');
select throws_ok($$select public.admin_delete_event_judge('ef500000-0000-0000-0000-000000000001','d5000000-0000-0000-0000-000000000001')$$,'PT404','Judge not found for this event','deleted judge is gone');
reset role;
select is((select count(*) from public.judge_track_scopes where judge_id='d5000000-0000-0000-0000-000000000001'),0::bigint,'track scopes are removed');
update public.event_competition_settings set judging_started_at=now() where event_id='ef500000-0000-0000-0000-000000000001';
select pg_temp.organizer();
select throws_ok($$select public.admin_delete_event_judge('ef500000-0000-0000-0000-000000000001','d5000000-0000-0000-0000-000000000002')$$,'P0001','Judging has started; deactivate this judge instead','deletion is refused after judging starts');
reset role;
select is((select count(*) from public.event_judges where id='d5000000-0000-0000-0000-000000000002'),1::bigint,'refused deletion keeps the judge');
select * from finish(true);
rollback;
