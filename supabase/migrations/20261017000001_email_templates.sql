create table public.email_templates (
  key text primary key check (key in (
    'accepted',
    'accepted_from_waitlisted',
    'accepted_from_rejected',
    'waitlisted',
    'waitlisted_from_accepted',
    'waitlisted_from_rejected',
    'rejected',
    'rejected_from_accepted',
    'rejected_from_waitlisted'
  )),
  subject text not null check (
    btrim(subject) <> ''
    and char_length(subject) <= 200
    and subject !~ '[\r\n]'
  ),
  body text not null check (btrim(body) <> '' and char_length(body) <= 10000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create function public.stamp_email_template()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger email_templates_stamp
before update on public.email_templates
for each row execute function public.stamp_email_template();

revoke execute on function public.stamp_email_template() from public, anon, authenticated;

revoke all on table public.email_templates from anon, authenticated;

alter table public.email_templates enable row level security;

grant select on public.email_templates to authenticated;
grant update (subject, body) on public.email_templates to authenticated;

create policy "Organizers read email templates"
on public.email_templates for select
to authenticated
using ((select public.has_admin_level('organizer')));

create policy "Organizers update email templates"
on public.email_templates for update
to authenticated
using ((select public.has_admin_level('organizer')))
with check ((select public.has_admin_level('organizer')));

insert into public.email_templates (key, subject, body) values
(
  'accepted',
  $t$You're in: {{event_name}}$t$,
  $t$Hi {{name}},

Congratulations! You've been accepted as a {{role}} for {{event_name}}.

Event details and updates will be posted in the applicant portal.

If you can no longer attend, please decline your spot in the portal so we can offer it to someone on the waitlist.

Applicant portal: {{dashboard_url}}

See you soon,
The Patriot HackFest team$t$
),
(
  'accepted_from_waitlisted',
  $t$A spot opened up at {{event_name}}$t$,
  $t$Hi {{name}},

Good news: a spot opened up, and you've been moved off the waitlist. You're now accepted as a {{role}} for {{event_name}}.

Event details and updates will be posted in the applicant portal.

If you can no longer attend, please decline your spot in the portal so we can offer it to someone on the waitlist.

Applicant portal: {{dashboard_url}}

See you soon,
The Patriot HackFest team$t$
),
(
  'accepted_from_rejected',
  $t$Update on your {{event_name}} application$t$,
  $t$Hi {{name}},

We have an update on your application to be a {{role}} at {{event_name}}. We took another look, and we're happy to let you know you've been accepted.

Event details and updates will be posted in the applicant portal.

If you can no longer attend, please decline your spot in the portal so we can offer it to someone on the waitlist.

Applicant portal: {{dashboard_url}}

See you soon,
The Patriot HackFest team$t$
),
(
  'waitlisted',
  $t$You're on the waitlist for {{event_name}}$t$,
  $t$Hi {{name}},

Thanks for applying to be a {{role}} at {{event_name}}. We received more applications than we have spots, so you're on our waitlist for now.

If a spot opens up, we'll email you right away.

If your plans change, you can leave the waitlist in the applicant portal.

Applicant portal: {{dashboard_url}}

Thanks for your patience,
The Patriot HackFest team$t$
),
(
  'waitlisted_from_accepted',
  $t$Update on your {{event_name}} application$t$,
  $t$Hi {{name}},

We have an update on your application to be a {{role}} at {{event_name}}. We're sorry to share that your earlier acceptance has changed, and you're now on our waitlist instead. We apologize for any confusion.

If a spot opens up, we'll email you right away.

If your plans change, you can leave the waitlist in the applicant portal.

Applicant portal: {{dashboard_url}}

Thanks for your patience,
The Patriot HackFest team$t$
),
(
  'waitlisted_from_rejected',
  $t$Update on your {{event_name}} application$t$,
  $t$Hi {{name}},

We have an update on your application to be a {{role}} at {{event_name}}. We took another look, and you're now on our waitlist.

If a spot opens up, we'll email you right away.

If your plans change, you can leave the waitlist in the applicant portal.

Applicant portal: {{dashboard_url}}

Thanks for your patience,
The Patriot HackFest team$t$
),
(
  'rejected',
  $t$Your {{event_name}} application$t$,
  $t$Hi {{name}},

Thank you for applying to be a {{role}} at {{event_name}}. We received many strong applications, and unfortunately we aren't able to offer you a spot this time.

We truly appreciate your interest and hope you'll apply to a future Patriot HackFest event.

Applicant portal: {{dashboard_url}}

Best,
The Patriot HackFest team$t$
),
(
  'rejected_from_accepted',
  $t$Update on your {{event_name}} application$t$,
  $t$Hi {{name}},

We have an update on your application to be a {{role}} at {{event_name}}. We're sorry to share that your earlier acceptance has changed, and we aren't able to offer you a spot this time. We apologize for any confusion.

We truly appreciate your interest and hope you'll apply to a future Patriot HackFest event.

Applicant portal: {{dashboard_url}}

Best,
The Patriot HackFest team$t$
),
(
  'rejected_from_waitlisted',
  $t$Update on your {{event_name}} application$t$,
  $t$Hi {{name}},

We have an update on your application to be a {{role}} at {{event_name}}. Thank you for your patience while on the waitlist. Unfortunately, we aren't able to offer you a spot this time.

We truly appreciate your interest and hope you'll apply to a future Patriot HackFest event.

Applicant portal: {{dashboard_url}}

Best,
The Patriot HackFest team$t$
);
