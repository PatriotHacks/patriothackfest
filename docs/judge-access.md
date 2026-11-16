# Judge roster and access: C1 verification

C1 introduced judge roster management and a judge-only landing area. [C2/C3 judge reviews and deadlines](judge-reviews.md) now adds queues/scorecards; use that document for the current review workflow. Keep using the existing admin and participant deployments. Results remain A3 work.

## 1. Apply the C1 migrations to development

Check that root `.env` and the apps' `.env.local` files point to the intended **development** Supabase project. Do not reset/reseed the event you used for submission testing.

```sh
pnpm install --frozen-lockfile
pnpm db:push
pnpm db:test
```

The two new migrations are:

```text
20261113000004_judge_roster.sql
20261113000005_judge_access.sql
```

No new dependency, Auth provider configuration, development login bypass, or privileged browser key is needed. Existing OTP delivery/verification must work for the development project. The current app expects six-digit codes; local `config.toml` does not automatically set the hosted project's OTP length.

Run the apps in separate terminals:

```sh
pnpm --filter admin dev
pnpm --filter app dev
```

## 2. Prepare two judge accounts

Use emails you control: one general judge and one sponsor judge, preferably at least one with **no application and no profile name**. Also keep an unlisted participant account for negative testing. Separate browser profiles/private windows make switching easy.

Adding an email to the roster does not require an existing account and does not send an invitation. Email OTP registration can create the account later. Judges do not need participant acceptance, a judge application, or admin allowlist access.

If using the terminal-generated OTP and React DevTools technique already discussed, generate a real development code, reveal the existing code-entry step without sending another email, and verify that code normally. Do not place a service-role key in the browser or commit it. No terminal generator or development shortcut has been added to this codebase.

## 3. Organizer roster checklist

Sign into `http://localhost:3002/login` with the allowlisted Google organizer/owner account. Open `/judging?event=YOUR_SANDBOX_SLUG`.

1. Save competition settings if that event has none. Use existing active tracks from your submission rehearsal, or add tracks before Start judging freezes them.
2. In **Judges**, add the general judge's email with type General, capacity 20, and Active checked. Save and reload.
3. Add the sponsor judge with type Sponsor and one or more of this event's active tracks. Save and reload.
4. Confirm email normalization, type, scopes, capacity, and Active state persist. There is no invitation email or automatic admin grant.
5. Duplicate email/case variation should fail. Sponsor with no tracks and capacities outside 1–1000 should fail.
6. Switch events: this event's roster must not appear elsewhere.
7. An admissions reviewer must not see the Judging Management navigation or be able to invoke roster reads/mutations.

An entry is **Not linked yet** until the verified judge visits its event page. A previously registered participant can also be unlinked; the label is not a statement about whether an Auth user exists.

## 4. General and sponsor judge checklist

For each account, **start at this URL before logging in**:

```text
http://localhost:3001/judge
```

1. Anonymous access redirects to OTP login with the judge destination preserved.
2. Verify the email code. You should return to `/judge`, not participant `/start`, `/welcome`, or an application form.
3. Only events on that account's active roster appear.
4. Open the sandbox event. The first event visit links the roster entry to the verified account. Repeat/reload is safe.
5. General judge sees General judge. Sponsor judge sees Sponsor judge and only their authorized track labels.
6. Confirm the waiting/status message and judging deadline/timezone. A prepared/disabled event may show its landing page; this does not grant project access or open judging.
7. With C2/C3 applied, the event page shows the real assigned queue/counts. No assignments means an honest empty state; use the review rehearsal for scoring checks.
8. Confirm no participant application/name is required for a fresh judge account. No new access to admin forms, admissions answers, or unrelated projects is granted. An account that independently already owns a participant project retains its separate participant permissions.

Login opened directly at `/login` without a destination checks the verified email against active judge rosters: an account with at least one judge event goes to `/judge`, any other account goes to `/start`. A valid explicit destination such as `/judge/YOUR_SANDBOX_SLUG` or a project path always wins. If the roster lookup fails, the code screen shows the error instead of guessing a destination. Normal admissions behavior remains supported.

## 5. Revocation, reactivation, and identity checks

