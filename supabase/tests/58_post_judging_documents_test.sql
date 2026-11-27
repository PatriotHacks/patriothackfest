begin;
create extension if not exists pgtap with schema extensions;
-- 1 organizer, 2 judge A, 3 judge B, 4 signed-in non-judge
create function pg_temp.login(n integer,method text default 'otp') returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object(
    'sub','d5800000-0000-0000-0000-'||lpad(n::text,12,'0'),
    'email','docs-'||n||'@example.test',
    'amr',json_build_array(json_build_object('method',method)),
    'app_metadata',json_build_object('provider',case when method='oauth' then 'google' else 'email' end))::text,true);
  select set_config('role','authenticated',true);
$$;
create function pg_temp.path(p_slot text,p_file integer) returns text language sql as $$
  select 'e5800000-0000-4000-8000-000000000001/'||p_slot||'/c5800000-0000-4000-8000-'||lpad(p_file::text,12,'0')||'.pdf';
$$;
create function pg_temp.cert(p_judge integer,p_file integer) returns text language sql as $$
  select pg_temp.path('certificates/b5800000-0000-4000-8000-'||lpad(p_judge::text,12,'0'),p_file);
$$;
create function pg_temp.letter(p_judge integer,p_file integer) returns text language sql as $$
  select pg_temp.path('invitation-letters/b5800000-0000-4000-8000-'||lpad(p_judge::text,12,'0'),p_file);
$$;
create function pg_temp.upload(p_path text) returns void language sql as $$
  insert into storage.objects(bucket_id,name,metadata)
  values('judge-documents',p_path,jsonb_build_object('size',1000,'mimetype','application/pdf'));
$$;
create function pg_temp.signable(p_name text) returns bigint language sql as $$
  select set_config('storage.operation','storage.object.sign',true);
  select count(*) from storage.objects where bucket_id='judge-documents' and name=p_name;
$$;
create function pg_temp.downloadable(p_name text) returns bigint language sql as $$
  select set_config('storage.operation','storage.object.get_authenticated',true);
  select count(*) from storage.objects where bucket_id='judge-documents' and name=p_name;
$$;
create function pg_temp.set_cert(p_judge integer,p_path text) returns text language sql as $$
  select public.admin_set_judge_certificate('e5800000-0000-4000-8000-000000000001',
    ('b5800000-0000-4000-8000-'||lpad(p_judge::text,12,'0'))::uuid,p_path);
$$;
create function pg_temp.set_letter(p_judge integer,p_path text) returns text language sql as $$
  select public.admin_set_judge_invitation_letter('e5800000-0000-4000-8000-000000000001',
    ('b5800000-0000-4000-8000-'||lpad(p_judge::text,12,'0'))::uuid,p_path);
$$;
create function pg_temp.documents() returns jsonb language sql as $$
  select public.judge_documents('post-judging');
$$;

