# Judge queues, scorecards and deadlines (C2/C3)

Rostered judges use the existing participant deployment and email OTP login at
`/judge`. No application, profile name, admin role, new Auth provider, or separate
judge deployment is required. [Organizer results](judging-results.md) consumes
submitted scorecards separately for General and each active sponsor track.

## Development deployment

Confirm the intended **development** database and matching app environment before
applying these forward migrations after A2:

```text
20261115000001_judge_review_reads.sql
20261115000002_judge_review_writes.sql
20261124000001_judging_criteria.sql
20261124000002_judge_briefing.sql
20261124000003_judging_scores.sql
```

After deploying, organizers must enter the event's rubric criteria in admin
`/judging` before Start judging; the database refuses to start with none.

```sh
pnpm db:push
pnpm gen:types
pnpm db:test
pnpm --filter app dev
pnpm --filter admin dev
```

Do not reset/reseed an existing rehearsal event or run these commands against
production automatically. Implementation verification used a separate local
PostgreSQL 17 database with lightweight Supabase auth/storage SQL fixtures, not
hosted OTP/PostgREST. No hosted migrations or accounts were changed.

## Behavior and permissions

- `/judge` shows completed/total scorecards, context labels, and **Start
  judging**. Each sponsor context counts separately, even on the same project.
  Order is assignment creation time then ID. Until the judge acknowledges the
  briefing, Start judging opens `/judge/[eventSlug]/briefing`: the participant
  build scenario in a scroll container whose Continue button appears only after
  scrolling to the end (or immediately when it fits). Continue records
  `event_judges.briefing_acknowledged_at` once and opens the first unsubmitted
  assignment. Scoring pages and `judge_save_review` require the acknowledgement.
- `/judge/rubric` shows the event criteria and the scenario at any time.
- `/judge/[eventSlug]/[assignmentId]` shows only that judge's assigned, submitted
  project and their own scorecard. Deep links survive OTP login through the local
  destination allowlist. Cancelled, unrelated, cross-event, self-review and revoked
  access are rejected. No admissions answers or other judges' scores are exposed.
- The project is on the left and a sticky rubric panel on the right (stacked on
  small screens). Each organizer-defined criterion has a slider from 1.0 to 5.0
  in 0.1 steps that starts unset. The judge's score is the equal-weight mean of
  their criterion scores. Notes are optional, visible only to organizers, max
  5,000 characters. Previous/Next and "Project N of M" follow queue order.
- **Save draft** accepts partial scores. **Submit & next** is enabled once every
  criterion is scored; the database also requires a score for every criterion,
  then the screen moves to the next unsubmitted assignment (or the dashboard).
- Submitted reviews stay editable until judging closes. Saves of a submitted
  review must stay complete, keep the first `submitted_at`, and bump `updated_at`.
  Deactivated judges cannot save.
- URL answers are HTTP(S) only, opened safely in a separate tab, never fetched
  automatically. Conflicts/inaccessible demos go to the visible organizer contact,
  `hello@patriothackfest.com`; there is no ticket system.

## Deadlines and last-minute extensions

The default cutoff is **exclusive `2026-11-21T05:00:00Z`**. It is displayed as
November 20 at 11:59 p.m. EST, including that final minute, in America/New_York.

Every unfinished save/final-submit RPC locks current settings, then the assignment,
and checks the actual database clock **after waiting for locks**. It independently
rechecks current verified judge identity, assignment context and cancellation.
Settings-first locking also serializes against organizer roster revocation and
assignment cancellation/reassignment. Raw table writes stay unavailable.

Expired drafts/queues remain readable. Expiry never deletes or permanently locks
draft data. Organizers can edit Judging ends before or after expiry. Judges can
retry saving directly, or choose **Check deadline / extension** to update the
deadline in place; checking does not replace dirty inputs with the saved draft.
No re-login is required. Save/network/access errors preserve controlled fields.
Reloading/leaving the page still discards unsaved changes; save when possible.
Extensions never reopen participant content.

