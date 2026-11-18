# Organizer submitted-project visibility

Organizers/owners can inspect submitted projects inside admin **Submission Forms** (`/submission-forms`). This completes the project-visibility slice of A3, not assignments, review progress, or results.

## 1. Development setup

Verify root `.env` targets your **development** database and `apps/admin/.env.local` points to that same Supabase project. Apply the new migration without resetting or reseeding the events/accounts used for B3/C1:

```sh
pnpm db:push
pnpm --filter admin dev
```

The migration is `supabase/migrations/20261114000001_admin_submitted_projects.sql`. Opening the new view before applying it will fail because its RPCs do not exist yet; do not treat that as an empty project list.

No new dependencies, Auth settings, service-role keys, application eligibility rules, or participant/judge permissions are needed. Sign in through the existing Google admin login with an organizer/owner account.

## 2. Where to look

Open:

```text
http://localhost:3002/submission-forms?event=YOUR_SANDBOX_SLUG
```

The **Submitted projects** section appears at the bottom of the page, after the submission settings, questions, and tracks. Each row shows:

- Project name.
- Owner display name (or an explicit unnamed-participant fallback).
- Selected sponsor tracks, including inactive selections.
- Submission time in America/New_York.
- A View project link.

Use Previous/Next for pages of 50. Page links preserve the event and scroll to the submitted-project section. Switching event tabs resets pagination. No total count is invented from the current page; empty later pages have a First page link.

The detail URL includes both project and event context:

```text
/submission-forms/projects/PROJECT_UUID?event=YOUR_SANDBOX_SLUG&projectsPage=1
```

It shows the project name, question answers, owner/collaborator names, selected tracks, submission time, and last-updated time. Back to submitted projects returns to the selected event/page.

## 3. Inclusion and permissions

- Only `status = submitted` projects appear in list or detail. Drafts and withdrawn projects are excluded, even if a withdrawn project retains its earlier submission timestamp.
- Each person is on at most one non-withdrawn project per event, so a person appears on at most one listed project ([Project teams](project-teams.md)).
- There is no new acceptance/decision-release check on organizer reads. The saved project submission status determines inclusion.
- Disabled events, closed submissions, started judging, or an elapsed judging deadline do not hide submitted projects from organizers.
- This is a current read-only view, not a snapshot. Before closing, participants can still save valid changes or withdraw; refresh to see the current state. New submissions can move rows between pages until closing.
- Detail event identity must match exactly. Missing/unknown event, malformed project ID, draft/withdrawn/missing project, or wrong event/project pair is not found; detail lookup never falls back to another event.
- Admissions reviewers, judges, participants, and anonymous callers cannot use the organizer RPCs. Existing participant/member and judge access remains separate.
- No profile contact details, application answers, resumes, or scores are included. Viewing never changes project content/status/timestamps or locks submissions.
- Project names and answers render as text. Only HTTP(S) URL answers are clickable; no server-side fetching, previews, embeds, or raw HTML rendering.

## 4. Manual verification with your existing B3 data

1. Sign into admin as organizer/owner and select the sandbox used for submission testing.
2. Verify every submitted project is listed. A saved-only draft and withdrawn spare project must not appear.
3. Open View project. Compare content, owner/collaborator names, tracks, and timestamps with the participant's saved submission. Confirm there are no Edit/Save/Withdraw/assignment/score controls.
4. Open a URL answer: it should open a new tab. Viewing must not change the participant's project state or timestamps.
5. Use Back to submitted projects; event and page should be preserved. Switch events and verify only that event's projects appear.
6. Copy a project-detail URL and change its event slug to another/unknown event: not found. A copied draft/withdrawn project ID must also be not found.
7. Open an event with no submissions and verify the empty state. The automated fixtures cover 53 submissions, page boundaries, and tied timestamps if your real sandbox is small.
8. If submissions are still open, save a participant change or withdraw a spare submitted project and refresh admin: content updates or the project disappears, respectively. The admin view itself must not cause either change.
9. If a previously selected track is already inactive, its label must remain visible. Track definitions cannot be changed after Start judging; use a separate pre-judging sandbox if you need to test that case.
10. Confirm existing settings/tracks/judges and the user-verified C1 judge login still work. A reviewer visiting the organizer page redirects to Forms; participant/judge/anonymous attempts are denied by existing admin authentication and the new RPC checks.

Use existing authenticated accounts; this feature does not require a fresh SMTP/OTP setup or new seed data. Automated role tests cover permission cases for which you do not have extra manual accounts.

## 5. Tests and database contract

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
```

The new pgTAP file `34_admin_submitted_projects_test.sql` covers roles/auth methods, submitted-only filtering, event isolation, inactive tracks, bounded stable pagination, invalid pages/overflow, minimal person payloads, unchanged direct-table permissions, and unchanged stored project data.

Admin Vitest tests cover typed/scoped reads, exact event resolution, invalid identity, database failure versus not found, pagination, escaped/read-only rendering, and detail-page authorization/navigation.

Automated database verification uses an isolated local PostgreSQL/pgTAP instance with Supabase SQL fixtures. It does not replace the authenticated click-through above against real development Supabase/PostgREST. No hosted data or Auth settings are changed automatically.

Read-only RPCs:

```text
admin_submitted_projects(p_event_id, p_page = 1)
admin_submitted_project_detail(p_event_id, p_project_id)
```

Both enforce organizer authorization independently and use fixed search paths. Direct project/collaborator table access is still denied. The list returns at most 50 summaries plus a has-more indicator; detail explicitly projects the allowed project/participant/track fields rather than returning full profiles.

The separate [A2 assignment area](judging-assignments.md) adds generation, coverage/loads, and untouched management. [C2/C3](judge-reviews.md) adds judge queues/scorecards; [A3 results](judging-results.md) adds contextual completed-review counts, averages, coverage flags, and ties. This submitted-project detail view remains read-only.