insert into auth.users(id,email,email_confirmed_at)
select ('d5800000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'docs-'||n||'@example.test',now() from generate_series(1,4)n;
insert into public.admin_allowlist(email,level) values('docs-1@example.test','organizer');
insert into public.events(id,slug,name) values('e5800000-0000-4000-8000-000000000001','post-judging','Post judging');
insert into public.event_competition_settings(event_id,judging_close_at)
values('e5800000-0000-4000-8000-000000000001',now()+interval '1 day');
insert into public.event_judges(id,event_id,email,user_id)
select ('b5800000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'e5800000-0000-4000-8000-000000000001',
  'docs-'||n||'@example.test',('d5800000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid from generate_series(2,3)n;
insert into public.event_judges(id,event_id,email)
values('b5800000-0000-4000-8000-000000000005','e5800000-0000-4000-8000-000000000001','docs-5@example.test');

select plan(45);

-- Writes: organizers only, into valid slots.
select pg_temp.login(2);
select throws_ok(format($$select pg_temp.upload(%L)$$,pg_temp.cert(2,1)),'42501',null,'judge cannot upload');
select throws_ok($$select pg_temp.set_cert(2,null)$$,'42501',null,'judge cannot record a certificate');
select throws_ok($$select pg_temp.set_letter(2,null)$$,'42501',null,'judge cannot record an invitation letter');
select throws_ok($$select public.admin_post_judging_roster('e5800000-0000-4000-8000-000000000001')$$,'42501',null,'judge cannot read the roster');
reset role;

select pg_temp.login(1,'oauth');
select lives_ok(format($$select pg_temp.upload(%L)$$,pg_temp.cert(2,1)),'organizer uploads judge A certificate');
select lives_ok(format($$select pg_temp.upload(%L)$$,pg_temp.cert(3,2)),'organizer uploads judge B certificate');
select lives_ok(format($$select pg_temp.upload(%L)$$,pg_temp.letter(2,3)),'organizer uploads judge A invitation letter');
select throws_ok(format($$select pg_temp.upload(%L)$$,pg_temp.letter(9,4)),'42501',null,'no letters for unknown judges');
select throws_ok(format($$select pg_temp.upload(%L)$$,pg_temp.path('invitation-letter',4)),'42501',null,'no shared event letter');
select throws_ok(format($$select pg_temp.upload(%L)$$,pg_temp.cert(9,4)),'42501',null,'no uploads for unknown judges');
select throws_ok(format($$select pg_temp.upload(%L)$$,'e5800000-0000-4000-8000-000000000001/other.pdf'),'42501',null,'no uploads outside the path scheme');
select throws_ok(format($$select pg_temp.set_cert(2,%L)$$,pg_temp.cert(3,2)),'22023','Upload the file again','cannot record another judge''s file');
select throws_ok(format($$select pg_temp.set_cert(2,%L)$$,pg_temp.cert(2,5)),'22023','Upload the file again','cannot record a file that was not uploaded');
select throws_ok(format($$select pg_temp.set_cert(9,%L)$$,pg_temp.cert(2,1)),'PT404','Judge not found for this event','unknown judge');
select is(pg_temp.set_cert(2,pg_temp.cert(2,1)),null,'records judge A certificate');
select is(pg_temp.set_cert(3,pg_temp.cert(3,2)),null,'records judge B certificate');
select throws_ok(format($$select pg_temp.set_letter(2,%L)$$,pg_temp.cert(2,1)),'22023','Upload the file again','cannot record a certificate as a letter');
select throws_ok(format($$select pg_temp.set_cert(2,%L)$$,pg_temp.letter(2,3)),'22023','Upload the file again','cannot record a letter as a certificate');
select throws_ok(format($$select pg_temp.set_letter(9,%L)$$,pg_temp.letter(2,3)),'PT404','Judge not found for this event','letter for unknown judge');
select is(pg_temp.set_letter(2,pg_temp.letter(2,3)),null,'records judge A invitation letter');
select is(public.admin_post_judging_roster('e5800000-0000-4000-8000-000000000001'),jsonb_build_array(
  jsonb_build_object('id','b5800000-0000-4000-8000-000000000002','email','docs-2@example.test','guest',false,
    'certificate_path',pg_temp.cert(2,1),'invitation_letter_path',pg_temp.letter(2,3)),
  jsonb_build_object('id','b5800000-0000-4000-8000-000000000003','email','docs-3@example.test','guest',false,
    'certificate_path',pg_temp.cert(3,2),'invitation_letter_path',null),
  jsonb_build_object('id','b5800000-0000-4000-8000-000000000005','email','docs-5@example.test','guest',false,
    'certificate_path',null,'invitation_letter_path',null)),'roster shows each judge''s documents');
select ok(not public.judge_document_deletable(pg_temp.cert(2,1)),'recorded certificate cannot be deleted');
select ok(not public.judge_document_deletable(pg_temp.letter(2,3)),'recorded letter cannot be deleted');
select is(pg_temp.signable(pg_temp.cert(3,2)),1::bigint,'organizer can sign any document');
select pg_temp.upload(pg_temp.cert(5,7));
select pg_temp.set_cert(5,pg_temp.cert(5,7));
select pg_temp.upload(pg_temp.letter(5,8));
select pg_temp.set_letter(5,pg_temp.letter(5,8));
select is(public.admin_delete_event_judge('e5800000-0000-4000-8000-000000000001','b5800000-0000-4000-8000-000000000005'),
  array[pg_temp.cert(5,7),pg_temp.letter(5,8)],'deleting a judge returns their document paths');
select ok(public.judge_document_deletable(pg_temp.cert(5,7)),'deleted judge''s certificate can be deleted');
select ok(public.judge_document_deletable(pg_temp.letter(5,8)),'deleted judge''s letter can be deleted');
reset role;

-- Before judging closes judges see nothing.
select pg_temp.login(2);
select is(pg_temp.signable(pg_temp.cert(2,1)),0::bigint,'judge cannot read own certificate before close');
select is(pg_temp.documents(),jsonb_build_object('certificate_path',null,'invitation_letter_path',null),'no documents before close');
reset role;

update public.event_competition_settings set judging_close_at=now()-interval '1 minute'
where event_id='e5800000-0000-4000-8000-000000000001';

select pg_temp.login(2);
select is(pg_temp.signable(pg_temp.cert(2,1)),0::bigint,'judge cannot read when close passed but judging never started');
select is(pg_temp.documents(),jsonb_build_object('certificate_path',null,'invitation_letter_path',null),'no documents when judging never started');
reset role;

update public.event_competition_settings set judging_started_at=now()-interval '1 hour'
where event_id='e5800000-0000-4000-8000-000000000001';

select pg_temp.login(2);
select is(pg_temp.signable(pg_temp.cert(2,1)),1::bigint,'judge reads own certificate after close');
select is(pg_temp.signable(pg_temp.cert(3,2)),0::bigint,'judge cannot read another judge''s certificate');
select is(pg_temp.signable(pg_temp.letter(2,3)),1::bigint,'judge reads own letter after close');
select is(pg_temp.downloadable(pg_temp.cert(2,1)),0::bigint,'no direct downloads');
select is(pg_temp.documents(),jsonb_build_object('certificate_path',pg_temp.cert(2,1),
  'invitation_letter_path',pg_temp.letter(2,3)),'documents listed after close');
reset role;

select pg_temp.login(3);
select is(pg_temp.signable(pg_temp.letter(2,3)),0::bigint,'judge cannot read another judge''s letter');
select is(pg_temp.documents(),jsonb_build_object('certificate_path',pg_temp.cert(3,2),'invitation_letter_path',null),
  'no letter listed when none is recorded');
reset role;

select pg_temp.login(4);
select is(pg_temp.signable(pg_temp.cert(2,1)),0::bigint,'non-judge cannot read certificates');
select is(pg_temp.documents(),null,'non-judge has no documents');
reset role;

-- Replacing returns the previous file, which becomes deletable.
select pg_temp.login(1,'oauth');
select pg_temp.upload(pg_temp.cert(2,6));
select is(pg_temp.set_cert(2,pg_temp.cert(2,6)),pg_temp.cert(2,1),'replacing returns the previous path');
select ok(public.judge_document_deletable(pg_temp.cert(2,1)),'replaced certificate can be deleted');
select pg_temp.upload(pg_temp.letter(2,9));
select is(pg_temp.set_letter(2,pg_temp.letter(2,9)),pg_temp.letter(2,3),'replacing a letter returns the previous path');
select is(pg_temp.set_letter(2,null),pg_temp.letter(2,9),'removing a letter returns its path');
select ok(public.judge_document_deletable(pg_temp.letter(2,9)),'removed letter can be deleted');
reset role;

select * from finish();
rollback;
