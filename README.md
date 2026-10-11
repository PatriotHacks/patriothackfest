# Patriot HackFest

Monorepo for the Patriot HackFest marketing site, applicant portal, and admin console.

## Structure

```
apps/
  web/     patriothackfest.com         marketing site       (dev port 3000)
  app/     app.patriothackfest.com     applicant portal     (dev port 3001)
  admin/   admin.patriothackfest.com   admin console        (dev port 3002)
packages/
  ui/                 shared shadcn/ui components and Tailwind v4 styles
  forms/              form field schemas, conditional visibility, answer and publish validation, CSV export
  email/              SMTP transport, decision email templates, batch sending
  supabase/           Supabase browser/server clients and generated database types
  eslint-config/      shared ESLint configs
  typescript-config/  shared tsconfig presets
supabase/
  migrations/         schema, RLS policies, RPCs, storage bucket
  tests/              pgTAP tests (each file runs in a transaction and rolls back)
  seed.sql            the two events (idempotent upsert on slug)
scripts/
  db-test.mjs         pgTAP runner used by `pnpm db:test`
```

## Prerequisites

- Node 24 (`nvm use`)
- pnpm via Corepack (`corepack enable pnpm`); the version is pinned in `package.json`
- A hosted Supabase project

The Supabase CLI is installed as a dev dependency; no global install is needed.

## Setup

```sh
pnpm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/app/.env.example apps/app/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

| Variable                               | File                     | Value                                                                                                                                         |
| -------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_DB_URL`                      | `.env`                   | Postgres connection string from the Supabase dashboard (Connect > Direct connection or Session pooler). The password must be percent-encoded. |
| `NEXT_PUBLIC_SUPABASE_URL`             | `apps/app`, `apps/admin` | Project URL                                                                                                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `apps/app`, `apps/admin` | Publishable key (`sb_publishable_...`)                                                                                                        |
| `NEXT_PUBLIC_APP_URL`                  | `apps/web`               | Applicant portal URL, e.g. `http://localhost:3001`                                                                                            |

## Database

All database scripts target the project in `SUPABASE_DB_URL`.

```sh
pnpm db:push     # apply migrations
pnpm db:seed     # upsert the two events (safe to re-run)
pnpm gen:types   # regenerate packages/supabase/src/database.types.ts
pnpm db:test     # run pgTAP tests in supabase/tests
```

