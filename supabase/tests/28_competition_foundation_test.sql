begin;
create extension if not exists pgtap with schema extensions;

create function pg_temp.login(p_email text, p_method text default 'oauth')
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', (select id from public.profiles where email = p_email),
    'email', p_email, 'role', 'authenticated',
    'amr', json_build_array(json_build_object('method', p_method))
  )::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.save_settings(
  p_enabled boolean default true,
  p_close timestamptz default null,
  p_end timestamptz default now() + interval '2 days',
  p_open timestamptz default now() - interval '2 days'
)
returns void language sql as $$
  select public.admin_save_competition_settings('ec000000-0000-0000-0000-000000000001', p_enabled, p_open, p_close, p_end, 3);
$$;

insert into auth.users (id, email) values
  ('dc000000-0000-0000-0000-000000000001', 'competition-owner@example.test'),
  ('dc000000-0000-0000-0000-000000000002', 'competition-organizer@example.test'),
  ('dc000000-0000-0000-0000-000000000003', 'competition-reviewer@example.test'),
  ('dc000000-0000-0000-0000-000000000004', 'competition-participant@example.test');
insert into public.admin_allowlist (email, level) values
  ('competition-owner@example.test', 'owner'),
  ('competition-organizer@example.test', 'organizer'),
  ('competition-reviewer@example.test', 'reviewer');
insert into public.events (id, slug, name) values
  ('ec000000-0000-0000-0000-000000000001', 'competition-test-1', 'Competition test one'),
  ('ec000000-0000-0000-0000-000000000002', 'competition-test-2', 'Competition test two');

select plan(64);

select is((select count(*) from pg_class where relname in (
  'event_competition_settings', 'competition_tracks', 'projects', 'project_collaborators',
  'project_tracks', 'event_judges', 'judge_track_scopes', 'judging_assignments'
) and relnamespace = 'public'::regnamespace and relrowsecurity), 8::bigint, 'all eight tables have RLS');
select ok(not has_table_privilege('authenticated', 'public.projects', 'SELECT'), 'projects are denied until Person B adds access');
select ok(not has_table_privilege('authenticated', 'public.project_collaborators', 'SELECT'), 'collaborators default deny');
select ok(not has_table_privilege('authenticated', 'public.project_tracks', 'SELECT'), 'project tracks default deny');
select ok(not has_table_privilege('authenticated', 'public.event_judges', 'SELECT'), 'judge roster default deny');
select ok(not has_table_privilege('authenticated', 'public.judge_track_scopes', 'SELECT'), 'judge scopes default deny');
select ok(not has_table_privilege('authenticated', 'public.judging_assignments', 'SELECT'), 'assignments default deny');

select pg_temp.login('competition-reviewer@example.test');
select throws_ok($$select pg_temp.save_settings()$$, '42501', 'Not authorized', 'reviewer cannot configure judging');
select throws_ok($$select public.admin_start_judging('ec000000-0000-0000-0000-000000000001')$$, '42501', 'Not authorized', 'reviewer cannot start judging');
select throws_ok($$select public.admin_save_competition_track('ec000000-0000-0000-0000-000000000001', 'Track', '', '', 1, true)$$, '42501', 'Not authorized', 'reviewer cannot add tracks');
reset role;

select pg_temp.login('competition-owner@example.test', 'otp');
select throws_ok($$select pg_temp.save_settings()$$, '42501', 'Not authorized', 'owner email with OTP is not an admin session');
reset role;

select pg_temp.login('competition-organizer@example.test');
select lives_ok($$select pg_temp.save_settings(false, null, null, null)$$, 'organizer can configure a disabled undated event');
select ok(not (select enabled from public.event_competition_settings where event_id = 'ec000000-0000-0000-0000-000000000001'), 'competition is not automatically enabled');
select throws_ok($$select pg_temp.save_settings(true, null, null, null)$$, '23514', null, 'enabled settings require dates');
select throws_ok($$select pg_temp.save_settings(true, now() - interval '3 days')$$, '23514', null, 'closing cannot precede opening');
select throws_ok($$select pg_temp.save_settings(true, now() + interval '3 days')$$, '23514', null, 'judging end must follow submission closing');
select throws_ok($$select public.admin_save_competition_settings('ec000000-0000-0000-0000-000000000001', true, now(), null, now() + interval '1 day', 0)$$, '23514', null, 'invalid review count rejected');
select lives_ok($$select pg_temp.save_settings()$$, 'enabled submissions may have no scheduled closing');
select throws_ok($$select public.admin_start_judging('ec000000-0000-0000-0000-000000000001')$$, 'P0001', 'Submissions must be closed before judging starts', 'unset closing blocks judging');
select lives_ok($$select pg_temp.save_settings(true, now() + interval '1 hour')$$, 'closing can be scheduled');
select throws_ok($$select public.admin_start_judging('ec000000-0000-0000-0000-000000000001')$$, 'P0001', 'Submissions must be closed before judging starts', 'future closing blocks judging');
select throws_ok($$update public.event_competition_settings set enabled = false$$, '42501', null, 'direct settings updates cannot bypass lifecycle RPC');
select throws_ok($$select public.admin_save_competition_settings('ec000000-0000-0000-0000-000000000099', false, null, null, null, 3)$$, 'P0001', 'Event not found', 'unknown event rejected');
select throws_ok($$select public.admin_start_judging('ec000000-0000-0000-0000-000000000002')$$, 'P0001', 'Configure competition settings first', 'unconfigured event cannot start');
select lives_ok($$select public.admin_save_competition_settings('ec000000-0000-0000-0000-000000000002', false, null, null, null, 3)$$, 'second event independently configurable');

