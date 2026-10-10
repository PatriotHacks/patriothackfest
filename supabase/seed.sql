insert into public.events (slug, name, starts_at, ends_at)
values
  ('fall-2026', 'Patriot HackFest Fall 2026', '2026-11-14 09:00 America/New_York', null),
  ('spring-2027', 'Patriot HackFest Spring 2027', '2027-04-10 09:00 America/New_York', null)
on conflict (slug) do update
set name = excluded.name,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at;