`pnpm db:test` does not use Docker or `supabase test db`. `scripts/db-test.mjs` runs each `supabase/tests/*_test.sql` file against `SUPABASE_DB_URL` over a direct `pg` connection (the Supabase CLI's `db query` cannot run multi-statement files). Each file wraps its work in `begin ... rollback` and ends with `select * from finish(true)`, so a failed assertion raises an error; the runner also fails on a plan/count mismatch and exits non-zero if any file fails.

Event dates (`events.starts_at`, `events.ends_at`) are nullable until they are announced; `ends_at` requires `starts_at`. The seed only sets slug and name, so re-running it never clears dates set later.

Commit the regenerated `database.types.ts` after every migration.

Every new table must have RLS enabled and explicit grants; the initial migrations revoke Supabase's default `anon`/`authenticated` privileges and grant only what each table needs.

## Auth

Applicants on `apps/app` sign in with an emailed 6-digit code (Supabase email OTP). Admins on `apps/admin` sign in with Google OAuth only. Supabase links identities that share a verified email into one user. Both are configured in the Supabase dashboard, not in `supabase/config.toml`.

### Email OTP (app)

1. Authentication > Emails > SMTP Settings: enable custom SMTP with host `smtp.gmail.com`, port `587`, username = the Google Workspace sending account (2-Step Verification on, password = an app password), sender email = that same address. Publish SPF and DKIM records for `patriothackfest.com`.
2. Authentication > Emails > Templates: edit both **Magic Link** (returning users) and **Confirm signup** (first sign-in creates the user) to show `{{ .Token }}`, the 6-digit code. The app has no callback route, so the templates should not rely on `{{ .ConfirmationURL }}`.
3. Authentication > Rate Limits: raise the email sending limit.
4. Authentication > Sign In / Providers > Email: disable email+password signups.

### Google OAuth (admin)

1. In Google Cloud Console, create an OAuth client (Web application) with `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
2. Authentication > Sign In / Providers > Google: enable it and paste the client ID and secret.
3. Authentication > URL Configuration: add `http://localhost:3001/**`, `http://localhost:3002/**`, `https://app.patriothackfest.com/**`, and `https://admin.patriothackfest.com/**`.

### Sessions

Each app stores its Supabase session in its own cookie: `phf-app-auth` for `apps/app` and `phf-admin-auth` for `apps/admin`. Cookies on `localhost` are shared across ports, so a shared name would let the two dev servers overwrite each other's session. No cookie domain is set, so production cookies stay scoped to each subdomain.

The applicant app only accepts sessions established by email OTP (the JWT `amr` claim includes `otp`); any other session is signed out and sent to `/login?error=session`. Applicant sign-out uses local scope, so it does not end the user's admin session.

Admin access requires an allowlisted email and a session signed in via OAuth (the JWT `amr` claim includes `oauth`). An OTP session for the same allowlisted user is not an admin session.

## Adding the first owner

Owners manage the allowlist from the admin console, but the first owner must be inserted directly in the Supabase SQL editor:

```sql
insert into public.admin_allowlist (email, level)
values ('first.owner@example.com', 'owner');
```

Levels are `owner` (allowlist and everything else), `organizer` (forms, deadlines, role changes, decisions, releases, exports), and `reviewer` (view applications, set decisions before release).

## Admin console

- Sign in with Google at `/login`. Every page and server action checks `current_admin_level()` on the server; signed-in users without a level see an access-denied page.
- **Forms**: each event has a participant, volunteer, and judge slot. Organizers create forms and set deadlines (entered and shown in America/New_York, stored as `timestamptz`). Deadlines apply immediately.
- **Builder** (`/forms/<id>`): edits autosave to the working copy in `form_fields`. Questions support all ten field types, options, per-type validation, and a condition on an earlier choice or checkbox question. Drag the handle (or focus it and use Space and the arrow keys) to reorder. A question's type is locked once an application has answered it. The preview renders the working copy with live conditional visibility.
- **Publish / Save** calls `admin_publish_form`, which validates the working copy and snapshots it into `forms.published_schema`, the only form content applicants can read. Edits after publishing show an "Unpublished changes" badge until the next save.
- **Admins** (owners only): add, re-level, and remove allowlist entries. The database rejects any change that would leave no owner.
- Reviewers see forms and the builder read-only.

## Applicant portal

- Sign in with an emailed code at `/login`. Applicants without a name on their profile are sent to `/welcome` before anything else.
- **Dashboard** (`/`): the applicant's applications with status and deadlines (shown in America/New_York), plus events with a published form that is still open (before `submissions_close_at`).
- **Role selection** (`/apply/<event-slug>`): lists roles whose form is published and open. Starting an application calls `start_application`; the role is locked and each applicant gets one application per event.
- **Application** (`/applications/<id>`) renders the form's `published_schema` with live conditional visibility. Drafts autosave the whole answers object (1 s debounce, on blur, and before submit). If another tab saved more recently, a warning offers a reload.
- **Files** upload from the browser straight to the private `application-files` bucket at `<user>/<application>/<field>/<uuid>.pdf` (PDF only, up to the field limit, max 10 MB). Replacing or removing a file uploads the new one, saves the answers, then deletes the old object.
- **Submit** validates in the browser, then `submit_application` validates again; field errors from the database (`PT422`) are shown on their questions. After submitting, answers can be changed with **Save changes** until `edits_lock_at`, then become read-only.
- **Withdraw** is available only until decisions are released for the form, and is final; the applicant cannot reapply to that event.
- **Decline**: after release, accepted and waitlisted applicants can decline their spot or leave the waitlist from the dashboard or application page (`decline_application_offer` sets `applications.declined_at`). There is no RSVP; accepted applicants count as attending unless they decline. Declining is final: organizers can no longer change that decision or the application's role.
- Status: Draft, Submitted, or Not submitted (closed draft) until decisions are released; then Accepted, Waitlisted, Not accepted, or Under review (no decision yet). Withdrawn overrides any decision; a declined offer shows Declined.

## Development

```sh
pnpm dev         # all apps
pnpm build
pnpm lint
pnpm typecheck
pnpm test        # vitest unit tests (packages/forms, packages/email) via turbo
pnpm db:test     # pgTAP tests against SUPABASE_DB_URL
```