select set_config('test.competition_track', public.admin_save_competition_track('ec000000-0000-0000-0000-000000000001', '  Track A  ', ' Sponsor ', ' Description ', 1, true)::text, true);
select is((select name from public.competition_tracks where id = current_setting('test.competition_track')::uuid), 'Track A', 'track names trimmed');
select throws_ok($$select public.admin_save_competition_track('ec000000-0000-0000-0000-000000000001', 'track a', '', '', 1, true)$$, '23505', null, 'duplicate names are case insensitive within event');
select throws_ok($$select public.admin_save_competition_track('ec000000-0000-0000-0000-000000000001', ' ', '', '', 1, true)$$, '23514', null, 'blank track name rejected');
select throws_ok($$select public.admin_save_competition_track('ec000000-0000-0000-0000-000000000001', 'Bad target', '', '', 0, true)$$, '23514', null, 'invalid sponsor review target rejected');
select lives_ok($$select public.admin_save_competition_track('ec000000-0000-0000-0000-000000000001', 'Track A', '', '', 2, false, current_setting('test.competition_track')::uuid)$$, 'track can be edited/deactivated');
select throws_ok($$select public.admin_save_competition_track('ec000000-0000-0000-0000-000000000002', 'Track A', '', '', 1, true, current_setting('test.competition_track')::uuid)$$, 'P0001', 'Track not found for this event', 'track edits cannot cross events');
select set_config('test.other_track', public.admin_save_competition_track('ec000000-0000-0000-0000-000000000002', 'Track A', '', '', 1, true)::text, true);
select lives_ok($$select public.admin_save_competition_track('ec000000-0000-0000-0000-000000000001', 'Track B', '', '', 1, true)$$, 'second active track can be added');
reset role;

select pg_temp.login('competition-participant@example.test', 'otp');
select is((select count(*) from public.event_competition_settings where event_id in ('ec000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000002')), 1::bigint, 'participant reads enabled event settings only');
select is((select count(*) from public.competition_tracks where event_id in ('ec000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000002')), 1::bigint, 'participant reads only active tracks on enabled events');
select throws_ok($$select pg_temp.save_settings()$$, '42501', 'Not authorized', 'participant cannot change settings');
select throws_ok($$insert into public.projects(event_id, owner_user_id) values ('ec000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000004')$$, '42501', null, 'participant cannot write project skeleton directly');
reset role;

set local role anon;
select throws_ok($$select * from public.event_competition_settings$$, '42501', null, 'anonymous settings reads denied');
select throws_ok($$select public.admin_start_judging('ec000000-0000-0000-0000-000000000001')$$, '42501', null, 'anonymous RPC execution denied');
reset role;

-- Privileged fixture setup only: client project/judge workflows belong to B/C.
insert into public.projects (id, event_id, owner_user_id) values
  ('ac000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000004'),
  ('ac000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000004');
