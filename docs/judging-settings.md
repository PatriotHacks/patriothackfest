# Judging settings: setup, verification, and handoff

## What this branch implements

This document covers **Person A's A1 foundation**, not the complete judging system. Person B's participant workflow is now implemented; see [Participant project submissions](project-submissions.md) for its setup and rehearsal.

- `/judging` in the existing admin app: per-event enablement, submission dates, judging end, general review target, and sponsor tracks.
- Organizer/owner-only navigation, page access, server actions, and database mutations.
- Eight base tables matching the simplified plan, with generated TypeScript types.
- Three admin RPCs for saving settings, saving tracks, and starting judging.
- Fall 2026 defaults: November 15 midnight EST opening; judging through November 20 at 11:59 p.m. EST. **Disabled by default.**
- Optional submission closing, irreversible Start judging, and adjustable judging end even after expiry.
- Database triggers lock projects/collaborators/selected tracks/track definitions after Start judging, including writes from later security-definer RPCs.

Admissions forms, application deadlines, ordinary applicant login routing, admissions decisions, and existing application pages are unchanged. Project links additionally retain a validated return destination through OTP login. The only existing admin navigation change is the Judging entry.

## Not implemented yet

- Judge roster access/binding, judge routes, save/submit review operations, active-judge checks, or judging-window checks on scorecards: **Person C**.
- Assignment generation, reassignment, progress, and results: **Person A's A2/A3**.

The project/judge tables intentionally have **no direct client table privileges**. Person B now provides scoped authenticated project RPCs with eligibility and lifecycle checks; judge workflows remain unimplemented. Enabling settings permits eligible participant use through those project pages, not arbitrary table writes.

## 1. Configure a development Supabase project

Do not apply/test this against production unintentionally. No hosted database was modified during implementation.

The tools expect these exact ignored filenames:

```text
.env                       SUPABASE_DB_URL for the development database
apps/admin/.env.local      development Supabase URL and publishable key
apps/app/.env.local        the same development Supabase URL and key
```

Use the existing `.env.example` files as templates. Files such as `root.env` or `apps/admin/admin.env.local` are not automatically loaded by these scripts/Next.js and are not covered by the current `.env*` ignore pattern. Do not commit credentials or blindly stage all untracked files.

Check the CLI and apply the migrations/seed to that development project:

```sh
pnpm install --frozen-lockfile
pnpm exec supabase --version
pnpm db:push
pnpm db:seed
pnpm db:test
```

If the Supabase CLI binary is missing, the repository currently disables its installation script with `allowBuilds.supabase: false`. Review/approve that package's build policy before rebuilding it; don't bypass security settings blindly. Alternatively, apply the new SQL migration using the development project's SQL Editor after prior migrations are present, and run the seed if needed.

The new migration is `supabase/migrations/20261112000001_competition_foundation.sql`. Seeds add defaults only when settings do not exist; rerunning them does not enable competitions or replace saved dates.

Grant your Google email `owner` or `organizer` access using `public.admin_allowlist` in the development database, as described in the README. Use Google OAuth in the admin app, not participant OTP.

## 2. Make a disposable manual-test event

In the **development** SQL Editor:

```sql
insert into public.events (slug, name)
values ('judging-settings-sandbox', 'Judging settings sandbox')
on conflict (slug) do nothing;
```

This does not create fake participants or change the Fall event. Repeat with a different slug when you want a fresh event after testing Start judging, which cannot be undone through the UI.

Start the admin app:

```sh
pnpm --filter admin dev
```

Open `http://localhost:3002/login`, sign in with your allowlisted Google account, then visit:

```text
http://localhost:3002/judging?event=judging-settings-sandbox
```

## 3. Click-through checklist

All inputs are in **America/New_York**, regardless of your computer/browser timezone.

### Settings and event isolation

1. On the sandbox, verify settings are disabled and blank. Future events do not inherit Fall dates automatically.
2. Set opening to yesterday, leave submission closing blank, set judging end to tomorrow at 11:59 p.m., enable, and save.
3. Verify “Settings saved” and the no-scheduled-closing warning. Reload; values persist. Start judging is unavailable without a closing time.
4. Select Fall 2026. Its initial dates should be November 15 at 00:00 and November 20 at 23:59; it remains disabled unless explicitly enabled. The sandbox changes must not affect it.
5. Back on the sandbox, try closing before opening or a review target outside 1–20. The save must fail; reload confirms saved settings were not changed.

### Tracks