## Automated verification

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
```

pgTAP 39–41 and 52 cover scoped reads, rubric privacy and locking, briefing
gate, 0.1-step validation, complete-only submission, editing submitted reviews
until the cutoff, retained drafts and same-session extensions. Existing C1/A2/participant/admissions tests remain active.
Vitest covers typed RPC/action contracts, strict local deep links, route identity,
queue/project/scorecard rendering and controlled error/extension state transitions.

The real-concurrency test requires all migrations applied to a **disposable local**
database named `person_c2` or `c2_review_test...`, with a privileged fixture connection:

```sh
C2_CONCURRENCY_TEST_DB=1 SUPABASE_DB_URL='postgresql://USER@127.0.0.1:PORT/person_c2' node scripts/judge-review-concurrency-test.mjs
```

It refuses hosted targets, never loads `.env`, creates committed invocation-specific
fixtures, observes actual lock waits across connections, and cleans up only those
fixtures. It tests the real judge RPC against cancel/reassign in both orders,
revocation, elapsed cutoff, post-expiry extension and concurrent submitted edits.
Do not run it against a shared event/database.

## Manual real-login rehearsal (not browser-verified during implementation)

1. Use the existing development sandbox with accepted participant projects, one
   general judge and two sponsor judges (one scoped to multiple tracks). Include
   a judge with no application/profile name and an unrostered negative account.
2. Close submissions, Start judging, generate assignments in admin. Confirm queue
   totals/context labels match non-cancelled assignments and no public rankings
   or other judges' reviews appear.
3. Open an assignment deep link while signed out; complete real OTP login and
   return to that scorecard without participant onboarding.
4. Read the briefing to the end and continue. Save one score and notes as a
   draft; reload and verify persistence. Score every criterion, Submit & next,
   and verify the next unfinished review. Submit the last review and verify the
   completed queue. Reopen a submitted review, change a score and save. Check the same project's two sponsor contexts separately.
5. Double-click controls; confirm no duplicate mutation/navigation. Simulate a
   network failure and verify no advancement and preserved inputs. Simulate a
   failed queue load after successful submission; verify the message and inputs.
6. On an unfinished scorecard, expire judging in admin. Attempt Save/Submit with
   unsaved edits: verify an error and unchanged local fields/saved draft. Extend
   after expiry; use Check deadline / extension without reload, then save/finalize
   with the same session. Repeat with an extension before expiry.
7. Confirm submitted reviews lock at the cutoff and reopen with an extension. Attempt
   participant project/roster/track edits: the permanent judging freeze remains.
8. Deactivate a judge with an open session: subsequent reads/writes/checks fail.
   Try another judge's assignment URL, a cancelled assignment and a second event.
   Verify unrelated project/admissions data remains inaccessible.
9. Verify participant and admissions login/submission flows still work separately.

Static rendering/unit tests do not prove browser pending states, form focus,
OTP/PostgREST integration, or interactive navigation. Complete this checklist
before signing off release.

## Integration contract

Authenticated judge RPCs (all derive identity from the verified caller):

```text
judge_queue(p_event_slug)
judge_assignment(p_event_slug, p_assignment_id)
judge_criteria(p_event_slug)
judge_acknowledge_briefing(p_event_slug)
judge_save_review(p_event_slug, p_assignment_id, p_scores, p_notes, p_submit=false)
```

`p_scores` maps criterion IDs to numbers from 1.0 to 5.0 with one decimal (or
null to clear in a draft).

Queue/detail denial returns null; operational failures remain errors. Queue rows
omit scores/notes. Detail/save returns only the current judge's scorecard and the
minimum project content, plus project question `answers` only when the
event's `judges_see_answers` switch is on (otherwise `[]`; see
[Project questions](project-questions.md)). Private helpers have no authenticated execute grant;
direct project/assignment/roster/criteria/score access remains denied. Scores live
in `judging_scores (assignment_id, criterion_id, score numeric(2,1))`.
