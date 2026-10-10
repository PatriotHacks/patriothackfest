create function public.current_admin_level()
returns public.admin_level
language sql
stable
security definer
set search_path = ''
as $$
  select a.level
  from public.admin_allowlist a
  where a.email operator(extensions.=) lower(auth.jwt() ->> 'email')::extensions.citext
    and auth.jwt() -> 'app_metadata' ->> 'provider' = 'google'
$$;

create function public.has_admin_level(min_level public.admin_level)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    where public.current_admin_level() <= min_level
  )
$$;

create function public.form_decisions_released(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications a
    join public.forms f on f.id = a.form_id
    where a.id = p_application_id
      and f.decisions_released_at is not null
  )
$$;

revoke all on table
  public.events,
  public.profiles,
  public.admin_allowlist,
  public.forms,
  public.form_fields,
  public.applications,
  public.application_decisions,
  public.application_archives,
  public.email_log
from anon, authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.current_admin_level() to authenticated;
grant execute on function public.has_admin_level(public.admin_level) to authenticated;
grant execute on function public.form_decisions_released(uuid) to authenticated;

alter table public.events enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_allowlist enable row level security;
alter table public.forms enable row level security;
alter table public.form_fields enable row level security;
alter table public.applications enable row level security;
alter table public.application_decisions enable row level security;
alter table public.application_archives enable row level security;
alter table public.email_log enable row level security;

grant select on public.events to anon, authenticated;

create policy "Events are public"
on public.events for select
to anon, authenticated
using (true);

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "Users read own profile, reviewers read all"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or (select public.has_admin_level('reviewer')));

create policy "Users update own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

grant select, insert, update, delete on public.admin_allowlist to authenticated;

create policy "Owners read allowlist"
on public.admin_allowlist for select
to authenticated
using ((select public.has_admin_level('owner')));

create policy "Owners add allowlist entries"
on public.admin_allowlist for insert
to authenticated
with check ((select public.has_admin_level('owner')) and created_by = (select auth.uid()));

create policy "Owners update allowlist entries"
on public.admin_allowlist for update
to authenticated
using ((select public.has_admin_level('owner')))
with check ((select public.has_admin_level('owner')));

create policy "Owners delete allowlist entries"
on public.admin_allowlist for delete
to authenticated
using ((select public.has_admin_level('owner')));

grant select, insert, update, delete on public.forms to authenticated;

create policy "Published forms, own application forms, and all forms for reviewers are readable"
on public.forms for select
to authenticated
using (
  status = 'published'
  or (select public.has_admin_level('reviewer'))
  or exists (
    select 1
    from public.applications a
    where a.form_id = forms.id
      and a.user_id = (select auth.uid())
  )
);

create policy "Organizers create forms"
on public.forms for insert
to authenticated
with check ((select public.has_admin_level('organizer')));

create policy "Organizers update forms"
on public.forms for update
to authenticated
using ((select public.has_admin_level('organizer')))
with check ((select public.has_admin_level('organizer')));

create policy "Organizers delete forms"
on public.forms for delete
to authenticated
using ((select public.has_admin_level('organizer')));

grant select, insert, update, delete on public.form_fields to authenticated;

create policy "Fields of readable forms are readable"
on public.form_fields for select
to authenticated
using (exists (select 1 from public.forms f where f.id = form_fields.form_id));

create policy "Organizers create fields"
on public.form_fields for insert
to authenticated
with check ((select public.has_admin_level('organizer')));

create policy "Organizers update fields"
on public.form_fields for update
to authenticated
using ((select public.has_admin_level('organizer')))
with check ((select public.has_admin_level('organizer')));

create policy "Organizers delete fields"
on public.form_fields for delete
to authenticated
using ((select public.has_admin_level('organizer')));

grant select on public.applications to authenticated;

create policy "Applicants read own applications, reviewers read all"
on public.applications for select
to authenticated
using (user_id = (select auth.uid()) or (select public.has_admin_level('reviewer')));

grant select, insert, update on public.application_decisions to authenticated;

create policy "Reviewers read decisions, applicants read own released decisions"
on public.application_decisions for select
to authenticated
using (
  (select public.has_admin_level('reviewer'))
  or (
    exists (
      select 1
      from public.applications a
      where a.id = application_decisions.application_id
        and a.user_id = (select auth.uid())
    )
    and public.form_decisions_released(application_id)
  )
);

create policy "Reviewers set decisions before release, organizers any time"
on public.application_decisions for insert
to authenticated
with check (
  (select public.has_admin_level('organizer'))
  or ((select public.has_admin_level('reviewer')) and not public.form_decisions_released(application_id))
);

create policy "Reviewers change decisions before release, organizers any time"
on public.application_decisions for update
to authenticated
using (
  (select public.has_admin_level('organizer'))
  or ((select public.has_admin_level('reviewer')) and not public.form_decisions_released(application_id))
)
with check (
  (select public.has_admin_level('organizer'))
  or ((select public.has_admin_level('reviewer')) and not public.form_decisions_released(application_id))
);

grant select on public.application_archives to authenticated;

create policy "Reviewers read archives"
on public.application_archives for select
to authenticated
using ((select public.has_admin_level('reviewer')));

grant select on public.email_log to authenticated;

create policy "Organizers read email log"
on public.email_log for select
to authenticated
using ((select public.has_admin_level('organizer')));
