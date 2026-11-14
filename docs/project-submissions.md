# Participant project submissions: test and handoff

This implements Person B's workflow on `feat/submissions-and-judging`. Assignment generation/results (A2/A3) and judge roster/scorecards (Person C) remain separate work. Nothing here creates another deployment or changes admissions decisions/deadlines.

## What's available

- `/projects`: your eligible enabled events, plus events containing a project you own/collaborate on.
- `/projects/[eventSlug]`: owned and collaborated projects; multiple projects per person are allowed.
- `/projects/[eventSlug]/[projectId]`: collaborator setup and, after opening, content editing/submission.
- Owner-only creation/editing/submission/withdrawal; collaborators can view.
- Exact-email addition of registered eligible collaborators; no user directory or invitations.
- Save draft, Submit project, Save changes, and final pre-close withdrawal.
- Optional multi-track selection; all submitted projects enter general judging.
- Closed/disabled/withdrawn projects remain readable to associated people, but not editable.
- OTP login returns to a validated project link without changing ordinary admissions login routing.

## 1. Apply to a development project

Ensure the root `.env` database URL and both apps' `.env.local` URL/publishable keys refer to your **development** Supabase project. Do not run these commands against production by accident.

```sh
pnpm install --frozen-lockfile
pnpm db:push
pnpm db:test
```

Three forward migrations follow Person A's foundation:

```text
20261113000001_participant_project_reads.sql
20261113000002_project_collaborators.sql
20261113000003_project_submission_lifecycle.sql
```

Do not edit/reapply the older foundation migration. Existing events/settings do not require reseeding. The current CLI seed command may reject multiple SQL statements; if you need initial events, use the existing seed workaround or create the sandbox event below in the development SQL Editor.

## 2. Prepare an actual browser rehearsal

Use addresses you control for:

- Participant A: submitted and accepted application.
- Participant B: submitted and accepted application (collaborator).
- Participant C: submitted but not accepted.
- Organizer: Google OAuth and owner/organizer allowlist entry in development.

Use real participant OTP sign-in and separate browser profiles/private windows. Do not add a dev authentication bypass or seed fake authentication credentials.

Create a disposable event in the development SQL Editor:

```sql
insert into public.events (slug, name)
values ('project-submission-test', 'Project submission test')
on conflict (slug) do nothing;
```

In the admin app:

1. In Forms, create/publish a simple participant application for this event with admissions deadlines in the future. One short required question is enough.
2. Have A, B, and C sign in through `http://localhost:3001/login` and submit that event's application using the existing admissions flow.
3. In Applications, mark A and B accepted; leave C pending/rejected. You do not need to release decisions. The new workflow deliberately checks submitted-plus-accepted even when the admissions status is not yet released.
4. In `/judging?event=project-submission-test`, save competition settings: enabled, project opening tomorrow, no project closing, judging end several days later.
5. Add active sponsor tracks A and B. These are project tracks, not admissions forms.

Start the existing apps in separate terminals:

```sh
pnpm --filter app dev
pnpm --filter admin dev
```

## 3. Participant checks

### Before opening

1. As A, open `http://localhost:3001/projects`. The sandbox should appear. Open it and create a project.
2. Verify the project has no content form or track selector yet. Its title is Untitled project, and the opening time is shown in America/New_York.
3. Add B using the exact registered email. Upper/lowercase should not matter.
4. Try C's email and a nonexistent email: both fail with the same generic unavailable/ineligible response. There is no email search/list endpoint.
5. Reload; the roster persists. B can view it but has no content/roster mutation controls. C cannot create a project or open A's copied project link.

### Open, save, and submit

1. As organizer, move project opening into the past; keep closing unset. Refresh A's project page.
2. Save an incomplete draft. Reload; it persists, without being marked submitted.
3. Fill in name, short summary, description, and just one HTTP(S) repository/demo/video link. No upload, hosted deployment, long essay, or all-three-links requirement.
4. Select tracks A and B and submit **without saving those latest edits first**. Submission atomically saves the latest form/track values.
5. Verify Submitted status after reload, both selected tracks, and a working external link. B sees read-only content.
6. Make and save a complete change before closing. The project stays submitted. Clearing required fields and saving should fail with field errors; the previous valid submission remains intact.
7. Create a second project using the same owner/collaborator. This is permitted. A solo project and zero sponsor tracks are also valid.

