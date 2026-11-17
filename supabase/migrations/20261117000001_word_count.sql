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

-- Same as formatLength in @workspace/forms: '1 word', '2 words'.
create function public.format_length(p_count integer, p_unit text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select p_count || ' ' || case when p_count = 1 then left(p_unit, -1) else p_unit end
$$;

revoke execute on function public.word_count(text), public.format_length(integer, text) from public, anon, authenticated;
