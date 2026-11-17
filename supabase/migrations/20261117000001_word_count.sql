-- Same rule as countWords in @workspace/forms: runs of non-whitespace, where
-- whitespace is exactly the JavaScript \s set.
create function public.word_count(p_value text)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_count(p_value, '[^\t\n\v\f\r    -     　﻿]+')
$$;

revoke execute on function public.word_count(text) from public, anon, authenticated;
