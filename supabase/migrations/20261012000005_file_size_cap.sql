alter table public.form_fields add constraint form_fields_file_max_size_check check (
  case
    when not coalesce(validation ? 'max_size_mb', false) then true
    when jsonb_typeof(validation -> 'max_size_mb') <> 'number' then false
    else (validation ->> 'max_size_mb')::numeric > 0 and (validation ->> 'max_size_mb')::numeric <= 10
  end
);
