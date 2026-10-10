alter table public.events alter column starts_at drop not null;

alter table public.events drop constraint events_check;

alter table public.events add constraint events_dates_check
  check (ends_at is null or (starts_at is not null and ends_at > starts_at));
