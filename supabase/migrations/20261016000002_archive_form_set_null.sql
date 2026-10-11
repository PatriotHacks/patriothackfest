alter table public.application_archives
  alter column from_form_id drop not null,
  drop constraint application_archives_from_form_id_fkey,
  add constraint application_archives_from_form_id_fkey
    foreign key (from_form_id) references public.forms (id) on delete set null;
