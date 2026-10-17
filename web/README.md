# Gym Tracker (web / PWA)

The web version of Gym Tracker: a Next.js app you install on your iPhone from
Safari ("Add to Home Screen"). Sign in with email and password or a passkey; data lives in Neon
Postgres. Plan and decisions: [`../docs/PWA-PLAN.md`](../docs/PWA-PLAN.md).

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · Tailwind 4 ·
shadcn/ui · Prisma 7 + `@prisma/adapter-pg` · Neon · Better Auth 1.7 · zod · Vitest

## Features

- Start a workout, add exercises (search or create), log sets: weight in lb or
  kg (blank = bodyweight), reps, optional RPE and notes. Steppers for one-handed use.
- The next set is pre-filled from the previous one, or from last time; each
  exercise shows what you did last time. Rest between sets is shown automatically.
- Edit or delete any set; finish, resume or delete workouts. Finishing a workout
  with no sets discards it.
- Attendance dots on the Workout tab: one dot per day with a finished workout, for the last 3 or 6 months or a fixed window from a start date (Settings). "Mark today", or tap any past dot, to count a day without logging exercises.
- History; per-exercise best set, estimated 1RM chart and full history.
- Exercises with muscle groups and a video link; archive instead of delete once used.
- Import a JSON backup exported from the Expo iPhone app (Settings → Import).
- **Works offline**: installable PWA that opens and logs workouts with no
  connection; changes sync when you're back online. See
  [`../docs/OFFLINE-PLAN.md`](../docs/OFFLINE-PLAN.md).

## Layout

```
prisma/schema.prisma     data model (auth tables + exercise/workout/workout_exercise/exercise_set)
prisma/migrations/       SQL migrations (never edit one that has been deployed)
src/app/                 routes: (app)/ static app shells, sign-in/, offline/, api/auth/, api/sync/
src/actions/             Server Actions (backup import only)
src/local/               on-device database (Dexie), local changes, outbox, sync engine, screens' queries
src/screens/             the app's screens (client components reading the local database)
src/server/              sync push/pull, import; every function takes userId first and scopes by it
src/server/auth.ts       Better Auth config;  src/server/session.ts → requireUser()
src/lib/                 pure helpers (units, 1RM, validation, backup parsing) — unit-tested
src/components/          UI; shadcn/ui components in components/ui/
public/sw.js             service worker (keeps the app shell and its files for offline launch)
```

Authorization never relies on the client: `/api/sync/*` and the import action
validate the session on every request, and every query filters by that user
id. The pages themselves contain no user data.

## Local development

Requires Node 22+ and a Postgres database (a local one, or a Neon branch).

```sh
cd web
npm install                   # also runs `prisma generate`
cp .env.example .env          # then fill it in (see below)
npx prisma migrate dev        # create/upgrade the database schema
npm run dev                   # http://localhost:3000
```

Minimum `.env` for local use: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (same
value locally), `BETTER_AUTH_SECRET` (`openssl rand -base64 32`),
`BETTER_AUTH_URL=http://localhost:3000`. Email/password sign-in works with just
that.

**Passkeys:** after signing in, add one in Settings → Passkeys to sign in with
Face ID or Touch ID. A passkey belongs to `BETTER_AUTH_URL`'s domain, so it
works only there (`localhost` works for local testing).

**Email/password:** passwords need at least 10 characters. No email service is
configured, so there's no email verification or "forgot password" link yet. If
you lose your password, sign in with a passkey, or reset it from a database console. Keep
`ALLOWED_EMAILS` set in production: it limits sign-up by any method to the
listed addresses. Sign-in attempts are rate-limited (stored in the database).

Checks (run before committing):

```sh
npm run check     # typecheck + lint + unit/integration tests
npm run build     # production build
```

Integration tests in `src/server/*.test.ts` need `TEST_DATABASE_URL`: a separate
database they **truncate**. Without it they're skipped.

### Changing the database

1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <what-changed>` — creates and applies a migration and regenerates the client.
3. Commit the new folder in `prisma/migrations/`. Production applies it on the next deploy.

If you add a Better Auth plugin that needs tables, run `npm run auth:generate`.
It writes the full schema Better Auth wants to `prisma/auth-schema.generated.prisma`;
copy the new auth fields into `schema.prisma` by hand (don't point the CLI at
`schema.prisma`: it overwrites the app models), then delete the generated file.

## Setting up the services

### 1. Neon (database)

1. Create a project at [console.neon.tech](https://console.neon.tech) (pick a region near your Vercel region, e.g. `us-east-1`).
2. On the project dashboard → **Connect**: copy the **pooled** connection
   string (host contains `-pooler`) → `DATABASE_URL`, and with "Connection
   pooling" off, the **direct** string → `DATABASE_URL_UNPOOLED`.
   Alternatively install the Neon integration from the Vercel Marketplace,
   which sets both variables on the Vercel project for you.

### 2. Vercel (hosting)

1. Push this repo to GitHub, then on [vercel.com/new](https://vercel.com/new) import it.
2. **Root Directory: `web`** (important: the repo root is the Expo app). The framework preset is Next.js.
3. Environment variables (Production, and Preview if you use previews):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled connection string |
   | `DATABASE_URL_UNPOOLED` | Neon direct connection string |
   | `BETTER_AUTH_SECRET` | a new `openssl rand -base64 32` (not your local one) |
   | `BETTER_AUTH_URL` | `https://<your-domain>` |
   | `ALLOWED_EMAILS` | your email(s), comma-separated, so no one else can sign up |

4. Deploy. The `vercel-build` script (`scripts/vercel-build.mjs`) runs
   `prisma migrate deploy` before `next build`, so the schema is migrated on
   every deploy that has a database; a deployment without one still builds.

Preview deployments run migrations against whatever `DATABASE_URL_UNPOOLED`
they're given. Point Preview at a Neon branch (the Neon integration does this
automatically), not at production.

## Installing on your iPhone

1. Open your deployment URL in **Safari** and sign in.
2. Tap **Share → Add to Home Screen → Add**.
3. Launch **Gym** from the Home Screen and sign in there (the Home Screen app
   has its own storage, separate from Safari). It opens full screen and stays
   signed in (60-day sessions, extended while you use it).

Once opened online, the app works with no connection: start a workout, log
and edit sets, browse history and exercises. Changes are saved on the phone
and sync when the connection returns; the pill at the top and
**Settings → Sync** show anything not yet synced. Don't delete the Home
Screen icon while changes are pending: that deletes the phone's copy.

### Moving your data from the iPhone app

In the Expo app: **Settings → Export backup (JSON)**, save it to Files. In the
web app: **Settings → Import from the iPhone app → Choose backup file**.
Importing the same file again won't create duplicates.