1. Keep the judge's event page open. In admin, uncheck Active and save that judge.
2. Refresh/revisit the judge event with the **same signed-in session**. It should show Judge access unavailable. `/judge` removes that event; the account's other active roster events remain available.
3. Reactivate the same row and revisit. The same verified account regains access. Do not add a duplicate email row to reactivate someone.
4. An unlisted participant opening `/judge` gets the access-not-configured message. Copying a rostered judge's event link does not grant access.
5. Changing a bound roster email to a different person's email should fail. A bound slot cannot be transferred by editing the email or sending a user ID.

Email-change behavior: access uses the **current confirmed `auth.users` email**, the signed session email, and the bound user ID. The `profiles.email` field is not the authority. If a judge changes their Auth email, they must finish confirmation and sign in/refresh their session; an organizer can then correct the existing roster email to that same account's new verified address. The binding and assignment history remain attached to the same user. An old-email session fails closed.

Deactivation takes effect on the next database/server read; it does not retroactively erase information already displayed in an open tab. No real-time session-killing feature was added.

## 6. Roster edit rules after judging/assignments

- Roster management stays available after Start judging and after the deadline; deactivation/capacity changes do not reopen submissions.
- Existing project/track definitions remain subject to A1/B's permanent content freeze.
- Judge type is locked once any assignment exists. An unbound judge's email also cannot change after assignment.
- A scope referenced by any assignment, including cancelled/history rows, cannot be removed. The form labels/protects those scopes and the database enforces the same restriction.
- New scopes must be active same-event tracks. Existing inactive scopes stay visible; a retained referenced scope is never deleted/recreated during save.
- Deactivating a judge never deletes assignments or scores. Changing capacity never silently cancels work; future A2 generation must respect remaining capacity.
- A person cannot judge an event they participate in: saving a judge fails when the email matches the current confirmed `auth.users` email of an account with a submitted participant application for that event, or when the bound account has one. Draft/withdrawn applications and other roles do not block. Applying as a participant after being rostered is not blocked.
- No hard-delete, account-transfer, automatic reassignment, or invitation workflow is included.

Current C1 alone cannot create assignments. [A2 assignment generation and management](judging-assignments.md) creates them; history-dependent roster restrictions are directly visible after generation. [C2/C3](judge-reviews.md) provides judge queues and scoring.

## 7. Automated checks and limits

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
```

New coverage:

- pgTAP 32: organizer authorization, email/type/capacity validation, scopes, same-event constraints, atomic failures, default-deny table access, and preservation of assignment history.
- pgTAP 33: current verified Auth email, OTP method, first/repeat binding, no application/name requirement, revoked-session denial, email changes, conflicting bindings, private authorization helper, and event isolation.
- Admin Vitest: input normalization/validation, permission checks, RPC payloads/errors, and roster rendering.
- Participant Vitest: caller-scoped judge data, denied versus failed reads, login-return validation, existing admissions/project regressions, landing/status/deadline rendering.

Implementation verification uses an isolated PostgreSQL 17/pgTAP instance with lightweight Supabase SQL fixtures, including the real Auth email-confirmation column shape. It does not emulate hosted OTP/OAuth/PostgREST. No hosted accounts, provider settings, or migrations are modified automatically. Complete the real browser checklist above before signing off C1's end-to-end integration.

## 8. A2/C2/C3 handoff

Organizer RPCs:

```text
admin_judge_roster(p_event_id)
admin_save_event_judge(p_event_id, p_email, p_kind, p_active, p_capacity, p_track_ids, p_judge_id)
```

Judge-facing RPCs:

```text
judge_events()
judge_event_access(p_event_slug)
```

The latter binds an unbound row only to its matching verified caller and returns minimal own-event metadata. Roster tables and all projects/assignments remain unavailable to direct judge table reads. No admissions RLS was broadened.

Private database helper for future review operations:

```text
current_event_judge_id(p_event_id)
```

It returns only the current active, bound, OTP-verified, matching-email judge ID (or NULL). It is not granted to browser clients. Future trusted C2/C3 operations must call it on every read/write, plus enforce assigned-project/context and review-deadline rules. C1 does not implement those extra permissions itself.

For A2 assignment generation, use the same lock order as roster management: event settings row first, then judge rows as needed. Validate active status, type/scopes, capacity, project membership/conflicts, and existing work in that transaction. Do not reset bindings or grant judges admin-reviewer privileges to make integration easier.
