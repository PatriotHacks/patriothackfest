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
```

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

- `/judge/[eventSlug]` shows completed/total scorecards, context labels, and
  **Continue judging**. Each sponsor context counts separately, even on the same
  project. Order is assignment creation time then ID; Continue selects the first
  unfinished scorecard.
- `/judge/[eventSlug]/[assignmentId]` shows only that judge's assigned, submitted
  project and their own scorecard. Deep links survive OTP login through the local
  destination allowlist. Cancelled, unrelated, cross-event, self-review and revoked
  access are rejected. No admissions answers or other judges' scores are exposed.
- Four fixed integer scores (1–5): Creativity, Technical execution,
  Impact/usefulness, Presentation/demo. Anchors: 1 limited evidence, 3 solid,
  5 exceptional. Notes are optional, private to the scorecard, max 5,000 characters.
- **Save draft** accepts incomplete scores. **Submit & next** atomically requires
  all four, then advances only after persistence succeeds. The database calculates
  the total out of 20 and timestamps the submission.
- Submitted scorecards are read-only. Repeated authorized submits acknowledge the
  original submitted state without applying the retry payload, even after expiry.
  Deactivated judges cannot use this retry to regain access. A queue-load failure
  after submission leaves the scorecard read-only and offers Continue again.
- Project links are HTTP(S) only, opened safely in a separate tab, never fetched
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
Neither extensions nor retries reopen submitted reviews or participant content.

## Automated verification

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
```

pgTAP 39–41 cover scoped reads, validation, atomic final submission, totals,
immutable/idempotent submitted reviews, cutoff rejection, retained drafts and
same-session extensions. Existing C1/A2/participant/admissions tests remain active.
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
revocation, elapsed cutoff, post-expiry extension and duplicate final submission.
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
4. Save one score and notes as a draft; reload and verify persistence. Complete
   all four, Submit & next, and verify the next unfinished review. Submit the last
   review and verify the completed queue. Browser back/repeated submit must not
   alter submitted data. Check the same project's two sponsor contexts separately.
5. Double-click controls; confirm no duplicate mutation/navigation. Simulate a
   network failure and verify no advancement and preserved inputs. Simulate a
   failed queue load after successful submission; verify read-only state/Continue.
6. On an unfinished scorecard, expire judging in admin. Attempt Save/Submit with
   unsaved edits: verify an error and unchanged local fields/saved draft. Extend
   after expiry; use Check deadline / extension without reload, then save/finalize
   with the same session. Repeat with an extension before expiry.
7. Confirm submitted reviews stay immutable after another extension. Attempt
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
judge_save_review(p_event_slug, p_assignment_id, p_scores, p_notes, p_submit=false)
```

Queue/detail denial returns null; operational failures remain errors. Queue rows
omit scores/notes. Detail/save returns only the current judge's scorecard and the
minimum project content, plus project question `answers` only when the
event's `judges_see_answers` switch is on (otherwise `[]`; see
[Project paragraph questions](project-questions.md)). Private helpers have no authenticated execute grant;
direct project/assignment/roster directory access remains denied. A3 can consume
the existing assignment score columns, generated total and submitted timestamp.
