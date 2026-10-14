delete from public.email_templates;

alter table public.email_templates
  drop constraint email_templates_key_check,
  add constraint email_templates_key_check check (key = 'status_update');

insert into public.email_templates (key, subject, body) values
(
  'status_update',
  $t$There's an update on your Patriot HackFest application$t$,
  $t$Hi {{name}},

There's an update on your application for {{event_name}}. Sign in to the portal to see your current status.$t$
);
