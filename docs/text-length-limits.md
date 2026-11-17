# Text length limits

Short and long text questions in application forms and project submissions can
limit answers by characters or by words. Organizers pick the unit next to the
limit in each builder; participants see a live `count/limit unit` counter that
turns red when over.

## Counting

- Characters: trimmed code points for application answers; project answers keep
  their existing count (`length` of the trimmed answer in SQL).
- Words: runs of non-whitespace. Whitespace-only or empty text is 0 words.
  Whitespace is exactly the JavaScript `\s` set (ASCII tab, newline, vertical
  tab, form feed, carriage return, space, plus U+00A0, U+1680, U+2000-U+200A,
  U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF). Zero-width characters such as
  U+200B are not whitespace. `countWords` in `@workspace/forms` and
  `public.word_count` in SQL implement the same rule.

## Limits

- Word limits are at most 1,500 (`MAX_WORD_LIMIT`), enforced by zod and by table
  checks, so a full-length word answer fits under the 10,000-character cap.
- Project answers are always capped at 10,000 characters, whatever the unit.

## Application forms

- The unit lives in `form_fields.validation.length_unit` (`characters` or
  `words`) and applies to both `min_length` and `max_length`.
  `form_fields_text_length_unit_check` allows it only on text fields and caps
  word limits.
- A missing unit means characters. `textValidationSchema` defaults it, and
  `application_answer_errors` reads it the same way, so snapshots published
  before units existed validate exactly as before.
- Errors read "Enter at least N words" / "Enter at most N words".

## Project questions

- The unit is the `project_questions.length_unit` column (enum
  `text_length_unit`, default `characters`). See
  [project-questions.md](project-questions.md).
- Errors read "Use N words or fewer".

Migrations: `20261117000001_word_count.sql`,
`20261117000002_project_question_length_units.sql`,
`20261117000003_application_length_units.sql`. Tests:
`supabase/tests/46_text_length_units_test.sql`,
`packages/forms/src/text-length.test.ts`.