select is((select count(*) from public.projects where owner_user_id = 'dc000000-0000-0000-0000-000000000004'), 2::bigint, 'one person may own multiple projects');
select throws_ok($$insert into public.project_tracks values ('ac000000-0000-0000-0000-000000000001', current_setting('test.other_track')::uuid, 'ec000000-0000-0000-0000-000000000001')$$, '23503', null, 'project cannot select another event track');
insert into public.project_tracks values ('ac000000-0000-0000-0000-000000000001', current_setting('test.competition_track')::uuid, 'ec000000-0000-0000-0000-000000000001');
insert into public.event_judges (id, event_id, email) values
  ('bc000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'judge@example.test');
insert into public.judge_track_scopes values ('bc000000-0000-0000-0000-000000000001', current_setting('test.competition_track')::uuid, 'ec000000-0000-0000-0000-000000000001');

select pg_temp.login('competition-owner@example.test');
select lives_ok($$select pg_temp.save_settings(false, now() - interval '1 hour')$$, 'disabled event can have a past closing');
select throws_ok($$select public.admin_start_judging('ec000000-0000-0000-0000-000000000001')$$, 'P0001', 'Enable this competition first', 'disabled event cannot start');
select lives_ok($$select pg_temp.save_settings(true, now() - interval '1 hour', now() - interval '1 minute')$$, 'expired deadline is representable');
select throws_ok($$select public.admin_start_judging('ec000000-0000-0000-0000-000000000001')$$, 'P0001', 'Judging deadline must be in the future', 'expired judging cannot start');
select lives_ok($$select pg_temp.save_settings(true, now() - interval '1 hour')$$, 'expired deadline can be extended');
select lives_ok($$select public.admin_start_judging('ec000000-0000-0000-0000-000000000001')$$, 'owner starts judging after closing');
select ok((select judging_started_at is not null from public.event_competition_settings where event_id = 'ec000000-0000-0000-0000-000000000001'), 'start timestamp persisted');
select set_config('test.started_at', (select judging_started_at::text from public.event_competition_settings where event_id = 'ec000000-0000-0000-0000-000000000001'), true);
select lives_ok($$select public.admin_start_judging('ec000000-0000-0000-0000-000000000001')$$, 'starting again is idempotent');
select is((select judging_started_at::text from public.event_competition_settings where event_id = 'ec000000-0000-0000-0000-000000000001'), current_setting('test.started_at'), 'repeat start preserves timestamp');
select throws_ok($$select pg_temp.save_settings(true, now() + interval '1 hour')$$, 'P0001', 'Submission settings are locked after judging starts', 'cannot reopen submissions');
select throws_ok($$select pg_temp.save_settings(false, now() - interval '1 hour')$$, 'P0001', 'Submission settings are locked after judging starts', 'cannot disable/restart a started event');
select lives_ok($$select pg_temp.save_settings(true, now() - interval '1 hour', now() - interval '1 minute')$$, 'judging deadline may be shortened into past');
select lives_ok($$select pg_temp.save_settings(true, now() - interval '1 hour', now() + interval '4 days')$$, 'post-expiry extension works after judging starts');
select throws_ok($$select public.admin_save_competition_track('ec000000-0000-0000-0000-000000000001', 'New track', '', '', 1, true)$$, 'P0001', 'Project content and tracks are locked after judging starts', 'new track rejected after start');
select throws_ok($$select public.admin_save_competition_track('ec000000-0000-0000-0000-000000000001', 'Renamed', '', '', 1, true, current_setting('test.competition_track')::uuid)$$, 'P0001', 'Project content and tracks are locked after judging starts', 'existing track frozen');
select ok((select judging_started_at is null from public.event_competition_settings where event_id = 'ec000000-0000-0000-0000-000000000002'), 'other event remains unstarted');
reset role;

select throws_ok($$update public.projects set name = 'Changed' where id = 'ac000000-0000-0000-0000-000000000001'$$, 'P0001', 'Project content and tracks are locked after judging starts', 'even definer-style project writes hit freeze trigger');
select throws_ok($$insert into public.project_collaborators values ('ac000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000001')$$, 'P0001', 'Project content and tracks are locked after judging starts', 'collaborators frozen');
select throws_ok($$delete from public.project_tracks where project_id = 'ac000000-0000-0000-0000-000000000001'$$, 'P0001', 'Project content and tracks are locked after judging starts', 'track selections frozen');

insert into public.judging_assignments (event_id, judge_id, project_id) values
  ('ec000000-0000-0000-0000-000000000001', 'bc000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000001');
select throws_ok($$insert into public.judging_assignments (event_id, judge_id, project_id) values ('ec000000-0000-0000-0000-000000000001', 'bc000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000001')$$, '23505', null, 'NULL general context cannot duplicate');
select throws_ok($$update public.judging_assignments set creativity_score = 6$$, '23514', null, 'out of range score rejected');
select throws_ok($$update public.judging_assignments set submitted_at = now()$$, '23514', null, 'incomplete scorecard cannot be submitted');
update public.judging_assignments set creativity_score = 2, technical_score = 3, impact_score = 4, presentation_score = 5, submitted_at = now();
select is((select total_score::integer from public.judging_assignments where project_id = 'ac000000-0000-0000-0000-000000000001'), 14, 'database calculates score total');
select throws_ok($$insert into public.judging_assignments (event_id, judge_id, project_id, track_id) values ('ec000000-0000-0000-0000-000000000001', 'bc000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000002', current_setting('test.competition_track')::uuid)$$, '23503', null, 'sponsor assignment requires project track opt-in');

select * from finish(true);
rollback;
