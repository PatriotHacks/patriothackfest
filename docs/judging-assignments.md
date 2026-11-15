# Assignment generation and management (A2)

Organizers/owners use **Assignments** in `/judging?event=YOUR_EVENT` after closing submissions and clicking **Start judging**. A2 itself grants no new participant/judge privileges. [C2/C3](judge-reviews.md) adds scoped judge queues/scorecard saves; organizer results remain A3 work.

## Development deployment

Confirm the database is development, not production, and that the admin app points to the same project. Apply these forward migrations after the existing submitted-project migration:

```text
20261114000002_assignment_reads.sql
20261114000003_assignment_generation.sql
20261114000004_assignment_management.sql
```

```sh
pnpm db:push
pnpm gen:types
pnpm db:test
pnpm --filter admin dev
```

Do not reset/reseed your existing participant/judge rehearsal event. No new dependency, Auth configuration, or service-role browser key is needed. Missing RPCs are deployment errors, not empty queues. No hosted database was modified during implementation.

## Allocation rules

- Generate missing assignments is a single transaction serialized on the event settings row. Confirming twice/rerunning preserves existing work and cannot create duplicate pairs.
- Only submitted projects enter general judging. Their selected **active** sponsor tracks create separate contextual targets. Drafts, withdrawn projects, and inactive tracks create no new targets.
- Sponsor project/track contexts are ordered by their initial eligible pool size (fewest first), then track/project IDs. General contexts follow in project-ID order. Every insertion reevaluates current capacity and chooses the least-loaded eligible judge, breaking ties by judge ID.
- General judges receive only general contexts. Sponsor judges receive only projects opted into their authorized track. Multi-track judges share one capacity across all contexts.
- Exclude inactive judges, full judges, any existing judge/project/context pair (including cancelled), and project owners/collaborators. Conflicts use bound user IDs and confirmed Auth emails, including before a judge links their account; profile emails are not authoritative.
- Workload and assigned coverage count all non-cancelled assignments, including completed work. Cancelled rows free capacity/coverage but permanently block their exact pair. A missing count is assignment coverage, **not** a completed-review count or result.
- Existing assignments are not deleted when a judge is deactivated or capacity/targets are reduced. Inactive judges with unfinished work and over-capacity/over-target states are labeled for organizer attention.
- This is greedy balancing, not an optimal matching solver. Unfilled slots remain visible. Increase capacity, add suitable judges, or manage untouched work deliberately.
- Assignment management requires enabled/started judging but remains available after the review deadline. It never reopens participant content or changes scoring deadlines. Extend judging explicitly in settings when needed.

## Organizer controls

**Project coverage** shows general/sponsor assigned counts, targets, missing slots, and manual assignment for missing contexts. Coverage pages contain at most 50 contexts; the event-wide missing total is not calculated from only the visible page.

**Judge loads** shows current non-cancelled loads, capacity, and unfinished counts. **Manage assignments** is paginated (50 rows), filterable by status and by project using coverage-row links. Pagination retains event, filters, and submitted-project page context. Eligible judge choices load on demand; mutation RPCs recheck every rule even if a selection has gone stale.

Untouched means **all four scores are NULL, notes are exactly empty, and no submission timestamp exists**. Saving only notes or only one score protects that row. In-progress/submitted work cannot be cancelled or reassigned in A2.

- **Cancel untouched assignment** requires confirmation. It retains the cancelled row and creates no replacement. You can leave it cancelled. A later generation may fill the missing slot with a different eligible judge, never the cancelled pair.
- **Reassign untouched review** requires confirmation and atomically cancels the old row and creates a new blank row for another eligible judge. Failure rolls back both changes; scores/notes are never copied. Reassignment preserves the context/count even when a lowered target leaves existing coverage over target.
- **Assign manually** fills only missing coverage with the same eligibility/capacity checks as generation. Cancelled pairs cannot be selected again. No restore/review-reopening or hard-delete controls exist.
- Mutation errors preserve local choices and are not presented as success. Refresh eligible judges after capacity, roster, or assignment changes.

## Manual development rehearsal (not yet browser-verified)

