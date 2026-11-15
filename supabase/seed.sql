insert into public.events (slug, name)
values
  ('fall-2026', 'Patriot HackFest Fall 2026'),
  ('spring-2027', 'Patriot HackFest Spring 2027')
on conflict (slug) do update
set name = excluded.name;

-- Defaults only: never enable the competition or replace organizer-set dates.
insert into public.event_competition_settings (event_id, project_submissions_open_at, judging_close_at)
select id, '2026-11-15 00:00:00-05'::timestamptz, '2026-11-21 00:00:00-05'::timestamptz
from public.events where slug = 'fall-2026'
on conflict (event_id) do nothing;
