# Organizer project submissions

Organizers/owners browse every project for an event, drafts included, in the admin **Project Submissions** page (`/project-submissions`). Submission Forms (`/submission-forms`) keeps only the submission settings, question builder, team settings, and sponsor tracks. Admissions reviewers do not see the page in the sidebar and are redirected to Forms.

## 1. Development setup

Verify root `.env` targets your **development** database and `apps/admin/.env.local` points to that same Supabase project. Apply the new migration without resetting or reseeding existing events/accounts:

```sh
pnpm db:push
pnpm --filter admin dev
```

The migration is `supabase/migrations/20261121000001_admin_event_projects.sql`. Apply it before deploying the admin app: the page calls its RPCs and fails (rather than showing an empty list) until they exist. The older `admin_submitted_projects` and `admin_submitted_project_detail` RPCs are left in place and are no longer called by the app.

No new dependencies, Auth settings, storage policies, or participant/judge permissions are needed. Sign in through the existing Google admin login with an organizer/owner account.

## 2. Where to look

```text
http://localhost:3002/project-submissions?event=YOUR_SANDBOX_SLUG
```

Event tabs select the event. Status tabs filter the list: **All**, **Draft**, **Submitted**, and **Withdrawn** (shown only when the event has withdrawn projects). Each tab shows the event-wide count for that status. Each row shows:

- Project name.
- Status badge (Draft, Submitted, or Withdrawn).
- Owner display name (or an explicit unnamed-participant fallback).
- Last updated: "Submitted" with the submission time for submitted projects, otherwise "Updated" with the last save time. Times are in America/New_York.
- Required answers: `answered / N required`, where N is the event's active (not archived) required questions. Events with no required questions show "None required".
- A View project link.

Rows are ordered by that displayed time, newest first, with project ID as the tie-breaker. Use Previous/Next for pages of 50. Status and page links preserve the event; switching event or status resets to page 1. No total is invented from the current page; empty later pages have a First page link.

A required question counts as answered when its stored value is non-blank text, a chosen option, a non-empty multiple-choice array, or an uploaded file object. This matches what submission treats as answered; it does not re-run format or length validation.

The detail URL includes the project, event, and list context:

```text
/project-submissions/PROJECT_UUID?event=YOUR_SANDBOX_SLUG&status=draft&projectsPage=1
```

Drafts, submitted, and withdrawn projects open on the same read-only page with a status badge. It shows the question answers (file answers open through short-lived signed links), owner/collaborator names, selected tracks, submission time (submitted projects only), and last-updated time. Back to project submissions returns to the selected event, status, and page. Judging Management results and assignment links open this same page.

## 3. Inclusion and permissions

- Every project status is included. A draft that was submitted and later reopened shows as a draft with its update time.
- Each person is on at most one non-withdrawn project per event ([Project teams](project-teams.md)).
- Disabled events, closed submissions, started judging, or an elapsed judging deadline do not hide projects from organizers.
- This is a current read-only view, not a snapshot. Drafts autosave, so refresh to see the latest content. Saves can move rows between pages.
- Detail event identity must match exactly. A missing/unknown event, malformed project ID, missing project, or wrong event/project pair is not found; detail lookup never falls back to another event.
- Admissions reviewers, judges, participants, and anonymous callers cannot use the organizer RPCs. `project_file_readable` already lets organizers sign any project file, drafts included; judges remain limited to their assignments.
- No profile contact details, application answers, resumes, or scores are included. Viewing never changes project content/status/timestamps or locks submissions.
- Project names and answers render as text. Only HTTP(S) URL answers are clickable.

## 4. Manual verification

1. Sign into admin as organizer/owner. **Project Submissions** appears in the sidebar after Submission Forms; with a reviewer account it does not, and visiting `/project-submissions` redirects to Forms.
2. Select a sandbox event. All lists drafts and submitted projects; the counts on each tab match the rows.
3. Filter by Draft and Submitted. Withdrawn appears only if the event has withdrawn projects.
4. As a participant, save a draft answer to a required question and refresh the admin list: the draft's completion count and Updated time change.
5. Archive a required question in Submission Forms: N drops and answers to it stop counting.
6. Open a draft. Confirm the Draft badge, typed answers, team, and that a file answer opens. Confirm there are no Edit/Save/Submit controls.
7. Use Back to project submissions; event, status, and page are preserved.
8. From Judging Management results or assignments, open a project link: it lands on the same detail page.
9. Submission Forms no longer shows a project list.

## 5. Tests and database contract

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm db:test
```

`49_admin_event_projects_test.sql` covers reviewer/participant/anonymous denial, organizer and owner access, drafts included, status filters and counts, sort order, completion per question type (blank text, empty and null choices, files, optional and archived questions), per-event isolation, draft detail, and organizer signing of draft files. `34_admin_submitted_projects_test.sql` still covers the older submitted-only RPCs.

Admin Vitest tests cover status/page parsing, typed list/detail schemas, RPC arguments, exact event resolution, the redirect for reviewers, rendering of badges, completion, filters, pagination, and read-only draft detail.

Read-only RPCs:

```text
admin_event_projects(p_event_id, p_status = null, p_page = 1)
  -> {projects: [{id, name, status, submitted_at, updated_at, owner, answered_count}],
      has_more, required_count, counts: {draft, submitted, withdrawn}}
admin_project_detail(p_event_id, p_project_id)
  -> {project, owner, collaborators, tracks, answers}
```

Both enforce `has_admin_level('organizer')`, and use fixed search paths. An unknown status or a page below 1 raises `22023`. Direct project/collaborator table access is still denied.
