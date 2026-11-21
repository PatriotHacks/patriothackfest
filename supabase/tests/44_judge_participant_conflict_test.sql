begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.organizer() returns void language sql as $$
  select set_config('request.jwt.claims','{"sub":"df400000-0000-0000-0000-000000000099","email":"conflict-organizer@example.test","amr":[{"method":"oauth"}]}',true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.save(p_email text,p_judge uuid default null,p_event uuid default 'ef400000-0000-0000-0000-000000000001') returns uuid language sql as $$
  select (public.admin_save_event_judge(p_event,p_email,'general',true,20,'{}',p_judge)->>'id')::uuid;
$$;
insert into auth.users(id,email,email_confirmed_at)
select ('df400000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'user-'||n||'@example.test',
  case when n=6 then null else now() end from generate_series(1,7)n;
insert into auth.users(id,email,email_confirmed_at) values('df400000-0000-0000-0000-000000000099','conflict-organizer@example.test',now());
insert into public.admin_allowlist(email,level) values('conflict-organizer@example.test','organizer');
insert into public.events(id,slug,name) values
 ('ef400000-0000-0000-0000-000000000001','conflict-one','Conflict one'),
 ('ef400000-0000-0000-0000-000000000002','conflict-two','Conflict two');
insert into public.event_competition_settings(event_id) select id from public.events where slug like 'conflict-%';
insert into public.forms(id,event_id,role,title) values
 ('f4400000-0000-0000-0000-000000000001','ef400000-0000-0000-0000-000000000001','participant','Participant'),
 ('f4400000-0000-0000-0000-000000000002','ef400000-0000-0000-0000-000000000001','volunteer','Volunteer'),
 ('f4400000-0000-0000-0000-000000000003','ef400000-0000-0000-0000-000000000002','participant','Participant');
insert into public.applications(user_id,event_id,role,form_id,status,submitted_at,withdrawn_at) values
 ('df400000-0000-0000-0000-000000000001','ef400000-0000-0000-0000-000000000001','participant','f4400000-0000-0000-0000-000000000001','submitted',now(),null),
 ('df400000-0000-0000-0000-000000000002','ef400000-0000-0000-0000-000000000001','participant','f4400000-0000-0000-0000-000000000001','draft',null,null),
 ('df400000-0000-0000-0000-000000000003','ef400000-0000-0000-0000-000000000001','participant','f4400000-0000-0000-0000-000000000001','withdrawn',now(),now()),
 ('df400000-0000-0000-0000-000000000004','ef400000-0000-0000-0000-000000000001','volunteer','f4400000-0000-0000-0000-000000000002','submitted',now(),null),
 ('df400000-0000-0000-0000-000000000005','ef400000-0000-0000-0000-000000000002','participant','f4400000-0000-0000-0000-000000000003','submitted',now(),null),
 ('df400000-0000-0000-0000-000000000006','ef400000-0000-0000-0000-000000000001','participant','f4400000-0000-0000-0000-000000000001','submitted',now(),null);

select plan(12);
select pg_temp.organizer();
select throws_ok($$select pg_temp.save('user-1@example.test')$$,'P0001','This email has a participant application for this event and cannot be a judge','submitted participant cannot be added as judge');
select throws_ok($$select pg_temp.save(' USER-1@Example.Test ')$$,'P0001','This email has a participant application for this event and cannot be a judge','conflict check is case-insensitive');
select lives_ok($$select pg_temp.save('user-2@example.test')$$,'draft participant application does not block');
select lives_ok($$select pg_temp.save('user-3@example.test')$$,'withdrawn participant application does not block');
select lives_ok($$select pg_temp.save('user-4@example.test')$$,'submitted volunteer application does not block');
select lives_ok($$select pg_temp.save('user-5@example.test')$$,'participant application for another event does not block');
select lives_ok($$select pg_temp.save('user-6@example.test')$$,'unconfirmed Auth email does not block');
select throws_ok($$select pg_temp.save('user-5@example.test',null,'ef400000-0000-0000-0000-000000000002')$$,'P0001','This email has a participant application for this event and cannot be a judge','participant blocked on their own event');
select set_config('test.judge',pg_temp.save('clean@example.test')::text,true);
select throws_ok($$select pg_temp.save('user-1@example.test',current_setting('test.judge')::uuid)$$,'P0001','This email has a participant application for this event and cannot be a judge','existing judge cannot be edited into a participant email');

reset role;
select is((select email::text from public.event_judges where id=current_setting('test.judge')::uuid),'clean@example.test','rejected edit leaves judge unchanged');
insert into public.event_judges(event_id,email,kind,active,capacity,user_id)
values('ef400000-0000-0000-0000-000000000001','user-7@example.test','general',true,20,'df400000-0000-0000-0000-000000000007')
returning set_config('test.bound',id::text,true);
select pg_temp.organizer();
select lives_ok($$select pg_temp.save('user-7@example.test',current_setting('test.bound')::uuid)$$,'bound judge without participant application can be saved');
reset role;
insert into public.applications(user_id,event_id,role,form_id,status,submitted_at) values
 ('df400000-0000-0000-0000-000000000007','ef400000-0000-0000-0000-000000000001','participant','f4400000-0000-0000-0000-000000000001','submitted',now());
update auth.users set email_confirmed_at=null where id='df400000-0000-0000-0000-000000000007';
select pg_temp.organizer();
select throws_ok($$select pg_temp.save('user-7@example.test',current_setting('test.bound')::uuid)$$,'P0001','This email has a participant application for this event and cannot be a judge','bound judge whose account submitted a participant application is blocked');
select * from finish(true);
rollback;