1. Add Track A with a sponsor and Track B without one. Reload and verify both.
2. Rename a track, change its review target, deactivate it, and save. Values persist.
3. Try adding another track with the same name/case variation: rejected, without duplicating it.
4. Switch events: the sandbox's tracks must not appear elsewhere.

### Start judging and extend the deadline

1. Set a submission closing in the future and save. Start judging should return “Submissions must be closed before judging starts.” No lock occurs.
2. Set opening to yesterday and closing to at least ten minutes ago, with judging end tomorrow; save. Unsaved settings disable Start judging, so save first.
3. Click Start judging and accept the explicit irreversible-lock confirmation.
4. Verify the start notice; enablement/opening/closing/track fields are locked, including after reload. Judging end remains editable.
5. Extend judging end and save. Verify persistence.
6. To test a post-expiry extension, set judging end a few minutes ago **but after submission closing**, save, then extend it to tomorrow. Both saves should succeed and the start timestamp must remain unchanged.
7. Do not expect a judge queue to work yet: Person C must consume this deadline on every review save/submit. This branch tests the underlying setting and lock behavior, not that unimplemented UI.

The UI includes the whole selected final minute. For example, a displayed end of `2026-11-20 23:59` is stored as exclusive `2026-11-21T05:00:00Z`. Saving/reloading repeatedly must not add extra minutes.

### Permissions and admissions regression

1. With an admissions `reviewer` account, Judging must not appear in the sidebar; visiting it directly redirects to Forms, and direct mutations must be denied.
2. Sign out; `/judging` redirects to login.
3. Use a participant OTP account; it must not gain admin mutation access even if its email is allowlisted for OAuth.
4. Open Forms/Applications and verify existing admissions dates and application behavior did not change.

## 4. Automated checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:test
```

New tests:

- `apps/admin/lib/judging.test.ts`: date conversion, final included minute, repeated-save round trip, missing dates, invalid/nonexistent local times, review targets, track input.
- `apps/admin/app/(admin)/judging/actions.test.ts`: organizer checks, input rejection, scoped mutations, date payloads, database errors, revalidation.
- `supabase/tests/28_competition_foundation_test.sql`: 64 assertions for RLS/default-deny access, roles/auth methods, independent events, dates, tracks, Start judging, permanent content locks, post-expiry extensions, contextual uniqueness, foreign keys, and generated scores.

The database suite was run on an isolated PostgreSQL 17 instance with pgTAP and lightweight Supabase auth/storage SQL fixtures. That verifies real PostgreSQL migrations/RLS/RPCs; it does not replace the browser rehearsal against actual Supabase OTP/OAuth/PostgREST. No hosted auth/browser flow was exercised automatically.

## 5. Handoff to Persons B and C

Do not create alternate copies of these tables/settings:

| Contract                                                                                                                                                           | Consumer                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `event_competition_settings`: `enabled`, `project_submissions_open_at`, nullable `project_submissions_close_at`, `judging_started_at`, nullable `judging_close_at` | B checks roster/content windows; C checks started/deadline on every save/submit     |
| `projects.owner_user_id`; status `draft/submitted/withdrawn`; `submitted_at`; project fields                                                                       | B owns project lifecycle and required-field/URL validation                          |
| `project_collaborators(project_id, event_id, user_id)`                                                                                                             | B owns lookup, eligibility, duplicates/owner exclusion, and access policies         |
| `project_tracks(project_id, track_id, event_id)`; active `competition_tracks`                                                                                      | B implements explicit opt-ins and active-track checks                               |
| `event_judges`: `kind=general/sponsor`, `email`, nullable `user_id`, `active`, `capacity=20`; `judge_track_scopes`                                                 | C owns verified-email binding and event-scoped access                               |
| `judging_assignments`: nullable `track_id` means general; four `*_score` columns, generated `total_score`, notes, `submitted_at`, `cancelled`                      | C owns draft/final saves and submitted-review locking; A owns assignment generation |

Same-event composite foreign keys are already present. General-context uniqueness handles `NULL` correctly. Cancelled rows retain their uniqueness slot so generation must not automatically recreate cancelled pairs.

B's participant RPCs now enforce accepted-application eligibility and pre-opening/post-closing rules, locking the event settings row while mutating. The shared freeze triggers are a final guard after judging starts. C must add active judge/assignment authorization and final-review immutability; score bounds and generated totals alone do not implement that workflow.

Current admin RPC names:

```text
admin_save_competition_settings
admin_save_competition_track
admin_start_judging
```

Settings and tracks can be read by authenticated users when the event is enabled (active tracks only); organizers can also see disabled/inactive configuration. No anonymous reads are granted.
