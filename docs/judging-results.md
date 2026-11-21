# Organizer judging results (A3)

Organizers/owners use **Results** at `/judging?event=YOUR_EVENT#results`.
Settings, submitted-project details, judge roster, assignments, and results now
share the existing organizer area. Normal configuration/assignment/result reads
do not require direct SQL. Winner decisions remain manual; there is no public
leaderboard or winner-publication workflow.

## Development deployment

Confirm the intended **development** database and matching admin/app Supabase
configuration before applying migrations. Apply the new forward migration after
the C2/C3 read/write migrations; do not edit previously applied migrations:

```text
20261115000001_judge_review_reads.sql
20261115000002_judge_review_writes.sql
20261115000003_admin_judging_results.sql
20261124000003_judging_scores.sql
```

```sh
pnpm db:push
pnpm gen:types
pnpm db:test
pnpm --filter admin dev
pnpm --filter app dev
```

These DB commands use `SUPABASE_DB_URL`; they do not verify the target is safe.
Do not reset/reseed the existing rehearsal event or run them against production
automatically. Deploy the migration before the admin update; an absent RPC is a
deployment error, never an empty results fallback. No dependencies, Auth settings,
service-role keys, or participant/judge privileges are added.

## Results rules

- General is the default. Sponsor results include only submitted projects opted
  into the selected **active** track for this event. General and every sponsor
  context have separate scorecards and averages. Invalid, inactive, unknown, and
  foreign-event contexts show an explicit unavailable message, not General data.
- Exclude draft/withdrawn projects, unfinished scorecards (even with every
  criterion scored), and cancelled assignments. A completed review requires a
  submission timestamp on its non-cancelled assignment.
- Each judge's score is the mean of their criterion scores (1.0 to 5.0); the
  project average out of 5 is the mean of those judge scores, never a client value. Every qualifying submitted review counts, including above-target
  reviews and completed work from a subsequently deactivated judge.
- **Completed reviews / target** uses the current general or track review target.
  A cancellation never reduces the configured target. This is not A2's
  **Assigned / target** coverage: an assigned slot is not a completed review.
- **Insufficient coverage** means completed count is below target. Zero-review
  projects remain visible with **No reviews** and null average, not 0/5. Averages
  with insufficient coverage should not be treated as final results.
- Highest unrounded database average first; display two decimal places. Equal
  means are **Tied average**, including ties across pages and ties with different
  review counts/coverage. Every submitted review scores every criterion, so the
  mean equals sum/count of all scores; tie equality compares that reduced
  fraction, not rounded display strings. Two equal-looking displayed means may not be tied.
- Project-name/ID ordering within ties is stable presentation only, not a
  tie-break, rank, or winner decision. Unscored projects appear last and are not
  marked tied.
- Read results before/after the judging deadline, or while the event is disabled.
  Refresh to see new submissions, completed reviews, and current targets. No
  real-time feed, normalization, export, or review-reopening controls are added.
- Results have 50-row pages, with Previous/Next and a First page link for empty
  later pages. Ties are computed over the whole context before pagination. A page
  is not an invented event-wide project count.

URLs use `resultsTrack=general` or a track UUID and `resultsPage=N`. Selecting a
context resets its result page; same-event project/assignment pagination and
assignment filters retain results context/page. Results navigation retains the
other sections' filters/pages. Event tabs reset event-specific filters. Existing
project detail/back links retain their event/submitted-project page behavior;
use browser Back to retain the full results URL after inspecting a project.

## Database contract and privacy

```text
admin_judging_results(p_event_id, p_track_id=NULL, p_page=1)
```

The read-only, fixed-search-path RPC independently requires organizer-level admin
OAuth authorization. Anonymous callers have no execute grant. Admissions reviewers,
participants (even project owners), and judges cannot read organizer results.
Direct project/scorecard table privileges remain unchanged.

Response: selected `track_id`/`track_name`, current `target`, `has_more`, and
`projects` with `project_id`, `project_name`, `completed`, nullable `average_total`,
`insufficient_coverage`, and `tied`. No individual scores, judge identities, private
notes, participant profiles, or admissions answers are returned. General results
for an unconfigured event return null target and no rows; the UI asks to save
settings. Invalid pages/context arguments fail explicitly. Operational/schema
errors remain errors rather than fabricated results.

## Verification

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
```

`42_admin_judging_results_test.sql` covers role/auth-method boundaries, event/track
isolation, exclusions, current targets, zero/partial/above-target coverage,
deactivated judges, exact ties with different counts, non-tied rounded means,
ordering, pagination boundaries, expiry/disabled access, and unchanged privileges.
It also uses the actual judge save/submit and organizer deadline-extension RPCs:
a full-score draft has no results effect; submission after extension counts once,
changes the general mean/coverage/tie, and leaves sponsor results unchanged.
Vitest covers schemas, typed reads/errors, URL input, result rendering, page
authorization/integration, and cross-section navigation.

Implementation checks used a separate local PostgreSQL 17/pgTAP database with
lightweight Supabase auth/storage SQL fixtures and the full migration chain. Types
were generated from that schema with the existing local Supabase postgres-meta
tooling. No hosted data or Auth configuration was changed. These checks do **not**
prove OAuth/OTP/PostgREST integration or browser navigation.

## Real-login rehearsal — pending manual verification

Use the existing approved development event and real admin Google OAuth / judge
OTP sessions; no auth bypass or SQL scoring. Start with accepted participants,
general-only and multi-track projects, one general and two sponsor judges.

1. Submit projects plus one spare draft and one withdrawn project. In admin,
   inspect the submitted-only list/detail; verify drafts/withdrawn projects are
   excluded and a second event is isolated.
2. Close submissions, Start judging, and Generate missing assignments. Compare
   assigned-slot coverage with Results: completed count remains zero until actual
   submissions, and every eligible unscored project says No reviews/Insufficient
   coverage.
3. Save/reload a partial review, then a full-score draft. Neither changes results.
   Submit & next, refresh admin, and verify completed count and average total.
4. Submit different scores for the same project's General and two sponsor
   contexts. Filter each context; review counts/means must remain separate.
5. Give two projects equal mean totals (including unequal completed counts).
   Both show Tied average. Leave one under target; tie and coverage flags coexist.
   Winners remain a manual decision. Inspect project links and browser Back.
6. Page/filter assignments and projects while a sponsor results context is
   selected. Results selection/page stays intact; selecting another results
   context resets only its result page. Switch events to confirm filters reset.
7. Cancel an untouched assignment: it does not increase completed count or lower
   target. Deactivate a judge with completed work: submitted results remain.
8. Expire judging; saving fails without losing inputs. Extend in admin, finish
   the draft, refresh results: exactly one new completed review. Submitted cards
   remain immutable and project content remains frozen after extension.
9. Confirm reviewers/judges/participants cannot access organizer results, ordinary
   admissions/login/submission behavior still works, and future events stay
   isolated. Use the automated authorization matrix for accounts you cannot test.

Record actual rehearsal outcomes before release sign-off. Browser checks and
hosted migration/deployment were not performed during implementation.