Use the existing B3/C1 sandbox and real organizer OAuth login; no auth bypass:

1. Before Start judging, confirm generation/manual mutation is unavailable, while submitted projects remain readable.
2. Prepare general-only and multi-track submissions, two general judges, and two sponsor judges with overlapping scopes. Include a project owner/collaborator as an unlinked roster judge and deliberately insufficient capacity.
3. Close submissions and Start judging. Generate; verify sponsor scope, self-review exclusion, loads, and shortages. Generate again: no duplicate work.
4. Increase capacity or add eligible judges. Generate again: only missing slots are filled. Switch to a second event; its roster/projects/assignments remain isolated.
5. Filter by project/status, use coverage/assignment pages, and follow project detail/back links. Context labels must distinguish general and each sponsor track.
6. Cancel an untouched row and leave it cancelled; no immediate replacement appears. Generate again: another eligible judge may fill the slot, but the old pair stays cancelled.
7. Reassign another untouched row. Confirm old cancelled/new untouched rows and unchanged coverage; a stale second request must not add another replacement.
8. On an isolated database fixture, save a note or score on an assignment and refresh. Its controls become protected. Direct management RPC attempts must fail too. There is no judge score-save UI until C2.
9. Deactivate a judge/reduce capacity or the general target: existing work stays, warnings appear, and generation does not remove scores. Expire/extend judging: management remains available, projects remain permanently frozen.
10. An admissions reviewer, participant, judge, or anonymous user must not access organizer reads/mutations. An allowlisted email with OTP rather than admin OAuth is also denied.

## Automated verification

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
```

pgTAP files 35–38 cover authorization/privacy, context math and pagination, identity conflicts before binding, scopes, balancing/scarcity, shared capacity, repeat generation, shortages, cancelled history, rollback, protected scores/notes, target reductions, and manual management. Vitest covers typed read/action contracts, errors, input validation, navigation, and initial/protected rendering. Static rendering tests do not prove browser confirmations, pending interactions, or OAuth/PostgREST integration.

The additional concurrency test deliberately refuses hosted targets and requires an explicit disposable local database (`person_a2` or `a2_assignment_test...`) with all migrations already applied, Supabase auth/storage schemas, and a privileged SQL fixture connection:

```sh
A2_CONCURRENCY_TEST_DB=1 SUPABASE_DB_URL='postgresql://USER@127.0.0.1:PORT/person_a2' node scripts/assignment-concurrency-test.mjs
```

It creates invocation-specific disposable fixtures, checks actual PostgreSQL lock waits for generation/manual additions/reassignment/draft-save races, then removes only its own fixtures. It is not automatically run against the `.env` database. Implementation verification used local PostgreSQL 17/pgTAP with lightweight Supabase SQL fixtures, not hosted Auth/PostgREST or a browser rehearsal.

## C2/C3 integration contract

Organizer RPCs:

```text
admin_assignment_overview(event, coverage_page=1, assignment_page=1, project_id=NULL, status='all')
admin_assignment_candidates(event, project, track=NULL)
admin_generate_assignments(event)
admin_add_assignment(event, project, judge, track=NULL)
admin_cancel_assignment(event, assignment)
admin_reassign_assignment(event, assignment, judge)
```

The actual argument names have the `p_` prefix shown in generated Supabase types. NULL track means general. Overview exposes minimal management status, not score values/private notes. All RPCs independently enforce organizer access. Private helpers remain ungranted and direct table access remains denied.

Assignment/roster writers lock **settings first**, then relevant assignment/judge rows. A reassign/cancel locks its source assignment before checking untouched state. C2 score writes must lock/recheck the assignment row in the same transaction, rejecting cancellation and revalidating the current active verified judge, context, submission state, and current database deadline after waiting. If they also need settings locks, acquire settings before assignment rows; never reverse that order. Do not save from a stale pre-lock read or implement unconditional score updates after an organizer cancellation.

Deactivation does not cancel work. C2/C3 consumes only the current judge's non-cancelled assignments and reuses C1's private verified-identity helper, without allowing raw project/scorecard directory access. Its migrations/verification are documented in [Judge reviews and deadlines](judge-reviews.md).
