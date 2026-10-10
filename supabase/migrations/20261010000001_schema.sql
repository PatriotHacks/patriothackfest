create extension if not exists citext with schema extensions;

create type public.app_role as enum ('participant', 'volunteer', 'judge');
create type public.admin_level as enum ('owner', 'organizer', 'reviewer');
create type public.form_status as enum ('draft', 'published');
create type public.application_status as enum ('draft', 'submitted', 'withdrawn');
create type public.decision as enum ('pending', 'accepted', 'waitlisted', 'rejected');
create type public.field_type as enum (
  'short_text',
  'long_text',
  'email',
  'url',
  'number',
  'date',
  'single_choice',
  'multiple_choice',
  'checkbox',
  'file'
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.admin_allowlist (
  email extensions.citext primary key,
  level public.admin_level not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  role public.app_role not null,
  title text not null,
  description text,
  status public.form_status not null default 'draft',
  submissions_close_at timestamptz,
  edits_lock_at timestamptz,
  published_at timestamptz,
  decisions_released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, role),
  unique (id, event_id, role),
  check (status = 'draft' or (submissions_close_at is not null and edits_lock_at is not null)),
  check (edits_lock_at >= submissions_close_at)
);

create trigger forms_set_updated_at
before update on public.forms
for each row execute function public.set_updated_at();

create table public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  position integer not null,
  type public.field_type not null,
  label text not null,
  help_text text,
  required boolean not null default false,
  options jsonb,
  validation jsonb,
  condition jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    condition is null
    or (
      jsonb_typeof(condition) = 'object'
      and condition ?& array['field_id', 'operator', 'value']
      and condition ->> 'operator' in ('equals', 'includes')
    )
  )
);

create index form_fields_form_id_position_idx on public.form_fields (form_id, position);

create trigger form_fields_set_updated_at
before update on public.form_fields
for each row execute function public.set_updated_at();

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id),
  role public.app_role not null,
  form_id uuid not null,
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  status public.application_status not null default 'draft',
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id),
  foreign key (form_id, event_id, role) references public.forms (id, event_id, role),
  check (status <> 'submitted' or submitted_at is not null),
  check ((status = 'withdrawn') = (withdrawn_at is not null))
);

create index applications_form_id_idx on public.applications (form_id);
create index applications_event_id_idx on public.applications (event_id);

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create function public.prevent_answered_field_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.form_id <> old.form_id then
    raise exception 'Fields cannot be moved between forms';
  end if;

  if new.type <> old.type and exists (
    select 1
    from public.applications a
    where a.form_id = old.form_id
      and a.answers ? old.id::text
  ) then
    raise exception 'Field type cannot change after applications have answered it';
  end if;

  return new;
end;
$$;

create trigger form_fields_prevent_answered_changes
before update on public.form_fields
for each row execute function public.prevent_answered_field_changes();

create table public.application_decisions (
  application_id uuid primary key references public.applications (id) on delete cascade,
  decision public.decision not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz not null default now()
);

create function public.stamp_application_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.decided_by := auth.uid();
  new.decided_at := now();
  return new;
end;
$$;

create trigger application_decisions_stamp
before insert or update on public.application_decisions
for each row execute function public.stamp_application_decision();

create table public.application_archives (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id),
  from_role public.app_role not null,
  to_role public.app_role not null,
  answers jsonb not null,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index application_archives_application_id_idx on public.application_archives (application_id);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  kind text not null,
  recipient text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (application_id, kind)
);
