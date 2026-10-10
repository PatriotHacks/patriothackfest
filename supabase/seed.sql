insert into public.events (slug, name)
values
  ('fall-2026', 'Patriot HackFest Fall 2026'),
  ('spring-2027', 'Patriot HackFest Spring 2027')
on conflict (slug) do update
set name = excluded.name;
