alter table public.email_templates
  drop constraint email_templates_subject_check,
  drop constraint email_templates_body_check,
  add constraint email_templates_subject_check check (
    subject ~ '\S'
    and char_length(subject) <= 200
    and subject !~ '[\r\n]'
  ),
  add constraint email_templates_body_check check (body ~ '\S' and char_length(body) <= 10000);
