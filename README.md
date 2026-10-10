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
2. Authentication > Emails > Templates > Magic Link: include `{{ .Token }}` so the email shows the 6-digit code.
3. Authentication > Rate Limits: raise the email sending limit.
4. Authentication > Sign In / Providers > Email: disable email+password signups.

### Google OAuth (admin)

1. In Google Cloud Console, create an OAuth client (Web application) with `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
2. Authentication > Sign In / Providers > Google: enable it and paste the client ID and secret.
3. Authentication > URL Configuration: add `http://localhost:3001/**`, `http://localhost:3002/**`, `https://app.patriothackfest.com/**`, and `https://admin.patriothackfest.com/**`.

Admin access requires an allowlisted email and a session signed in via OAuth (the JWT `amr` claim includes `oauth`). An OTP session for the same allowlisted user is not an admin session.

## Adding the first owner

Owners manage the allowlist from the admin console, but the first owner must be inserted directly in the Supabase SQL editor:

```sql
insert into public.admin_allowlist (email, level)
values ('first.owner@example.com', 'owner');
```

Levels are `owner` (allowlist and everything else), `organizer` (forms, deadlines, role changes, decisions, releases, exports), and `reviewer` (view applications, set decisions before release).

## Development

```sh
pnpm dev         # all apps
pnpm build
pnpm lint
pnpm typecheck
pnpm test        # same as db:test
```
