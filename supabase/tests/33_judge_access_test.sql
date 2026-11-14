begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.judge(n integer,p_email text default null,p_method text default 'otp') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub','df200000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email',coalesce(p_email,'judge-'||n||'@example.test'),'amr',json_build_array(json_build_object('method',p_method)))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.owner() returns void language sql as $$
  select set_config('request.jwt.claims','{"sub":"df200000-0000-0000-0000-000000000005","email":"judge-owner@example.test","amr":[{"method":"oauth"}]}',true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.save(p_email text default 'judge-1@example.test',p_active boolean default true) returns uuid language sql as $$
  select public.admin_save_event_judge('ef200000-0000-0000-0000-000000000001',p_email,'general',p_active,20,'{}',current_setting('test.judge')::uuid);
$$;
insert into auth.users(id,email,email_confirmed_at)
select ('df200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'judge-'||n||'@example.test',
  case when n=3 then null else now() end from generate_series(1,4)n;
insert into auth.users(id,email,email_confirmed_at) values('df200000-0000-0000-0000-000000000005','judge-owner@example.test',now());
insert into public.admin_allowlist(email,level) values('judge-owner@example.test','owner');
insert into public.events(id,slug,name) values
 ('ef200000-0000-0000-0000-000000000001','judge-access-one','Judge access one'),
 ('ef200000-0000-0000-0000-000000000002','judge-access-two','Judge access two');
insert into public.event_competition_settings(event_id) select id from public.events where slug like 'judge-access-%';
select pg_temp.owner();
select set_config('test.judge',public.admin_save_event_judge('ef200000-0000-0000-0000-000000000001','JUDGE-1@example.test','general',true,20)::text,true);
select public.admin_save_event_judge('ef200000-0000-0000-0000-000000000002','judge-1@example.test','general',true,20);
select public.admin_save_event_judge('ef200000-0000-0000-0000-000000000001','judge-2@example.test','general',true,20);
select public.admin_save_event_judge('ef200000-0000-0000-0000-000000000001','judge-3@example.test','general',true,20);
reset role;

select plan(33);
select is((select count(*) from public.applications where user_id='df200000-0000-0000-0000-000000000001'),0::bigint,'judge has no application');
select is((select full_name from public.profiles where id='df200000-0000-0000-0000-000000000001'),null::text,'judge has no onboarding name');
select pg_temp.judge(1);
select is(jsonb_array_length(public.judge_events()),2,'verified email sees only its two roster events, even before enabled/start');
select is(public.judge_event_access('judge-access-one')->>'kind','general','judge without application/name gets event access');
select is(public.judge_event_access('judge-access-one')->>'name','Judge access one','repeated binding is idempotent');
select throws_ok($$select * from public.event_judges$$,'42501',null,'judge cannot browse roster');
select throws_ok($$select * from public.judging_assignments$$,'42501',null,'C1 grants no assignment/project access');
select throws_ok($$select public.current_event_judge_id('ef200000-0000-0000-0000-000000000001')$$,'42501',null,'future authorization helper remains private');
reset role;
select is((select user_id from public.event_judges where id=current_setting('test.judge')::uuid),'df200000-0000-0000-0000-000000000001'::uuid,'roster bound to verified caller ID');
select is(public.current_event_judge_id('ef200000-0000-0000-0000-000000000001'),current_setting('test.judge')::uuid,'private predicate confirms current bound judge for future review RPCs');
select pg_temp.judge(2);
select is(public.judge_event_access('judge-access-two'),null::jsonb,'cannot enter another judge event');
reset role;
select pg_temp.judge(3);
select is(public.judge_events(),'[]'::jsonb,'unconfirmed auth email does not grant access');
select is(public.judge_event_access('judge-access-one'),null::jsonb,'unconfirmed email cannot bind');
reset role;
select pg_temp.judge(4);
select is(public.judge_events(),'[]'::jsonb,'unlisted verified account sees no events');
reset role;
select pg_temp.judge(1,null,'oauth');
select is(public.judge_event_access('judge-access-one'),null::jsonb,'OAuth is not the required judge OTP session');
reset role;
select pg_temp.judge(1,'judge-2@example.test');
select is(public.judge_event_access('judge-access-one'),null::jsonb,'claim email must match current verified Auth email');
reset role;
select pg_temp.owner();
select lives_ok($$select pg_temp.save(p_active=>false)$$,'owner can deactivate bound judge');
reset role;
select pg_temp.judge(1);
select is(public.judge_event_access('judge-access-one'),null::jsonb,'existing session loses event access on next request');
select is(jsonb_array_length(public.judge_events()),1,'deactivation removes only the affected event');
reset role;
select is(public.current_event_judge_id('ef200000-0000-0000-0000-000000000001'),null::uuid,'private predicate also denies existing session after deactivation');
select pg_temp.owner();
select lives_ok($$select pg_temp.save()$$,'reactivation preserves binding');
select throws_ok($$select pg_temp.save('other-account@example.test')$$,'P0001','Email must match the verified account already bound to this judge. Deactivate this judge to replace them.','bound roster cannot be transferred to a different account');
reset role;
update auth.users set email='changed-judge@example.test' where id='df200000-0000-0000-0000-000000000001';
update auth.users set email='judge-1@example.test' where id='df200000-0000-0000-0000-000000000004';
select pg_temp.judge(1);
select is(public.judge_event_access('judge-access-one'),null::jsonb,'old-email JWT denied after current Auth email changes');
reset role;
select pg_temp.judge(4,'judge-1@example.test');
select is(public.judge_event_access('judge-access-one'),null::jsonb,'new owner of same email cannot take an already-bound roster slot');
reset role;
select pg_temp.owner();
select lives_ok($$select pg_temp.save('changed-judge@example.test')$$,'organizer can align email with same bound verified account');
reset role;
select pg_temp.judge(1,'changed-judge@example.test');
select is(public.judge_event_access('judge-access-one')->>'name','Judge access one','fresh-email session accesses corrected binding despite stale profile email');
reset role;
select is((select email from public.profiles where id='df200000-0000-0000-0000-000000000001'),'judge-1@example.test','profile email was not used as identity');
-- Conflicting binding fixture: an unbound matching row must not steal another slot.
update public.event_judges set user_id=null where id=current_setting('test.judge')::uuid;
update public.event_judges set user_id='df200000-0000-0000-0000-000000000001'
where event_id='ef200000-0000-0000-0000-000000000001' and email operator(extensions.=) 'judge-2@example.test'::extensions.citext;
select pg_temp.judge(1,'changed-judge@example.test');
select is(public.judge_event_access('judge-access-one'),null::jsonb,'conflicting event user binding fails closed');
reset role;
update auth.users set email_confirmed_at=now() where id='df200000-0000-0000-0000-000000000003';
select pg_temp.judge(3);
select is(public.judge_event_access('judge-access-one')->>'name','Judge access one','verified account can bind after confirmation');
select is((select count(*) from public.profiles),1::bigint,'no profile directory granted');
select throws_ok($$select public.admin_judge_roster('ef200000-0000-0000-0000-000000000001')$$,'42501','Not authorized','judge is not an admissions reviewer/admin');
reset role;
set local role anon;
select throws_ok($$select public.judge_events()$$,'42501',null,'anonymous judge events denied');
select throws_ok($$select public.judge_event_access('judge-access-one')$$,'42501',null,'anonymous binding denied');
select * from finish(true);
rollback;
