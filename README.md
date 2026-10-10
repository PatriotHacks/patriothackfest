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

| Variable | File | Value |
| --- | --- | --- |
| `SUPABASE_DB_URL` | `.env` | Postgres connection string from the Supabase dashboard (Connect > Direct connection or Session pooler). The password must be percent-encoded. |
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/app`, `apps/admin` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `apps/app`, `apps/admin` | Publishable key (`sb_publishable_...`) |
| `NEXT_PUBLIC_APP_URL` | `apps/web` | Applicant portal URL, e.g. `http://localhost:3001` |

## Database

All database scripts target the project in `SUPABASE_DB_URL`.

```sh
pnpm db:push     # apply migrations
pnpm db:seed     # upsert the two events
pnpm gen:types   # regenerate packages/supabase/src/database.types.ts
pnpm db:test     # run pgTAP tests in supabase/tests
```

Commit the regenerated `database.types.ts` after every migration.

Every new table must have RLS enabled and explicit grants; the initial migrations revoke Supabase's default `anon`/`authenticated` privileges and grant only what each table needs.

## Google OAuth

Google sign-in is configured in the Supabase dashboard, not in `supabase/config.toml`.

1. In Google Cloud Console, create an OAuth client (Web application) and add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
2. In Supabase, Authentication > Sign In / Providers > Google: enable it and paste the client ID and secret.
3. In Supabase, Authentication > URL Configuration, add the app and admin redirect URLs, e.g. `http://localhost:3001/**`, `http://localhost:3002/**`, `https://app.patriothackfest.com/**`, `https://admin.patriothackfest.com/**`.

Admin access requires the user to have signed in with Google; the allowlist is matched against the Google account email.

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
