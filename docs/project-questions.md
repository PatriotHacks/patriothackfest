# Project paragraph questions

Organizers can add per-event paragraph questions to the project submission form.
Participants answer them alongside the fixed project fields; organizers always see
the answers, and judges see them only when the per-event switch is on.

## Admin layout

The organizer console has two competition pages (organizer/owner only):

- **Submission Forms** (`/submission-forms?event=SLUG`): submission enablement and
  open/close dates, paragraph questions, the **Judges can see question answers**
  switch, sponsor tracks, and the submitted-projects list. Project detail lives at
  `/submission-forms/projects/PROJECT_UUID?event=SLUG&projectsPage=N` and shows
  answers with their question labels.
- **Judging Management** (`/judging?event=SLUG`): judging end, general reviews per
  project, Start judging, judge roster, assignments, and results.

Both settings forms still save through `admin_save_competition_settings`. Each
server action reads the stored settings row and overwrites only its own fields, so
the two pages do not clobber each other's saved values.

## Behavior

- Each question has a label (1-300 characters), optional help text (up to 1,000),
  a required flag, and a maximum answer length (1-10,000, default 5,000).
- Questions can be added, edited, reordered, and archived until **Start judging**;
  after that they are permanently locked (RPC check plus the shared freeze trigger).
- Archiving is a soft delete. Archived questions disappear from the participant
  form, judge view, and organizer project detail; only active questions are ever
  shown. A participant's next save drops answers to archived questions.
- Answers are trimmed and length-checked in the database. Required questions apply
  on submit and on any save of an already-submitted project. Adding a required
  question later does not unsubmit existing projects; the requirement applies the
  next time the owner saves.
- Saving with an unknown or archived question id fails with a reload message, like
  other stale-form errors. Per-question errors are returned in the `PT422` detail
  map under `answers.<question_id>`.
- **Judges can see question answers** is one per-event switch, off by default. It
  can be changed at any time, including after judging starts or ends. Filtering
  happens in SQL: with the switch off, `judge_assignment` returns `answers: []`.

## Database contract

Migration: `supabase/migrations/20261115000004_project_questions.sql`.

```text
project_questions                       default-deny table, RLS on
event_competition_settings.judges_see_answers
projects.answers                        jsonb object: question id -> answer text

admin_project_questions(p_event_id)                      active questions by position
admin_save_project_question(p_event_id, p_label, p_help_text, p_required, p_max_length, p_question_id)
admin_archive_project_question(p_event_id, p_question_id)
admin_reorder_project_questions(p_event_id, p_question_ids)   every active id once
admin_set_judges_see_answers(p_event_id, p_value)
participant_save_project(p_project_id, p_content, p_answers, p_track_ids, p_submit, p_expected_updated_at)
```

`participant_project_detail` adds `questions` (active, ordered) and the project's
`answers`. `judge_assignment` adds `answers: [{label, answer}]`.
`admin_submitted_project_detail` adds `answers: [{question_id, label, answer}]`
regardless of the switch.

## Verification

`supabase/tests/43_project_questions_test.sql` covers organizer-only access,
ordering, the judging freeze, the always-editable switch, answer validation, late
required questions, archived questions, and judge/organizer visibility.

Manual check on a development sandbox: add a required and an optional question,
submit a project as a participant, add another required question and confirm the
project stays submitted but the next save asks for it, then start judging and
toggle the switch while viewing a judge scorecard.