### Unavailable tracks and errors

1. Before judging starts, deactivate a selected sponsor track in admin. Reload the project.
2. Verify the selected track is shown as unavailable, not silently removed. Uncheck it before saving again.
3. Edit a field, then click an internal back/sidebar link: confirm before discarding unsaved changes. A full reload/tab close also warns. This is a basic warning, not cross-tab synchronization or local draft storage.
4. Open the project in two tabs, save content in one, then try saving old content in the other. It should ask for a reload, preserving that tab's input rather than overwriting the newer save. Reload deliberately after copying any changes you want to keep.

### Withdraw and close

1. On a spare project, click Withdraw project and confirm. It remains visible as withdrawn, cannot be restored/edited, and does not withdraw the admissions application.
2. Keep another project open in a tab. As organizer, set submission closing in the past (after opening).
3. A refreshed project becomes read-only. A save from the already-open old tab must fail without silently submitting or discarding its local field values.
4. Roster changes, new projects, and withdrawals are also blocked after closing.
5. Start judging in admin. This is permanent for the sandbox, so use a new event slug to repeat the full test.
6. Extend judging end. Participant editing must remain locked. Existing content/collaborators/track selections must still be readable.

### Login and event isolation

1. Copy A's project URL, sign out, and open it. OTP login should return to that project, not lose the destination to `/start`.
2. Ordinary login without a project destination should continue to `/start` as before. External `next` destinations must not be accepted.
3. Try changing the project URL's event slug: not found rather than another event's data.
4. Confirm ordinary application drafts/submission/status/profile onboarding still work.
5. Disable an event before judging starts: A/B can still view their existing project read-only; creating/editing is blocked. Re-enabling before closing can resume editing. Start judging's lock is not reversible this way.

## 4. Automated checks and limitations

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
```

Added participant tests cover validation, safe login return paths, server-action errors/authorization, scoped data reads, timing states, and static rendering of editable/read-only forms. pgTAP files 29–31 cover real PostgreSQL RPCs, role permissions, eligibility, roster access/revocation, atomic content/tracks, submission completeness, URL validation, stale saves, closing/start, and withdrawal.

During implementation, 203 unit/rendering tests and all 31 database test files (694 assertions) passed, along with lint, typecheck, and production builds. All 47 migrations were also applied successfully to a fresh isolated local database. A production-server HTTP smoke check verified anonymous project redirects retain their destination, the login page renders, and ordinary admissions redirects are unchanged.

Database tests used PostgreSQL 17 with pgTAP and lightweight Supabase auth/storage SQL fixtures. This does not emulate actual OTP/OAuth/PostgREST or authenticated browser interaction. The authenticated browser rehearsal above must be run against your development project before treating the workflow as release-ready. No hosted migrations, accounts, or application decisions were created automatically.

## 5. Database/API handoff

No project-table SELECT/INSERT/UPDATE/DELETE privileges were opened. Participant access uses these authenticated RPCs:

```text
participant_project_events()
participant_projects(p_event_id)
participant_project_detail(p_project_id, p_event_id)
participant_create_project(p_event_id)
participant_add_project_collaborator(p_project_id, p_email)
participant_remove_project_collaborator(p_project_id, p_user_id)
participant_save_project(p_project_id, p_content, p_track_ids, p_submit, p_expected_updated_at)
participant_withdraw_project(p_project_id)
```

- Eligibility helpers and mutation locks are private, not user-directory APIs.
- `participant_project_detail` returns project content, minimal collaborator names/IDs, selected tracks (including inactive selections), and currently available tracks.
- Save returns the exact stored `updated_at`. Preserve its microsecond precision when sending it back; do not round-trip through JavaScript `Date` for revision checks.
- Submit and changes to submitted projects revalidate current collaborator eligibility. Remove an ineligible collaborator before saving/submitting.
- `PT422` includes a JSON field-error map; `PT409` means stale content; `PT404` means inaccessible/missing project.
- Mutations lock settings before the project and check current database time. Existing Start judging triggers remain the final freeze guard.
- Read RPCs use caller identity; never query them with a service-role browser key.
- Person A/C can consume submitted project rows/selected tracks under their own appropriately authorized operations. This work does not grant judge access or implement scoring.
