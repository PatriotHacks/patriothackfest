# Project gallery

Organizers can publish a public, read-only gallery of an event's submitted
projects. Visitors need no account. The gallery shows project names, team member
names, tracks, awards, and the answers to questions an organizer marked public.
Scores, judge notes, sort keys, owner ids, and emails never leave the database.

## Admin layout

- **Submission Forms** (`/submission-forms?event=SLUG`): each project question has
  **Show in gallery** and, for short and long text questions, **Gallery summary**.
  The **Public gallery** section holds **Publish the project gallery**. Both stay
  editable after judging starts, unlike the rest of the question editor. A
  summary question's type is locked until it is unmarked.
- **Awards** (`/awards?event=SLUG`): create, edit, and delete awards (name,
  optional track, rank) and add or remove winning projects.

All writes are organizer-only RPCs; there are no table grants for clients.

## Migration

```text
20261203000001_project_gallery.sql
```

```sh
pnpm db:push
pnpm gen:types
pnpm db:test
```

Apply the migration before deploying the admin or gallery apps; a missing RPC is
a deployment error. `pnpm gen:types` should reproduce the hand-written additions
to `packages/supabase/src/database.types.ts`.

## Schema

- `event_competition_settings.gallery_published` (default false). Unpublished
  events do not exist as far as the public RPCs are concerned.
- `project_questions.gallery_public` and `gallery_summary` (default false). At
  most one active (non-archived) summary question per event, enforced by a
  partial unique index. A check constraint requires the summary to be public and
  `short_text` or `long_text`.
- `projects.gallery_sort_key` (`double precision`, default `random()`). Chosen once
  per project, including existing projects when the migration ran, and never
  changed. Every visitor sees the same order.
- `awards`: `name` (1-120 characters), optional `track_id` (a track of the same
  event), `rank` (1-1,000, lower is better; ties allowed).
- `project_awards (award_id, project_id)`, with `event_id` tying both to the same
  event. Deleting an award removes its winners.

The question freeze trigger (`prevent_judging_content_changes`) now skips updates
that change only `gallery_public` and `gallery_summary`, so visibility can be set
after judging starts. Any other question change is still locked.

## Admin RPCs (organizer)

| RPC                                                                                  | Notes                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `admin_set_gallery_published(p_event_id, p_value)`                                   | Requires saved competition settings.                                                                                                             |
| `admin_set_project_question_gallery(p_event_id, p_question_id, p_public, p_summary)` | Rejects public file/email questions, a hidden summary, and a non-text summary. Marking a summary unmarks the event's previous one.               |
| `admin_project_questions(p_event_id)`                                                | Now also returns `gallery_public` and `gallery_summary`.                                                                                         |
| `admin_save_award(p_event_id, p_name, p_rank, p_track_id?, p_award_id?)`             | Returns the award id. A new track must be active; an existing inactive track may be kept. Changing the track fails while a winner is outside it. |
| `admin_delete_award(p_event_id, p_award_id)`                                         |                                                                                                                                                  |
| `admin_assign_award(p_event_id, p_award_id, p_project_id)`                           | Submitted projects only. A track award needs a project entered in that track. Assigning twice is a no-op.                                        |
| `admin_unassign_award(p_event_id, p_award_id, p_project_id)`                         |                                                                                                                                                  |
| `admin_awards(p_event_id)`                                                           | `{awards:[{id,name,rank,track_id,projects:[{id,name,status}]}], projects:[{id,name,track_ids}]}`; `projects` lists every submitted project.      |

A winner whose project is later withdrawn keeps the award row but disappears from
the gallery; the Awards page marks it as hidden.

## Public RPCs (anon and authenticated)

All three are `stable security definer` and return `null` rather than an error for
anything not public.

- `gallery_events()`: `[{slug, name, starts_at}]` for published events, newest
  `starts_at` first (events without a start date last).
- `gallery_projects(p_event_slug)`: `null` unless the event exists and is
  published.

  ```text
  {event:{slug,name},
   tracks:[{id,name,sponsor}],
   awards:[{id,name,rank,track_id}],
   projects:[{id,name,summary,tracks:[{id,name}],awards:[{id,name,rank}]}]}
  ```

- `gallery_project(p_event_slug, p_project_id)`: `null` unless the event is
  published and the project is submitted in that event.

  ```text
  {event:{slug,name}, project:{id,name}, answers:[...], team:[...],
   tracks:[{id,name}], awards:[{id,name,rank}]}
  ```

## Rules

- Only `status = 'submitted'` projects appear. Drafts and withdrawn projects are
  absent from lists and return `null` from `gallery_project`.
- Project order: projects with at least one award first, by their best (lowest)
  award rank, ties broken by `gallery_sort_key`; then every other project by
  `gallery_sort_key`. Project id is the final tie-break.
- Event `awards` and each project's `awards` are sorted by rank, then name.
- `tracks` lists only active tracks, by name; a project's `tracks` likewise.
- `summary` is the full answer to the event's summary question, or `null` when
  there is no summary question or the project left it blank.
- `answers` has the same element shape as the judge view
  (`{question_id, label, type, options, answer}`), in question position order.
  It includes only non-archived questions with `gallery_public`, and always
  excludes `file` and `email` questions even if flagged, so file paths are never
  public. Choice answers are option ids; `options` maps them to labels.
- `section` questions are headings: included (with a `null` answer) only when
  flagged public. Project questions cannot currently be `section` or `email`
  types; the filters exist so the gallery stays safe if those types are added.
- `team` matches the judge view: display names only, owner first, then
  collaborators by join time. A member without a name is `null`.
- Publishing exposes team member names to anyone. Tell participants before
  publishing.
